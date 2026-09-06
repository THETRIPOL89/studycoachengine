import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { createAdminSupabase } from '@/lib/supabase-admin'

// IMPORTANTE: disabilitiamo il body parser di Next per ricevere il body
// RAW (byte-identico a quello che Stripe ha firmato). Qualsiasi
// trasformazione (JSON.parse, trim, ecc.) invalida la firma.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Webhook Stripe firmato.
 *
 * Flusso:
 * 1. Leggo il body raw (text) e l'header `stripe-signature`.
 * 2. Verifico la firma con `stripe.webhooks.constructEvent`.
 * 3. Switch su `event.type`:
 *    - checkout.session.completed: scrivo profiles.plan='premium' + premium_until
 *    - invoice.paid: renewal OK, aggiorno current_period_end
 *    - invoice.payment_failed: lascio premium_until al periodo corrente (grace)
 *    - customer.subscription.deleted: scrivo plan='free', premium_until=null
 *    - customer.subscription.updated: aggiorno status + current_period_end
 * 4. Tutte le scritture passano dal client service_role (vedi supabase-admin.ts).
 *    Le subscription finiscono in `subscriptions` (audit, unique su stripe_subscription_id).
 */
export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET mancante.')
    return NextResponse.json({ error: 'Webhook secret non configurato' }, { status: 500 })
  }

  // Body raw.
  const rawBody = await req.text()
  const stripe = getStripe()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Errore firma sconosciuto'
    console.error('Webhook signature verification fallita:', msg)
    return NextResponse.json({ error: `Firma non valida: ${msg}` }, { status: 400 })
  }

  // Da qui in poi: evento autenticato. Scritture via service_role.
  const admin = createAdminSupabase()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session, admin)
        break
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaid(invoice, admin)
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaymentFailed(invoice, admin)
        break
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(subscription, admin)
        break
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription, admin)
        break
      }
      default:
        // Evento non gestito, ma lo accettiamo (200) per evitare retry infiniti.
        break
    }
  } catch (err) {
    // 500 fa ritentare Stripe (fino a 3 giorni). Log per debug.
    console.error(`Webhook handler error per ${event.type}:`, err)
    return NextResponse.json(
      { error: 'Handler error', eventType: event.type },
      { status: 500 }
    )
  }

  return NextResponse.json({ received: true, eventType: event.type })
}

// ============================================================
// Handlers
// ============================================================

type AdminClient = ReturnType<typeof createAdminSupabase>

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, admin: AdminClient) {
  const userId = session.client_reference_id ?? session.metadata?.supabase_user_id
  if (!userId) {
    console.error('checkout.session.completed senza client_reference_id:', session.id)
    return
  }
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
  if (!subscriptionId) {
    console.error('checkout.session.completed senza subscription:', session.id)
    return
  }

  // Recupero subscription per avere current_period_end (può non essere
  // popolato sull'oggetto session). Espandiamo.
  const stripe = getStripe()
  const sub = await stripe.subscriptions.retrieve(subscriptionId)
  const periodEnd = new Date(sub.current_period_end * 1000).toISOString()

  // Upsert subscription (idempotente via unique su stripe_subscription_id).
  // Workaround: l'inferenza supabase-js v2 collassa a `never` (vedi src/types/database.ts).
  await admin
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customerId ?? null,
        status: sub.status,
        current_period_end: periodEnd,
        plan: 'premium'
      } as never,
      { onConflict: 'stripe_subscription_id' }
    )

  // Aggiorna profiles: plan='premium', premium_until=current_period_end.
  // Solo se la sub è attiva (active o trialing). Se è incomplete, aspetta
  // invoice.paid.
  if (sub.status === 'active' || sub.status === 'trialing') {
    // Workaround: stessa inferenza collassata di sopra.
    await admin
      .from('profiles')
      .update({
        plan: 'premium',
        premium_until: periodEnd,
        stripe_customer_id: customerId ?? null,
        stripe_subscription_id: subscriptionId
      } as never)
      .eq('id', userId)
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice, admin: AdminClient) {
  const subscriptionId = invoice.subscription
    ? (typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id)
    : null
  if (!subscriptionId) return

  // current_period_end NON è garantito sull'Invoice object dopo le API recenti;
  // rileggiamo la subscription.
  const stripe = getStripe()
  const sub = await stripe.subscriptions.retrieve(subscriptionId)
  const periodEnd = new Date(sub.current_period_end * 1000).toISOString()
  const userId = sub.metadata?.supabase_user_id

  // Aggiorna audit table.
  // Workaround: stessa inferenza collassata di sopra.
  await admin
    .from('subscriptions')
    .update({
      status: sub.status,
      current_period_end: periodEnd
    } as never)
    .eq('stripe_subscription_id', subscriptionId)

  // Estendi premium_until sul profile.
  if (userId && (sub.status === 'active' || sub.status === 'trialing')) {
    // Workaround: stessa inferenza collassata di sopra.
    await admin
      .from('profiles')
      .update({
        plan: 'premium',
        premium_until: periodEnd,
        stripe_subscription_id: subscriptionId
      } as never)
      .eq('id', userId)
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice, admin: AdminClient) {
  // Graceful: NON disattiviamo subito. Stripe ritenta per alcuni giorni.
  // Aggiorniamo solo lo status nella tabella audit.
  const subscriptionId = invoice.subscription
    ? (typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id)
    : null
  if (!subscriptionId) return

  // Workaround: stessa inferenza collassata di sopra.
  await admin
    .from('subscriptions')
    .update({ status: 'past_due' } as never)
    .eq('stripe_subscription_id', subscriptionId)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, admin: AdminClient) {
  const userId = subscription.metadata?.supabase_user_id
  const periodEnd = new Date(subscription.current_period_end * 1000).toISOString()

  // Workaround: stessa inferenza collassata di sopra.
  await admin
    .from('subscriptions')
    .upsert(
      {
        user_id: userId ?? '',
        stripe_subscription_id: subscription.id,
        stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : null,
        status: subscription.status,
        current_period_end: periodEnd,
        plan: 'premium'
      } as never,
      { onConflict: 'stripe_subscription_id' }
    )

  if (!userId) return

  // Se Stripe dice che non è più attivo, downgrade a free.
  const stillActive = subscription.status === 'active' || subscription.status === 'trialing'
  if (stillActive) {
    // Workaround: stessa inferenza collassata di sopra.
    await admin
      .from('profiles')
      .update({
        plan: 'premium',
        premium_until: periodEnd,
        stripe_subscription_id: subscription.id
      } as never)
      .eq('id', userId)
  } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
    // Workaround: stessa inferenza collassata di sopra.
    await admin
      .from('profiles')
      .update({
        plan: 'free',
        premium_until: null,
        stripe_subscription_id: subscription.id
      } as never)
      .eq('id', userId)
  }
  // Per status past_due / incomplete: NON tocchiamo plan, lasciamo il grace period.
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, admin: AdminClient) {
  const userId = subscription.metadata?.supabase_user_id

  // Workaround: stessa inferenza collassata di sopra.
  await admin
    .from('subscriptions')
    .update({ status: 'canceled' } as never)
    .eq('stripe_subscription_id', subscription.id)

  if (!userId) return
  // Workaround: stessa inferenza collassata di sopra.
  await admin
    .from('profiles')
    .update({
      plan: 'free',
      premium_until: null
    } as never)
    .eq('id', userId)
}
