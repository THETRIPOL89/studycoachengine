'use server'

import { createServerSupabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { Exam, StudySession, Topic } from '@/types/database'
import { checkPaywall } from '@/actions/subscription'
import { TUTORIAL_EXAM_PREFIX } from '@/lib/tutorial'

export async function cleanupTutorialExams() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { deleted: 0 }

  const { data, error } = await supabase
    .from('exams')
    .select('id, nome_esame')
    .eq('user_id', user.id)

  if (error || !data) return { deleted: 0, error: error?.message }

  const tutorialIds = (data as { id: string; nome_esame: string }[])
    .filter((e) => typeof e.nome_esame === 'string' && e.nome_esame.startsWith(TUTORIAL_EXAM_PREFIX))
    .map((e) => e.id)

  if (tutorialIds.length === 0) return { deleted: 0 }

  const { error: delError } = await supabase
    .from('exams')
    .delete()
    .in('id', tutorialIds)

  if (delError) return { deleted: 0, error: delError.message }

  revalidatePath('/dashboard')
  return { deleted: tutorialIds.length }
}

export async function getExams() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { exams: [] }

  // Sprint 9: filtriamo "in_corso" lato client per evitare di dover
  // tenere sincronizzato lo stato con la data. Un esame la cui
  // data_esame e passata e ancora in_corso verra' mostrato nella
  // sezione "In corso" con un banner per ricordare di compilare il
  // feedback, ma verra' comunque proposto al coach engine solo se
  // giorni_mancanti >= 0 (vedi generateDailyPlan).
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .eq('user_id', user.id)
    .order('data_esame', { ascending: true })

  if (error) {
    console.error('Error fetching exams:', error)
    return { exams: [] }
  }

  // "In corso" = stato in_corso E data_esame >= oggi (cioe non ancora
  // passato). Teniamo dentro la dashboard anche gli in_corso con data
  // passata cosi' l'utente vede il banner e puo' aprire la modale.
  const all = (data ?? []) as Exam[]
  const inCorso = all.filter(e =>
  e.stato === 'in_corso' &&
  e.data_esame >= today &&
  !(typeof e.nome_esame === 'string' && e.nome_esame.startsWith(TUTORIAL_EXAM_PREFIX))
)
  return { exams: inCorso, allExams: all }
}

// ============================================================
// getExamsPassati - ritorna gli esami "passati" per la sezione
// dedicata della dashboard.
// ============================================================
// Criteri: stato = 'completato' OR data_esame < oggi.
// Ordinamento: piu' recenti prima (data_esame DESC).
// Vengono inclusi anche gli in_corso con data passata, cosi' l'utente
// vede subito "questo esame ti aspetta" e puo' cliccare per fare il
// feedback. La dashboard poi apre la PostExamModal automaticamente
// per il primo senza voto_finale.
// ============================================================
export async function getExamsPassati() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { exams: [] }

  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .eq('user_id', user.id)
    .order('data_esame', { ascending: false })

  if (error) {
    console.error('Error fetching passati:', error)
    return { exams: [] }
  }

  const all = (data ?? []) as Exam[]
  const passati = all.filter(e =>
    e.stato === 'completato' ||
    e.stato === 'sospeso' ||
    e.data_esame < today &&
    !(typeof e.nome_esame === 'string' && e.nome_esame.startsWith(TUTORIAL_EXAM_PREFIX))
  )
  return { exams: passati }
}

export async function getExamById(id: string) {
  const supabase = await createServerSupabase()

  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, nome_esame, data_esame, voto_obiettivo, ore_giorno, preparazione_percentuale, categoria')
    .eq('id', id)
    .single()

  if (examError) return { exam: null, topics: [], competences: [] }

  const { data: topics } = await supabase
    .from('topics')
    .select('id, nome_argomento, peso, ordine, competences(teoria, memoria, esercizi, problemi_complessi, orale)')
    .eq('exam_id', id)
    .order('ordine', { ascending: true })

  return {
    exam: exam as Exam,
    topics: topics as (Topic & { competences: any[] })[] || []
  }
}

