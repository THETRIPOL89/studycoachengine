'use server'

import { createServerSupabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { Exam, Topic } from '@/types/database'
import { checkPaywall } from '@/actions/subscription'

export async function getExams() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { exams: [] }

  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .eq('user_id', user.id)
    .eq('stato', 'in_corso')
    .order('data_esame', { ascending: true })

  if (error) {
    console.error('Error fetching exams:', error)
    return { exams: [] }
  }

  return { exams: data as Exam[] }
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

  // Paywall: i free user possono avere 1 solo esame attivo. Se ne hanno
  // già uno, blocchiamo la creazione e ritorniamo un codice strutturato
  // che il client intercetta per aprire il PaywallModal.
  const paywall = await checkPaywall('exam')
  if (!paywall.allowed) {
    if ('code' in paywall) {
      return { error: 'Hai già un esame attivo. Passa a Premium per averne illimitati.', code: paywall.code, reason: paywall.reason }
    }
    return { error: paywall.error }
  }

  const examData = {
    user_id: user.id,
    nome_esame: formData.get('nome_esame') as string,
    universita: formData.get('universita') as string,
    corso: formData.get('corso') as string,
    professore: formData.get('professore') as string || null,
    data_esame: formData.get('data_esame') as string,
    voto_obiettivo: parseInt(formData.get('voto_obiettivo') as string),
    modalita: formData.get('modalita') as 'scritto' | 'orale' | 'misto' | null,
    ore_giorno: parseInt(formData.get('ore_giorno') as string) || 2,
    categoria: formData.get('categoria') as 'scientifica' | 'mnemonica' | 'applicativa' || 'scientifica'
  }

  // Workaround: l'inferenza supabase-js v2 su `from('exams').insert(...)`
  // collassa il parametro a `never[]` quando l'utente non ha un profile
  // valido (auth transitorio) o quando il type `Database` ha shapes
  // complesse. I dati sono comunque validati runtime da RLS + check
  // constraints del DB. Vedere src/types/database.ts per il commento.
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
export async function deleteExam(id: string) {
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('exams').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { success: true }
}