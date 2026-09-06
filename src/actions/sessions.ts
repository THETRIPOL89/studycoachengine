'use server'

import { createServerSupabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

// study_sessions.subtopic_id e una colonna UUID. Le activity sintetici
// creati come fallback usano id non-UUID (es. `fallback-<uuid>` oppure,
// nelle versioni precedenti, `temp-<uuid>-<timestamp>`). Filtriamo
// tutto cio che non passa il check UUID cosi il DB non rigetta l'insert.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function createSession(examId: string, topicId: string | null, attivita: string, durataMinuti: number, subtopicId?: string | null) {
  const supabase = await createServerSupabase()

  const insertData: any = {
    exam_id: examId,
    topic_id: topicId,
    data: new Date().toISOString().split('T')[0],
    attivita,
    durata_minuti: durataMinuti,
    completata: false
  }

  if (subtopicId && UUID_RE.test(subtopicId)) {
    insertData.subtopic_id = subtopicId
  }

  // Workaround: l'inferenza supabase-js v2 collassa il parametro a `never[]`
  // (vedi src/types/database.ts). Validato runtime da RLS.
  const { data, error } = await supabase
    .from('study_sessions')
    .insert(insertData as never)
    .select()
    .single()

  if (error) return { error: error.message }
  // Cast perché il tipo di data puo collassare a `never` (vedi workaround
  // sopra sul `.insert()`). Validato runtime da RLS.
  const inserted = data as { id: string } | null
  return { success: true, sessionId: inserted?.id }
}

export async function completeSession(
  sessionId: string,
  examId: string,
  feedback: {
    difficolta: number
    risultato_quiz: number | null
    note: string
    durata_effettiva: number
    topic_id: string | null
    tipo_competenza: string
    subtopic_id?: string | null
  }
) {
  const supabase = await createServerSupabase()

  // Workaround: stessa inferenza collassata di sopra (vedi createSession).
  const { error: sessionError } = await supabase
    .from('study_sessions')
    .update({
      completata: true,
      difficolta: feedback.difficolta,
      risultato_quiz: feedback.risultato_quiz,
      note: feedback.note,
      durata_minuti: feedback.durata_effettiva
    } as never)
    .eq('id', sessionId)

  if (sessionError) return { error: sessionError.message }

  if (feedback.subtopic_id && UUID_RE.test(feedback.subtopic_id)) {
    // Workaround: stessa inferenza collassata di sopra.
    await supabase
      .from('subtopics')
      .update({ completato: true } as never)
      .eq('id', feedback.subtopic_id)
  }

  if (feedback.topic_id && feedback.tipo_competenza) {
    const { data: competence } = await supabase
      .from('competences')
      .select('*')
      .eq('topic_id', feedback.topic_id)
      .maybeSingle()

    if (competence) {
      // Cast perché il tipo di competence puo collassare a `never` (vedi
      // workaround sopra sul `.select().maybeSingle()`). Validato runtime.
      const comp = competence as { id: string; teoria: number; memoria: number; esercizi: number; problemi_complessi: number; orale: number }
      const incrementi = { 1: 15, 2: 10, 3: 8, 4: 5, 5: 2 }
      const baseIncrement = incrementi[feedback.difficolta as keyof typeof incrementi] || 0
      const quizBonus = feedback.risultato_quiz ? Math.round(feedback.risultato_quiz / 10) : 0

      const currentValue = (comp[feedback.tipo_competenza as keyof typeof comp] as number) || 0
      const newValue = Math.min(100, currentValue + baseIncrement + quizBonus)

      // Workaround: stessa inferenza collassata di sopra.
      const { error: compError } = await supabase
        .from('competences')
        .update({ [feedback.tipo_competenza]: newValue } as never)
        .eq('id', comp.id)

      if (compError) return { error: compError.message }
    }
  }

  revalidatePath(`/exam/${examId}`)
  return { success: true }
}

export async function getTodaySessions(examId: string) {
  const supabase = await createServerSupabase()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('study_sessions')
    .select('*')
    .eq('exam_id', examId)
    .eq('data', today)
    .order('created_at', { ascending: false })

  if (error) return { sessions: [] }
  return { sessions: data }
}

export async function getMonthlySessions(examId: string, year: number, month: number) {
  const supabase = await createServerSupabase()

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = month === 12 
    ? `${year + 1}-01-01` 
    : `${year}-${String(month + 1).padStart(2, '0')}-01`

  const { data, error } = await supabase
    .from('study_sessions')
    .select('*')
    .eq('exam_id', examId)
    .gte('data', startDate)
    .lt('data', endDate)
    .eq('completata', true)
    .order('data', { ascending: true })

  if (error) return { sessions: [] }
  return { sessions: data || [] }
}