export async function createExam(formData: FormData) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  const rawNome = (formData.get('nome_esame') as string) || ''
  const isTutorial = rawNome.startsWith(TUTORIAL_EXAM_PREFIX)

  // Paywall solo per esami reali. I tutorial non consumano lo slot free.
  if (!isTutorial) {
    const paywall = await checkPaywall('exam')
    if (!paywall.allowed) {
      if ('code' in paywall) {
        return {
          error: 'Hai già un esame attivo. Passa a Premium per averne illimitati.',
          code: paywall.code,
          reason: paywall.reason,
        }
      }
      return { error: paywall.error }
    }
  }

  const examData = {
    user_id: user.id,
    nome_esame: rawNome,
    universita: formData.get('universita') as string,
    corso: formData.get('corso') as string,
    professore: (formData.get('professore') as string) || null,
    data_esame: formData.get('data_esame') as string,
    voto_obiettivo: parseInt(formData.get('voto_obiettivo') as string),
    modalita: formData.get('modalita') as 'scritto' | 'orale' | 'misto' | null,
    ore_giorno: parseInt(formData.get('ore_giorno') as string) || 2,
    categoria:
      (formData.get('categoria') as 'scientifica' | 'mnemonica' | 'applicativa') ||
      'scientifica',
  }

  const { data, error } = await supabase
    .from('exams')
    .insert(examData as never)
    .select()
    .single()

  if (error) return { error: error.message }

  const inserted = data as { id: string }
  await generateDefaultTopics(inserted.id, examData.categoria)
  revalidatePath('/dashboard')
  return { success: true, examId: inserted.id }
}

export async function updateExam(examId: string, updates: Partial<{
  nome_esame: string
  universita: string
  corso: string
  professore: string
  data_esame: string
  voto_obiettivo: number
  modalita: 'scritto' | 'orale' | 'misto'
  ore_giorno: number
  categoria: 'scientifica' | 'mnemonica' | 'applicativa'
  stato: 'in_corso' | 'completato' | 'sospeso'
}>) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  // Stesso workaround di createExam sopra (vedi commento).
  const { error } = await supabase
    .from('exams')
    .update(updates as never)
    .eq('id', examId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath(`/exam/${examId}`)
  revalidatePath('/dashboard')
  return { success: true }
}

