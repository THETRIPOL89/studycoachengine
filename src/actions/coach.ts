'use server'

import { createServerSupabase } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Topic, Competence, Exam } from '@/types/database'
import { generateSubtopicsForTopic } from '@/actions/nim'

export interface PlanActivity {
  attivita: string
  durata: number
  motivo: string
  topic_id: string | null
  subtopic_id: string | null  // ← NUOVO
  tipo_competenza: 'teoria' | 'memoria' | 'esercizi' | 'problemi_complessi' | 'orale'
  _debug?: {
    score: number
    avgComp: number
    risk: number
  }
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(1, diff)
}

function mapSubtipoToCompetenza(tipo: string): PlanActivity['tipo_competenza'] {
  switch (tipo) {
    case 'teoria': return 'teoria'
    case 'esercizio': return 'esercizi'
    case 'ripasso': return 'memoria'
    case 'simulazione': return 'orale'
    default: return 'teoria'
  }
}

export async function generateDailyPlan(examId: string, date: string) {
  const supabase = await createServerSupabase()

  const { data: exam } = await supabase
    .from('exams')
    .select('id, nome_esame, data_esame, voto_obiettivo, ore_giorno, preparazione_percentuale')
    .eq('id', examId)
    .single() as unknown as { data: Exam | null }

  const { data: topics } = await supabase
    .from('topics')
    .select('id, nome_argomento, peso, ordine, competences(teoria, memoria, esercizi, problemi_complessi, orale)')
    .eq('exam_id', examId) as unknown as { data: (Topic & { competences: Competence[] })[] | null }

  const topicsList = topics ?? []

  if (!exam) return { error: 'Esame non trovato' }
  if (topicsList.length === 0) return { error: 'Nessun argomento per questo esame' }

  // Carica subtopics per tutti i topics
  const subtopicsQuery = await supabase
    .from('subtopics')
    .select('id, topic_id, titolo, descrizione, tipo, durata_stimata, ordine')
    .in('topic_id', topicsList.map(t => t.id))
    .eq('completato', false)
    .order('ordine', { ascending: true }) as unknown as { data: {
      id: string
      topic_id: string
      titolo: string
      descrizione: string
      tipo: string
      durata_stimata: number
      ordine: number
    }[] | null }
  const allSubtopics = subtopicsQuery.data ?? []

  const subtopicsByTopic = new Map<string, NonNullable<typeof subtopicsQuery.data>>()
  if (allSubtopics.length > 0) {
    for (const st of allSubtopics) {
      if (!subtopicsByTopic.has(st.topic_id)) subtopicsByTopic.set(st.topic_id, [])
      subtopicsByTopic.get(st.topic_id)!.push(st)
    }
  }

  const giorniMancanti = daysUntil(exam.data_esame)
  const oreDisponibili = exam.ore_giorno * 60

  const activities: PlanActivity[] = []
  let remainingMinutes = oreDisponibili

  const scoredTopics = topicsList.map(t => {
    const c = t.competences?.[0] || { teoria: 0, memoria: 0, esercizi: 0, problemi_complessi: 0, orale: 0 }
    const avgComp = (c.teoria + c.memoria + c.esercizi + c.problemi_complessi + c.orale) / 5
    const urgency = exam.voto_obiettivo >= 27 ? 1.5 : 1.0
    const risk = Math.max(1, 100 - avgComp) / 100
    const score = (t.peso * risk * urgency) / Math.sqrt(giorniMancanti)
    return { ...t, avgComp, score, competences: c }
  }).sort((a, b) => b.score - a.score)

  // Identifica subito quali topic hanno bisogno di generazione subtopics.
  // Avviamo TUTTE le generazioni in parallelo (non appena entrano nel piano)
  // e aspettiamo TUTTE con un timeout condiviso, invece di serializzarle
  // una per una nel loop sottostante.
  type ScoredTopic = typeof scoredTopics[number]
  const top4: ScoredTopic[] = scoredTopics.slice(0, 4)
  const topicsNeedingGeneration: ScoredTopic[] = top4.filter(
    (t: ScoredTopic) => remainingMinutes > 10 && (subtopicsByTopic.get(t.id) || []).length === 0
  )

  const subtopicGenerationPromises = new Map<string, Promise<void>>()
  for (const topic of topicsNeedingGeneration) {
    const p = (async () => {
      try {
        await generateSubtopicsForTopic(topic.id, topic.nome_argomento)
      } catch (err) {
        console.warn('Subtopic generation failed for', topic.nome_argomento, err)
      }
    })()
    subtopicGenerationPromises.set(topic.id, p)
  }

  // Budget totale per la generazione subtopics: all'incirca una singola
  // chiamata NIM (12s + retry 4s = ~16s). Se una singola e lenta,
  // le altre in parallelo non aggiungono latenza.
  if (subtopicGenerationPromises.size > 0) {
    await Promise.race([
      Promise.all(Array.from(subtopicGenerationPromises.values())),
      new Promise(resolve => setTimeout(resolve, 18000))
    ])
  }

  // Cache locale dei subtopics freschi per evitare di rifare la query
  // per topic che li ha gia in memoria
  type FreshSub = {
    id: string
    topic_id: string
    titolo: string
    descrizione: string
    tipo: string
    durata_stimata: number
    ordine: number
  }
  const freshSubsByTopic = new Map<string, FreshSub[]>()
  function getSubsArray(topicId: string): FreshSub[] {
    const cached = freshSubsByTopic.get(topicId)
    if (cached) return cached
    return []
  }

  async function loadFreshSubs(topicId: string) {
    const { data } = await supabase
      .from('subtopics')
      .select('id, topic_id, titolo, descrizione, tipo, durata_stimata, ordine')
      .eq('topic_id', topicId)
      .eq('completato', false)
      .order('ordine', { ascending: true })
    freshSubsByTopic.set(topicId, (data as any) || [])
    return freshSubsByTopic.get(topicId)!
  }

  // Precarica i subtopics freschi in parallelo per i topic che hanno
  // appena finito la generazione
  await Promise.all(
    topicsNeedingGeneration.map((t: ScoredTopic) => loadFreshSubs(t.id).catch(() => []))
  )

  for (const topic of scoredTopics.slice(0, 4)) {
    if (remainingMinutes <= 10) break

    const subs = subtopicsByTopic.get(topic.id) || []

    // Se ci sono subtopics, usali (fino a 2 per topic)
    if (subs.length > 0) {
      for (const sub of subs.slice(0, 2)) {
        if (remainingMinutes <= 10) break

        const tipoComp = mapSubtipoToCompetenza(sub.tipo)
        const durata = Math.min(remainingMinutes, sub.durata_stimata || 25)

        const actionVerb = sub.tipo === 'teoria' ? 'Leggi' :
                          sub.tipo === 'esercizio' ? 'Esercizio' :
                          sub.tipo === 'simulazione' ? 'Simula' : 'Ripassa'

        activities.push({
          attivita: `${actionVerb}: ${sub.titolo}`,
          durata: durata,
          motivo: sub.descrizione || `${sub.tipo} su ${topic.nome_argomento}`,
          topic_id: topic.id,
          subtopic_id: sub.id,
          tipo_competenza: tipoComp,
          _debug: {
            score: Math.round(topic.score * 100),
            avgComp: Math.round(topic.avgComp),
            risk: Math.round((Math.max(1, 100 - topic.avgComp) / 100) * 100)
          }
        } as any)

        remainingMinutes -= durata
      }
    } else {
      // Subtopics appena generati (gia precaricati sopra)
      let subsToUse = getSubsArray(topic.id)

      if (subsToUse.length === 0) {
        // Fallback di emergenza: subtopic fittizio basato sul topic.
        // Usa un id deterministico (no Date.now) per evitare key React
        // che cambiano ad ogni render.
        subsToUse = [{
          id: `fallback-${topic.id}`,
          topic_id: topic.id,
          titolo: topic.nome_argomento,
          descrizione: `Studio generale di ${topic.nome_argomento}`,
          tipo: 'teoria',
          durata_stimata: 25,
          ordine: 0
        }]
      }

      for (const sub of subsToUse.slice(0, 2)) {
        if (remainingMinutes <= 10) break

        const tipoComp = mapSubtipoToCompetenza(sub.tipo)
        const durata = Math.min(remainingMinutes, sub.durata_stimata || 25)

        const actionVerb = sub.tipo === 'teoria' ? 'Leggi' :
                          sub.tipo === 'esercizio' ? 'Esercizio' :
                          sub.tipo === 'simulazione' ? 'Simula' : 'Ripassa'

        activities.push({
          attivita: `${actionVerb}: ${sub.titolo}`,
          durata: durata,
          motivo: sub.descrizione || `${sub.tipo} su ${topic.nome_argomento}`,
          topic_id: topic.id,
          subtopic_id: sub.id,
          tipo_competenza: tipoComp,
          _debug: {
            score: Math.round(topic.score * 100),
            avgComp: Math.round(topic.avgComp),
            risk: Math.round((Math.max(1, 100 - topic.avgComp) / 100) * 100)
          }
        } as any)

        remainingMinutes -= durata
      }
    }
  }

  if (remainingMinutes >= 15) {
    activities.push({
      attivita: 'Quiz di verifica generale',
      durata: remainingMinutes,
      motivo: 'Valutazione rapida dello stato di preparazione.',
      topic_id: null,
      subtopic_id: null,
      tipo_competenza: 'esercizi'
    })
  }

  const { error } = await (supabase
    .from('daily_plans')
    .upsert as any)({
      exam_id: examId,
      data: date,
      piano_json: activities,
      generato_ai: false
    }, { onConflict: 'exam_id,data' })

  if (error) {
    console.error('Upsert daily_plans error:', error)
    return { error: error.message }
  }

  revalidatePath(`/exam/${examId}`)
  return { success: true, plan: activities }
}

