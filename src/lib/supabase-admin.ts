import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * WEBHOOK ONLY — non importare in 'use client'.
 *
 * Ritorna un client Supabase con la service_role key, che bypassa RLS.
 * Usalo SOLO dentro il webhook handler (`src/app/api/stripe/webhook/route.ts`)
 * per scrivere colonne billing su `profiles` e inserire righe in `subscriptions`.
 *
 * Non usarlo MAI in pagine o Server Actions lette dal client: l'utente
 * potrebbe esfiltrare la service_role key se viene passata in qualche prop
 * o serializzata in un Server Component.
 *
 * L'unica altra giustificazione valida per importare questo file è se una
 * Server Action strettamente server-side deve scrivere colonne billing
 * (es. `createCheckoutSession` per salvare stripe_customer_id).
 */
let cachedAdmin: SupabaseClient<Database> | null = null

export function createAdminSupabase(): SupabaseClient<Database> {
  if (cachedAdmin) return cachedAdmin

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'createAdminSupabase: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY mancanti. ' +
        'Questo client è solo per il webhook Stripe e la Server Action createCheckoutSession.'
    )
  }

  cachedAdmin = createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  return cachedAdmin
}