async function generateDefaultTopics(examId: string, categoria: string) {
  const supabase = await createServerSupabase()

  const defaultTopics: Record<string, { nome: string, micro: { titolo: string, tipo: string, durata: number }[] }[]> = {
    scientifica: [
      { 
        nome: 'Fondamenti teorici', 
        micro: [
          { titolo: 'Leggi definizioni e teoremi principali', tipo: 'teoria', durata: 25 },
          { titolo: 'Prendi appunti su formule chiave', tipo: 'teoria', durata: 20 },
          { titolo: 'Esercizio guidato: applicazione diretta', tipo: 'esercizio', durata: 25 },
          { titolo: 'Ripasso flashcard definizioni', tipo: 'ripasso', durata: 15 }
        ]
      },
      { 
        nome: 'Esercizi base', 
        micro: [
          { titolo: 'Risolvi 2 esercizi standard', tipo: 'esercizio', durata: 30 },
          { titolo: 'Verifica soluzioni e correggi errori', tipo: 'ripasso', durata: 15 },
          { titolo: 'Esercizio simile senza aiuti', tipo: 'esercizio', durata: 25 }
        ]
      },
      { 
        nome: 'Problemi complessi', 
        micro: [
          { titolo: 'Analisi problema: identifica dati e incognite', tipo: 'teoria', durata: 15 },
          { titolo: 'Risoluzione problema completo', tipo: 'esercizio', durata: 35 },
          { titolo: 'Verifica e discussione risultato', tipo: 'ripasso', durata: 15 }
        ]
      },
      { 
        nome: 'Dimostrazioni', 
        micro: [
          { titolo: 'Leggi dimostrazione dal libro', tipo: 'teoria', durata: 20 },
          { titolo: 'Riscrivi dimostrazione a memoria', tipo: 'esercizio', durata: 25 },
          { titolo: 'Identifica passaggi critici e ipotesi', tipo: 'ripasso', durata: 15 }
        ]
      },
      { 
        nome: 'Simulazione esame', 
        micro: [
          { titolo: 'Quiz a tempo: 5 domande miste', tipo: 'esercizio', durata: 25 },
          { titolo: 'Correzione e analisi errori', tipo: 'ripasso', durata: 20 }
        ]
      }
    ],
    mnemonica: [
      { 
        nome: 'Nozioni fondamentali', 
        micro: [
          { titolo: 'Leggi e sottolinea concetti chiave', tipo: 'teoria', durata: 25 },
          { titolo: 'Crea mappe mentali', tipo: 'teoria', durata: 20 },
          { titolo: 'Quiz rapido verifica', tipo: 'esercizio', durata: 15 }
        ]
      },
      { 
        nome: 'Spaced repetition', 
        micro: [
          { titolo: 'Ripassa argomenti giorno 1, 3, 7', tipo: 'ripasso', durata: 20 },
          { titolo: 'Flashcard difficili', tipo: 'ripasso', durata: 20 }
        ]
      },
      { 
        nome: 'Quiz interattivi', 
        micro: [
          { titolo: '20 domande a risposta multipla', tipo: 'esercizio', durata: 25 },
          { titolo: 'Correggi e approfondisci errori', tipo: 'ripasso', durata: 15 }
        ]
      },
      { 
        nome: 'Domande aperte', 
        micro: [
          { titolo: 'Scrivi 3 risposte aperte', tipo: 'esercizio', durata: 30 },
          { titolo: 'Confronta con modello ideale', tipo: 'ripasso', durata: 15 }
        ]
      },
      { 
        nome: 'Simulazione orale', 
        micro: [
          { titolo: 'Simula colloquio con domande', tipo: 'simulazione', durata: 25 },
          { titolo: 'Registrati e valuta', tipo: 'ripasso', durata: 15 }
        ]
      }
    ],
    applicativa: [
      { 
        nome: 'Teoria di base', 
        micro: [
          { titolo: 'Leggi concetti con esempi pratici', tipo: 'teoria', durata: 25 },
          { titolo: 'Prendi appunti su casi studio', tipo: 'teoria', durata: 20 }
        ]
      },
      { 
        nome: 'Casi pratici', 
        micro: [
          { titolo: 'Analisi caso reale', tipo: 'esercizio', durata: 30 },
          { titolo: 'Proposta soluzione alternativa', tipo: 'esercizio', durata: 20 }
        ]
      },
      { 
        nome: 'Esercizi applicativi', 
        micro: [
          { titolo: 'Esercizio con dati reali', tipo: 'esercizio', durata: 30 },
          { titolo: 'Discussione criticita', tipo: 'ripasso', durata: 15 }
        ]
      },
      { 
        nome: 'Analisi critica', 
        micro: [
          { titolo: 'Confronta 2 approcci diversi', tipo: 'teoria', durata: 25 },
          { titolo: 'Scegli e giustifica approccio', tipo: 'esercizio', durata: 20 }
        ]
      },
      { 
        nome: 'Discussione', 
        micro: [
          { titolo: 'Prepara argomentazione', tipo: 'teoria', durata: 20 },
          { titolo: 'Simula discussione', tipo: 'simulazione', durata: 20 }
        ]
      }
    ]
  }

  const topicsData = defaultTopics[categoria] || defaultTopics.scientifica

  for (const t of topicsData) {
    const { data: topic } = await supabase
      .from('topics')
      .insert({ exam_id: examId, nome_argomento: t.nome, peso: 3, ordine: 0 } as never)
      .select()
      .single()

    if (topic) {
      await supabase.from('subtopics').insert(
        t.micro.map((m, i) => ({
          topic_id: (topic as { id: string }).id,
          titolo: m.titolo,
          descrizione: m.titolo,
          tipo: m.tipo,
          durata_stimata: m.durata,
          ordine: i
        })) as never
      )

      await supabase.from('competences').insert({
        topic_id: (topic as { id: string }).id,
        teoria: 0,
        memoria: 0,
        esercizi: 0,
        problemi_complessi: 0,
        orale: 0
      } as never)
    }
  }
}
export async function reseedTopicsFromTemplate(
  examId: string,
  categoria: 'scientifica' | 'mnemonica' | 'applicativa'
) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  // Guard: non sovrascrivere se l'utente ha già delle sessioni di studio
  // registrate per questo esame — perderemmo le competenze accumulate.
  const { count: sessionCount, error: sessionError } = await supabase
    .from('study_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('exam_id', examId)

  if (sessionError) return { error: sessionError.message }
  if ((sessionCount ?? 0) > 0) {
    return {
      error:
        'Hai già delle sessioni di studio. Reseed non consentito per non perdere i progressi.',
    }
  }

  // Cancella i topic esistenti: subtopics e competences cascano via
  // ON DELETE CASCADE sui FK.
  const { error: delError } = await supabase
    .from('topics')
    .delete()
    .eq('exam_id', examId)

  if (delError) return { error: delError.message }

  await generateDefaultTopics(examId, categoria)

  revalidatePath(`/exam/${examId}`)
  revalidatePath('/dashboard')
  return { success: true }
}

