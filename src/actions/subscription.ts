'use server'

import { createServerSupabase } from '@/lib/supabase'
import { createAdminSupabase } from '@/lib/supabase-admin'
import { getStripe, getPriceIdForPlan } from '@/lib/stripe'
import { checkRateLimit } from '@/actions/rate-limit'
import type { PlanKey } from '@/lib/pricing'
import { FREE_LIMITS } from '@/lib/pricing'

// ============================================================
// Cache in-memory (process-local, TTL 30s)
// Stesso caveat del `aiResponseCache` in nim.ts/groq.ts: non
// condiviso tra istanze. Su serverless è cold-start cache miss
// ad ogni invocazione, ma va bene per il caso d'uso.
// ============================================================
const CACHE_TTL_MS = 30_000
const premiumCache = new Map<string, { isPremium: boolean; plan: 'free' | 'premium'; premiumUntil: string | null; expiresAt: number }>()

interface SubscriptionStatus {
  plan: 'free' | 'premium'
  premiumUntil: string | null
}

/**
 * Source of truth: legge profiles.plan + profiles.premium_until.
 * La regola unica: premium = plan==='premium' && (premium_until is null || > now).
 * Cache 30s per evitare query DB su ogni chiamata AI.
 */
export async function isPremium(userId: string): Promise<boolean> {
  const cached = premiumCache.get(userId)
  const now = Date.now()
  if (cached && cached.expiresAt > now) {
    return cached.isPremium
  }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('profiles')
    .select('plan, premium_until')
    .eq('id', userId)
    .single()

  if (error || !data) {
    // Se il profilo manca, trattalo come free (non bloccare l'app).
    premiumCache.set(userId, { isPremium: false, plan: 'free', premiumUntil: null, expiresAt: now + CACHE_TTL_MS })
    return false
  }

  // Cast perché `profiles` non ha `plan`/`premium_until` in Row (rimossi per
  // evitare il collapse del GenericTable constraint — vedi src/types/database.ts).
  // Validato runtime: il check constraint sul DB garantisce i valori.
  const profile = data as { plan: string | null; premium_until: string | null }
  const plan = (profile.plan ?? 'free') as 'free' | 'premium'
  const premiumUntil = profile.premium_until ?? null
  const isActive = plan === 'premium' && (premiumUntil === null || new Date(premiumUntil) > new Date())

  premiumCache.set(userId, { isPremium: isActive, plan, premiumUntil, expiresAt: now + CACHE_TTL_MS })
  return isActive
}

/**
 * Ritorna lo stato subscription completo (per UI/debug).
 * NON cachato perché serve freschezza sulla dashboard dopo upgrade.
 */
export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('profiles')
    .select('plan, premium_until')
    .eq('id', userId)
    .single()

  if (error || !data) {
    return { plan: 'free', premiumUntil: null }
  }
  // Cast perché `profiles` non ha `plan`/`premium_until` in Row (vedi sopra).
  const profile = data as { plan: string | null; premium_until: string | null }
  return { plan: (profile.plan ?? 'free') as 'free' | 'premium', premiumUntil: profile.premium_until ?? null }
}

/**
 * Ritorna info piano + stato premium (per il client).
 * Usato dalla dashboard e passato a componenti figli (StudyTimer, ecc.).
 */
export async function getUserPlan(): Promise<{
  isPremium: boolean
  plan: 'free' | 'premium'
  premiumUntil: string | null
}> {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { isPremium: false, plan: 'free', premiumUntil: null }
  const status = await getSubscriptionStatus(user.id)
  return {
    isPremium: status.plan === 'premium' && (status.premiumUntil === null || new Date(status.premiumUntil) > new Date()),
    plan: status.plan,
    premiumUntil: status.premiumUntil
  }
}

/**
 * Conta quante risorse un free user ha ancora a disposizione.
 * Per premium ritorna `null` (illimitato).
 */
export async function getQuotaState(): Promise<{
  plan: 'free' | 'premium'
  activeExams: number
  maxActiveExams: number
  materialsThisExam?: { examId: string; count: number; max: number }[]
}> {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { plan: 'free', activeExams: 0, maxActiveExams: FREE_LIMITS.maxActiveExams }
  }

  const status = await getSubscriptionStatus(user.id)
  const isPremium = status.plan === 'premium' && (status.premiumUntil === null || new Date(status.premiumUntil) > new Date())

  const { count: activeExams } = await supabase
    .from('exams')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('stato', 'in_corso')

  if (isPremium) {
    return { plan: 'premium', activeExams: activeExams ?? 0, maxActiveExams: Infinity }
  }

  return {
    plan: 'free',
    activeExams: activeExams ?? 0,
    maxActiveExams: FREE_LIMITS.maxActiveExams
  }
}

/**
 * Helper per i server action gate-ati (esami, AI Tutor).
 * Per i materiali vedi `checkPaywallMaterial` (richiede examId).
 *
 * Ritorna:
 *   - { allowed: true } se ok
 *   - { allowed: false, code: 'quota_exceeded', reason } se free user ha sforato
 *   - { allowed: false, error } se altro problema
 */
