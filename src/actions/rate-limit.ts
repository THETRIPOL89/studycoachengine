'use server'

import { createServerSupabase } from '@/lib/supabase'

const WINDOW_MINUTES = 1
const MAX_CALLS_PER_WINDOW = 10

export async function checkRateLimit(action: string) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { allowed: false, error: 'Non autenticato' }

  try {
    // Workaround: l'inferenza supabase-js v2 collassa il result a `never` per
    // via del vincolo GenericTable sul Database type (vedi src/types/database.ts).
    // Validato runtime da RLS. Cast esplicito sui campi che ci servono.
    const { data: existing } = await supabase
      .from('ai_rate_limits')
      .select('*')
      .eq('user_id', user.id)
      .eq('action', action)
      .single()

    const now = new Date()

    if (!existing) {
      // Workaround: stessa inferenza collassata di sopra.
      await supabase.from('ai_rate_limits').insert({
        user_id: user.id,
        action,
        count: 1,
        window_start: now.toISOString()
      } as never)
      return { allowed: true }
    }

    // Cast perché il tipo di existing puo collassare a `never` (vedi workaround
    // sopra sul `.single()`). Validato runtime da RLS.
    const rateRow = existing as { count: number; window_start: string }
    const windowStart = new Date(rateRow.window_start)
    const windowMs = WINDOW_MINUTES * 60 * 1000
    const elapsed = now.getTime() - windowStart.getTime()

    if (elapsed > windowMs) {
      // Workaround: stessa inferenza collassata di sopra.
      await supabase.from('ai_rate_limits').update({
        count: 1,
        window_start: now.toISOString()
      } as never).eq('user_id', user.id).eq('action', action)
      return { allowed: true }
    }

    if (rateRow.count >= MAX_CALLS_PER_WINDOW) {
      return {
        allowed: false,
        error: `Troppe richieste AI. Attendi ${WINDOW_MINUTES} minuto.`
      }
    }

    // Workaround: stessa inferenza collassata di sopra.
    await supabase.from('ai_rate_limits').update({
      count: rateRow.count + 1
    } as never).eq('user_id', user.id).eq('action', action)

    return { allowed: true }
  } catch (e) {
    // Se la tabella non esiste, permetti la chiamata (graceful degradation)
    console.warn('Rate limit check failed (tabella ai_rate_limits mancante?):', e)
    return { allowed: true }
  }
}