export async function getExamSessionCount(examId: string) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { count: 0 }

  const { count, error } = await supabase
    .from('study_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('exam_id', examId)

  if (error) return { count: 0 }
  return { count: count ?? 0 }
}

// ============================================================
// getExamStudySessionSummary - returns count and total minutes of completed sessions
// ============================================================
export async function getExamStudySessionSummary(examId: string) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { count: 0, totalMinutes: 0 }

  const { data, error } = await supabase
    .from('study_sessions')
    .select('*')
    .eq('exam_id', examId)
    .eq('completata', true)

  if (error) {
    console.error('Error fetching study session summary:', error)
    return { count: 0, totalMinutes: 0 }
  }

  const sessions = (data ?? []) as StudySession[]
  const totalMinutes = sessions.reduce((sum, session) => sum + (session.durata_minuti || 0), 0)
  const count = sessions.length

  return { count, totalMinutes }
}

export async function addManualTopics(
  examId: string,
  topics: Array<{ nome: string; peso: number }>
) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  // Validazione input
  if (!Array.isArray(topics) || topics.length < 1 || topics.length > 12) {
    return { error: 'Inserisci tra 1 e 12 argomenti.' }
  }
  const cleaned = topics
    .map((t) => ({
      nome: (t.nome ?? '').toString().trim().slice(0, 100),
      peso: Math.min(5, Math.max(1, Number(t.peso) || 3)),
    }))
    .filter((t) => t.nome.length > 0)
  if (cleaned.length === 0) {
    return { error: 'Inserisci almeno un nome di argomento valido.' }
  }

  // Calcola ordine di append
  const { count: existingCount } = await supabase
    .from('topics')
    .select('id', { count: 'exact', head: true })
    .eq('exam_id', examId)
  const baseOrdine = existingCount ?? 0

  // Insert topics
  const { data: insertedTopics, error: insertError } = await supabase
    .from('topics')
    .insert(
      cleaned.map((t, i) => ({
        exam_id: examId,
        nome_argomento: t.nome,
        peso: t.peso,
        ordine: baseOrdine + i,
      })) as never
    )
    .select('id')

  if (insertError) return { error: insertError.message }

  const topicRows = (insertedTopics ?? []) as Array<{ id: string }>

  // Genera subtopic via NIM (dynamic import come in groq.ts:analyzeMaterialWithAI)
  const nim = await import('@/actions/nim')
  const settled = await Promise.allSettled(
    topicRows.map((t) => nim.generateSubtopicsForTopic(t.id, ''))
  )
  const failedCount = settled.filter((s) => s.status === 'rejected').length

  // Insert competences a zero per ogni nuovo topic
  await supabase.from('competences').insert(
    topicRows.map((t) => ({
      topic_id: t.id,
      teoria: 0,
      memoria: 0,
      esercizi: 0,
      problemi_complessi: 0,
      orale: 0,
    })) as never
  )

  revalidatePath(`/exam/${examId}`)
  revalidatePath('/dashboard')

  return {
    success: true,
    count: topicRows.length,
    partial: failedCount > 0,
    failedCount,
  }
}

export async function deleteExam(id: string) {
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('exams').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { success: true }
}