export async function getDailyPlan(examId: string, date: string) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('daily_plans')
    .select('*')
    .eq('exam_id', examId)
    .eq('data', date)
    .maybeSingle()

  if (error) {
    console.error('getDailyPlan error:', error)
    return { plan: null }
  }
  return { plan: data }
}

export async function markActivityComplete(examId: string, date: string, activityIndex: number) {
  const supabase = await createServerSupabase()

  const { data: plan, error: fetchError } = await supabase
    .from('daily_plans')
    .select('piano_json')
    .eq('exam_id', examId)
    .eq('data', date)
    .single() as unknown as { data: { piano_json: PlanActivity[] } | null; error: { message: string } | null }

  if (fetchError || !plan) return { error: 'Piano non trovato' }

  const activities = plan.piano_json
  if (!activities[activityIndex]) return { error: 'Attivita non valida' }

  const activity = activities[activityIndex]

  // Se c'è un subtopic, marchialo come completato
  if (activity.subtopic_id) {
    await supabase
      .from('subtopics')
      .update({ completato: true } as never)
      .eq('id', activity.subtopic_id)
  }

  activities[activityIndex] = { ...activities[activityIndex], completed: true } as any
  const allCompleted = activities.every((a: any) => a.completed)

  const { error } = await supabase
    .from('daily_plans')
    .update({
      piano_json: activities,
      completato: allCompleted
    } as never)
    .eq('exam_id', examId)
    .eq('data', date)

  if (error) return { error: error.message }
  revalidatePath(`/exam/${examId}`)
  return { success: true }
}
