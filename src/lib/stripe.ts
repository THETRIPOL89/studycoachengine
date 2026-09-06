import Stripe from 'stripe'

/**
 * Stripe SDK singleton.
 *
 * apiVersion pinnata per evitare breaking change silenziosi quando Stripe
 * rilascia nuove versioni. Quando aggiorni la versione, testa tutti i flussi
 * (checkout, webhook, customer portal) su Stripe test mode.
 */
const apiVersion = '2025-02-24.acacia' as const

let cached: Stripe | null = null

export function getStripe(): Stripe {
  if (cached) return cached

  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error(
      'getStripe: STRIPE_SECRET_KEY mancante. Aggiungila a .env.local.'
    )
  }

  cached = new Stripe(key, {
    apiVersion,
    typescript: true,
    appInfo: {
      name: 'Study Coach',
      version: '0.1.0'
    }
  })

  return cached
}

/**
 * Mappa tra le nostre 3 chiavi piano e i Price ID Stripe configurati via env.
 * Usata da `createCheckoutSession` per costruire `line_items`.
 */
export function getPriceIdForPlan(plan: 'monthly' | 'semestral' | 'annual'): string {
  const map: Record<typeof plan, string | undefined> = {
    monthly: process.env.STRIPE_PRICE_MONTHLY,
    semestral: process.env.STRIPE_PRICE_SEMESTRAL,
    annual: process.env.STRIPE_PRICE_ANNUAL
  }
  const priceId = map[plan]
  if (!priceId) {
    throw new Error(`getPriceIdForPlan: Price ID per piano "${plan}" mancante in env.`)
  }
  return priceId
}
