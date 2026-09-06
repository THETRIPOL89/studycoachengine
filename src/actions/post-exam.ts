'use server'

import { createServerSupabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

// ============================================================
// submitPostExam - Sprint 9
// ============================================================
// Salva l'esito finale di un esame. Voto, soddisfazione, argomenti
// usciti e domande ricevute vanno in colonne dedicate di `exams`
// (vedi schema_updates_sprint9_passati.sql). Lo stato diventa
// 'completato' (se superato) o 'sospeso' (se non superato) — quello
// che c'era gia' prima.
//
// Nessuna sessione "finta" viene piu' creata (la vecchia versione
// metteva voto e argomenti nella `note` di una study_sessions, ma
// sporcava le statistiche di studio).
// ============================================================

export async function submitPostExam(examId: string, data: {
  superato: boolean
  voto: number | null
  soddisfazione: number | null
  argomenti_usciti: string
  domande_ricevute: string
}) {
  const supabase = await createServerSupabase()

  // Validazione difensiva lato server. Le CHECK constraints del DB
  // sono la safety net finale.
  if (data.superato && data.voto !== null) {
    if (data.voto < 18 || data.voto > 30) {
      return { error: 'Voto fuori range (18-30).' }
    }
  }
  if (data.soddisfazione !== null) {
    if (data.soddisfazione < 1 || data.soddisfazione > 5) {
      return { error: 'Soddisfazione fuori range (1-5).' }
    }
  }
  // Voto richiesto solo se superato. Soddisfazione sempre opzionale
  // ma se l'utente la inserisce deve essere valida.
  const votoToStore = data.superato ? data.voto : null

  // Workaround: l'inferenza supabase-js v2 collassa a `never` (vedi src/types/database.ts).
  const { error: updateError } = await supabase
    .from('exams')
    .update({
      stato: data.superato ? 'completato' : 'sospeso',
      voto_finale: votoToStore,
      soddisfazione: data.soddisfazione,
      data_completamento: new Date().toISOString(),
      argomenti_usciti: data.argomenti_usciti.trim() || null,
      domande_ricevute: data.domande_ricevute.trim() || null
    } as never)
    .eq('id', examId)

  if (updateError) return { error: updateError.message }

  revalidatePath('/dashboard')
  revalidatePath(`/exam/${examId}`)
  return { success: true }
}