export async function checkPaywall(reason: 'exam' | 'ai_tutor'): Promise<
  | { allowed: true }
  | { allowed: false; code: 'quota_exceeded'; reason: 'exam' | 'ai_tutor' }
  | { allowed: false; error: string }
> {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { allowed: false, error: 'Non autenticato' }

  const premium = await isPremium(user.id)
  if (premium) return { allowed: true }

  if (reason === 'ai_tutor') {
    // AI Tutor: basta essere premium, nessun conteggio.
    return { allowed: false, code: 'quota_exceeded', reason: 'ai_tutor' }
  }

  if (reason === 'exam') {
    const { count } = await supabase
      .from('exams')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('stato', 'in_corso')
    if ((count ?? 0) >= FREE_LIMITS.maxActiveExams) {
      return { allowed: false, code: 'quota_exceeded', reason: 'exam' }
    }
    return { allowed: true }
  }

  return { allowed: true }
}

/**
 * Variante di checkPaywall per i materiali: ha bisogno dell'exam_id.
 */
export async function checkPaywallMaterial(examId: string): Promise<
  | { allowed: true }
  | { allowed: false; code: 'quota_exceeded'; reason: 'material' }
  | { allowed: false; error: string }
> {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { allowed: false, error: 'Non autenticato' }

  const premium = await isPremium(user.id)
  if (premium) return { allowed: true }

  const { count } = await supabase
    .from('materials')
    .select('id', { count: 'exact', head: true })
    .eq('exam_id', examId)
  if ((count ?? 0) >= FREE_LIMITS.maxMaterialsPerExam) {
    return { allowed: false, code: 'quota_exceeded', reason: 'material' }
  }
  return { allowed: true }
}

// ============================================================
// Stripe Checkout
// ============================================================

/**
 * Crea una Stripe Checkout Session per il piano scelto e ritorna la URL
 * a cui redirigere l'utente. Usa service_role per leggere/scrivere
 * stripe_customer_id (la policy RLS blocca l'utente da farlo).
 */
export async function createCheckoutSession(plan: PlanKey): Promise<{ url?: string; error?: string }> {
  // 1. Auth
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  // 2. Rate limit (previene spam e abusi)
  const rl = await checkRateLimit('create_checkout_session')
  if (!rl.allowed) return { error: rl.error ?? 'Rate limit' }

  // 3. Già premium? Ritorna errore (idempotente sul lato utente).
  const premium = await isPremium(user.id)
  if (premium) return { error: 'Sei già un utente Premium.' }

  // 4. Trova o crea Stripe Customer
  const admin = createAdminSupabase()
  // Cast perché `profiles.stripe_customer_id` non e in Row (vedi src/types/database.ts).
  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_customer_id, email')
    .eq('id', user.id)
    .single()
  const prof = profile as { stripe_customer_id: string | null; email: string | null } | null

  const stripe = getStripe()
  const priceId = getPriceIdForPlan(plan)
  // In produzione, NEXT_PUBLIC_APP_URL DEVE essere settata al dominio Vercel
  // per costruire success_url/cancel_url corretti. MAI fallback a localhost
  // in produzione (romperebbe i redirect dopo pagamento).
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    return { error: 'NEXT_PUBLIC_APP_URL non configurata. Aggiungila alle env (es. https://your-app.vercel.app).' }
  }

  let customerId = prof?.stripe_customer_id ?? null
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id }
    })
    customerId = customer.id
    // Salva customer_id con service_role (la policy RLS esclude l'utente).
    // Workaround: l'inferenza supabase-js v2 collassa a `never` (vedi sopra).
    await admin
      .from('profiles')
      .update({ stripe_customer_id: customerId } as never)
      .eq('id', user.id)
  }

  // 5. Crea Checkout Session
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?upgrade=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard?upgrade=canceled`,
      client_reference_id: user.id,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      locale: 'it',
      metadata: {
        supabase_user_id: user.id,
        plan
      }
    })

    if (!session.url) return { error: 'Stripe non ha restituito una URL di checkout.' }
    return { url: session.url }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Errore Stripe sconosciuto'
    console.error('createCheckoutSession error:', msg)
    return { error: msg }
  }
}

/**
 * Crea un Customer Portal session per permettere all'utente premium di
 * gestire/cancellare la subscription. (Future: bottone "Gestisci abbonamento".)
 */
export async function createCustomerPortalSession(): Promise<{ url?: string; error?: string }> {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  const admin = createAdminSupabase()
  // Cast perché `profiles.stripe_customer_id` non e in Row (vedi src/types/database.ts).
  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()
  const prof = profile as { stripe_customer_id: string | null } | null

  if (!prof?.stripe_customer_id) {
    return { error: 'Nessun customer Stripe associato a questo account.' }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: prof.stripe_customer_id,
      return_url: `${appUrl}/dashboard`
    })
    return { url: session.url }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Errore Stripe sconosciuto'
    return { error: msg }
  }
}
