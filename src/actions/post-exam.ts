'use server'

import { createServerSupabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function submitPostExam(examId: string, data: {
  superato: boolean
  voto: number | null
  argomenti_usciti: string
  domande_ricevute: string
}) {
  const supabase = await createServerSupabase()

  // Aggiorna l'esame
  // Workaround: l'inferenza supabase-js v2 collassa a `never` (vedi src/types/database.ts).
  const { error: updateError } = await supabase
    .from('exams')
    .update({
      stato: data.superato ? 'completato' : 'sospeso',
      // Potremmo aggiungere campi voto, argomenti_usciti in futuro
    } as never)
    .eq('id', examId)

  if (updateError) return { error: updateError.message }

  // Salva i dati post-esame in una tabella dedicata (se esiste)
  // Per ora li salviamo come sessione speciale
  // Workaround: stessa inferenza collassata di sopra.
  const { error: sessionError } = await supabase
    .from('study_sessions')
    .insert({
      exam_id: examId,
      data: new Date().toISOString().split('T')[0],
      attivita: `Esame ${data.superato ? 'SUPERATO' : 'NON SUPERATO'}${data.voto ? ` - Voto: ${data.voto}` : ''}`,
      durata_minuti: 0,
      completata: true,
      note: `Argomenti: ${data.argomenti_usciti}
Domande: ${data.domande_ricevute}`
    } as never)

  if (sessionError) return { error: sessionError.message }

  revalidatePath('/dashboard')
  return { success: true }
}
