'use server'

import { createServerSupabase } from '@/lib/supabase/server'

// ============================================================
// getStreak - legge lo stato della streak dell'utente corrente
// ============================================================
// NON passa per checkRateLimit perche':
//   - Non chiama AI.
//   - Singola lookup su profiles (PK = id), RLS-protected.
//   - Lettura su ogni page load: introdurre un rate limit aggiungerebbe
//     latenza senza beneficio (impossibile "abuse" un index lookup).
//
// `isAtRisk` = true quando l'utente ha una streak attiva (count > 0)
// ma NON ha completato una sessione nelle ultime 24h. In quel caso
// il widget mostra la fiamma in modalita "attenzione" (dimmed) e
// un messaggio non giudicante ("Hai tempo fino a stasera per...").
//
// Il gap massimo per isAtRisk e 36h: oltre quello, lo streak e
// ufficialmente rotto e il widget andra in stato "ricomincia".
// ============================================================

export interface StreakState {
  streakCount: number
  lastUpdated: string | null   // ISO string o null
  isAtRisk: boolean            // gap 24h..36h, streak ancora valida
  isBroken: boolean            // gap > 36h, streak da considerarsi 0
  freezeUsedThisWeek: boolean  // info UI: "freeze usata questa settimana"
}

export async function getStreak(): Promise<StreakState> {
  const supabase = await createServerSupabase()

  // Selezioniamo i 3 nuovi campi strettamente necessari. Cast a un
  // tipo locale perche' i nuovi campi non sono in Row (vedi
  // src/types/database.ts: aggiunti solo a livello SQL).
  const { data, error } = await supabase
    .from('profiles')
    .select('streak_count, streak_last_updated, streak_freeze_used_on')
    .maybeSingle()

  if (error || !data) {
    // Profilo mancante o errore RLS: stato neutro.
    return {
      streakCount: 0,
      lastUpdated: null,
      isAtRisk: false,
      isBroken: false,
      freezeUsedThisWeek: false
    }
  }

  // Cast runtime (vedi commento sopra sul .select()).
  const row = data as unknown as {
    streak_count: number | null
    streak_last_updated: string | null
    streak_freeze_used_on: string | null
  }

  const count = row.streak_count ?? 0
  const lastUpdated = row.streak_last_updated

  if (!lastUpdated || count === 0) {
    return {
      streakCount: 0,
      lastUpdated,
      isAtRisk: false,
      isBroken: false,
      freezeUsedThisWeek: !!row.streak_freeze_used_on
    }
  }

  const nowMs = Date.now()
  const lastMs = new Date(lastUpdated).getTime()
  const gapHours = (nowMs - lastMs) / (1000 * 60 * 60)

  // isAtRisk: streak ancora "salva" (gap < 36h) ma l'utente non ha
  // fatto niente oggi (gap >= 24h). Mostra il warning gentile.
  // isBroken: gap >= 36h, la streak è andata. Mostriamo 0 + messaggio.
  //   (Nota: il trigger non ha ancora azzerato il count in DB - quello
  //   avverrà solo alla prossima sessione completata. L'UI anticipa.)
  const isAtRisk = gapHours >= 24 && gapHours < 36
  const isBroken = gapHours >= 36

  return {
    streakCount: isBroken ? 0 : count,
    lastUpdated,
    isAtRisk,
    isBroken,
    freezeUsedThisWeek: isFreezeUsedThisWeek(row.streak_freeze_used_on)
  }
}

function isFreezeUsedThisWeek(freezeUsedOn: string | null): boolean {
  if (!freezeUsedOn) return false
  // Allinea la logica al trigger: lunedi della settimana ISO corrente.
  const now = new Date()
  const currentWeekStart = new Date(now)
  currentWeekStart.setUTCHours(0, 0, 0, 0)
  // ISO week starts Monday. getUTCDay(): 0=Sun, 1=Mon, ..., 6=Sat.
  const dayOfWeek = currentWeekStart.getUTCDay()
  const daysSinceMonday = (dayOfWeek + 6) % 7   // Mon=0, Sun=6
  currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() - daysSinceMonday)

  return freezeUsedOn >= currentWeekStart.toISOString().split('T')[0]
}
