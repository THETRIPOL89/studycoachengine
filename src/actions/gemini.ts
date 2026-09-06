'use server'

import { createServerSupabase } from '@/lib/supabase'
import { checkRateLimit } from './rate-limit'
import { extractFirstJson, repairTruncatedJson } from './quiz-helpers'
import { GoogleGenAI } from '@google/genai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
// Google AI Studio (https://aistudio.google.com/app/apikey), free tier.
// Modello unico per default e fast: gemini-3.7-flash segue bene i prompt
// JSON-strict e risponde in italiano senza thinking esplicito. Permettiamo
// override via env se l'utente vuole sperimentare (es. gemini-2.5-flash).
const DEFAULT_MODEL = process.env.GEMINI_DEFAULT_MODEL || 'gemini-3.7-flash'
const FAST_MODEL = process.env.GEMINI_FAST_MODEL || 'gemini-3.7-flash'
// Fallback di emergenza per quando il modello primario risponde 503
// (Service Unavailable) o altri errori transienti (500/502/504, 429 rate
// limit). gemini-2.5-flash e storicamente piu stabile sul free tier.
// Non sovrascrivibile via env perche e un safety net, non una preferenza.
const FALLBACK_MODEL = 'gemini-2.5-flash'

const TIMEOUT_ERROR = 'AI request timeout - please try again'
// Stesso prefisso usato da nim.ts / openrouter.ts cosi i banner italiani
// esistenti (es. in DailyPlan, MaterialUploader) continuano a funzionare
// senza modifiche lato caller.
const MODEL_RETIRED_PREFIX = 'AI_MODEL_RETIRED:'
// Gemini risponde con 400 + "models/<slug> is not found for ... API" oppure
// 404 quando lo slug non esiste o non e abilitato per la key dell'utente.
// Catturiamo anche "model not found" / "unsupported model" per varianti
// regionali / Vertex.
const MODEL_RETIRED_PATTERN = /is not found for .* API|model not found|unsupported model|NOT_FOUND/i

// Client SDK singleton. Il costruttore accetta { apiKey } o { vertexai: true }.
// In assenza di key il costruttore non lancia ma ogni chiamata fallira; meglio
// intercettare in callGemini con un errore tipizzato.
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null

function isModelRetiredError(e: any): boolean {
  const msg = e?.message || ''
  return msg.includes(MODEL_RETIRED_PREFIX) || MODEL_RETIRED_PATTERN.test(msg)
}

function isTimeoutError(e: any): boolean {
  return e?.message === TIMEOUT_ERROR || e?.message === 'Request timeout' || e?.name === 'AbortError'
}

// Parser JSON robusto. Gemini risponde bene ai prompt JSON-strict (soprattutto
// con responseMimeType: application/json), ma come safety net usiamo lo
// stesso fallback di nim/openrouter: JSON.parse diretto, poi
// extractFirstJson (scanner bracket-bilanciato), poi repairTruncatedJson.
function safeParseJSON<T = any>(text: string): T | null {
  if (!text) return null
  try {
    return JSON.parse(text) as T
  } catch {
    // continua
  }
  const extracted = extractFirstJson(text)
  if (extracted) {
    try {
      return JSON.parse(extracted) as T
    } catch {
      // continua: probabilmente troncato
    }
    try {
      const repaired = repairTruncatedJson(extracted)
      return JSON.parse(repaired) as T
    } catch {
      // fallisce anche questo
    }
  }
  return null
}

// Cache in-memory. Identica a nim/openrouter: chiave sul payload, TTL 1h,
// cap 150 entries. Vive nell'istanza del server, non e condivisa tra processi.
const aiResponseCache = new Map<string, { response: string; timestamp: number }>()
const CACHE_TTL_MS = 60 * 60 * 1000

function getCacheKey(contents: any, systemInstruction: string | undefined, options: {
  model?: string
  temperature?: number
  maxOutputTokens?: number
  responseMimeType?: string
}) {
  const keyParts = [
    JSON.stringify(contents),
    systemInstruction || '',
    options.model || DEFAULT_MODEL,
    options.temperature ?? 0.2,
    options.maxOutputTokens ?? 2048,
    options.responseMimeType || ''
  ]
  return keyParts.join('|')
}

// Fetch con timeout via AbortSignal. Il SDK accetta un AbortSignal in
// config.httpOptions, ma usarlo come signal del controller nostro ci da
// piu controllo sulla semantica di retry.
async function withTimeout<T>(promiseFactory: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await promiseFactory(controller.signal)
  } catch (err: any) {
    if (err?.name === 'AbortError' || controller.signal.aborted) {
      throw new Error('Request timeout')
    }
    throw err
  } finally {
    clearTimeout(id)
  }
}

interface GeminiTopic {
  nome: string
  peso: number
}

// Strip chain-of-thought / "thinking" preambles. Gemini Flash raramente emette
// CoT esplicito nei contenuti di testo, ma se l'utente disabilita
// thinkingConfig o attiva un modello piu ragionante, il modello puo premettere
// "Analyze / Let me think / First, ..." prima della risposta. Stessa logica
// di nim/openrouter.
function stripThinking(text: string): string {
  if (!text) return text

  let cleaned = text

  const markerMatch = cleaned.match(/(?:\*\*|^|\n)\s*(?:final\s+answer|actual\s+response|risposta|answer|response|risposta\s+finale|spiegazione)\s*:?\s*[\*:\n]/i)
  if (markerMatch && markerMatch.index !== undefined) {
    cleaned = cleaned.slice(markerMatch.index + markerMatch[0].length)
  }

  cleaned = cleaned.replace(
    /^(?:\s*(?:\*\*)?\s*(?:\d+\.\s*)?(?:analyze|analizza|let me|i need to|first,?|breaking this down|step \d+:?|user says|this seems|they mention|the user wants)[^*:\n]*[\*:\n]?)[\s\S]*?(?=\n\s*\n|\n\s*\*\*\s*[A-Z]|\n\s*\d+\.\s*\*\*|$)/i,
    ''
  )

  const numberedBlock = cleaned.match(/^(\s*\d+\.\s*\*\*[^*\n]+\*\*[:\s][\s\S]*?)(?=\n\s*\d+\.\s*\*\*[A-Z][^*\n]*\*\*[:\s]|\n\n|$)/)
  if (numberedBlock && numberedBlock[1]) {
    const blockText = numberedBlock[1]
    if (/analyze|analizza|interpret|understand|break|identify|determine|recognize|note/i.test(blockText)) {
      cleaned = cleaned.slice(blockText.length).trimStart()
    }
  }

  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim()

  if (cleaned.length < 20 && text.length > 50) {
    return text.trim()
  }

  return cleaned
}

async function callGemini(options: {
  model?: string
  contents: string
  systemInstruction?: string
  temperature?: number
  maxOutputTokens?: number
  responseMimeType?: 'text/plain' | 'application/json'
  jsonMode?: boolean
  timeout_ms?: number
  retries?: number
}): Promise<string> {
  if (!ai || !GEMINI_API_KEY) {
    throw new Error(`${MODEL_RETIRED_PREFIX}slug='(no-key)' body=GEMINI_API_KEY mancante in .env.local`)
  }

  const useJsonMode = options.jsonMode || options.responseMimeType === 'application/json'
  const cacheKey = getCacheKey(
    options.contents,
    options.systemInstruction,
    {
      model: options.model,
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens,
      responseMimeType: useJsonMode ? 'application/json' : 'text/plain'
    }
  )
  const cached = aiResponseCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.response
  }

  const maxRetries = Math.max(0, options.retries ?? 1)
  const baseTimeout = options.timeout_ms ?? 15000

  // attempt() puo essere chiamato in due modalita:
  // - normale: usa il modello richiesto (o DEFAULT_MODEL)
  // - fallback: usa FALLBACK_MODEL (gemini-2.5-flash) dopo un errore
  //   transient (503/500/502/504/429) sul modello primario.
  // `primaryTried` impedisce di ciclare all'infinito se anche il
  // fallback fallisce (a quel punto propaghiamo l'errore).
  const attempt = async (attemptIndex: number, primaryTried: boolean): Promise<string> => {
    const timeoutMs = baseTimeout + attemptIndex * 4000
    const usingFallback = primaryTried
    const usedModel = usingFallback
      ? FALLBACK_MODEL
      : (options.model || DEFAULT_MODEL)

    try {
      const response = await withTimeout(
        (signal) => ai!.models.generateContent({
          model: usedModel,
          contents: options.contents,
          config: {
            ...(options.systemInstruction ? { systemInstruction: options.systemInstruction } : {}),
            ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
            ...(options.maxOutputTokens !== undefined ? { maxOutputTokens: options.maxOutputTokens } : {}),
            ...(useJsonMode ? { responseMimeType: 'application/json' } : {}),
            abortSignal: signal
          }
        }),
        timeoutMs
      )

      const content = response?.text || ''

      if (!content) {
        // Il modello ha risposto 200 ma senza testo. Mappiamo a
        // MODEL_RETIRED solo se il finishReason lo suggerisce, altrimenti
        // un errore generico.
        const finishReason = response?.candidates?.[0]?.finishReason
        if (finishReason && /SAFETY|RECITATION|OTHER/i.test(finishReason)) {
          throw new Error(`Gemini ha rifiutato la risposta (finishReason=${finishReason})`)
        }
        throw new Error('Gemini ha restituito una risposta vuota')
      }

      // Cache
      aiResponseCache.set(cacheKey, { response: content, timestamp: Date.now() })
      if (aiResponseCache.size > 150) {
        const now = Date.now()
        for (const [key, value] of aiResponseCache.entries()) {
          if (now - value.timestamp > CACHE_TTL_MS) aiResponseCache.delete(key)
        }
        if (aiResponseCache.size > 150) {
          const sorted = Array.from(aiResponseCache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp)
          for (let i = 0; i < 50; i++) aiResponseCache.delete(sorted[i][0])
        }
      }

      return content
    } catch (err: any) {
      // 1) timeout: ritenta con piu headroom, poi alza l'errore tipizzato
      if (err?.message === 'Request timeout' || err?.name === 'AbortError') {
        if (attemptIndex < maxRetries) return attempt(attemptIndex + 1, primaryTried)
        throw new Error(TIMEOUT_ERROR)
      }

      // 2) Modello non valido / non abilitato / ritirato: mappiamo al
      // prefisso AI_MODEL_RETIRED: per il banner italiano dei caller.
      // NON facciamo fallback in questo caso: se lo slug primario non
      // esiste, e molto probabile che anche il fallback non esista (stessa
      // API key), e vogliamo che l'utente veda il banner.
      const msg: string = (err?.message || String(err)) ?? ''
      if (MODEL_RETIRED_PATTERN.test(msg) || /status\s*[:=]\s*400|status\s*[:=]\s*404/i.test(msg)) {
        throw new Error(`${MODEL_RETIRED_PREFIX}slug='${usedModel}' body=${msg}`)
      }
      // Il SDK incapsula gli errori API in ApiError. 400/404 senza il
      // pattern sopra vanno comunque segnalati come "modello non disponibile"
      // (Gemini risponde 400 per slug invalidi, non 404 puro).
      if (err?.status === 400 || err?.status === 404) {
        throw new Error(`${MODEL_RETIRED_PREFIX}slug='${usedModel}' body=${msg}`)
      }
      // 401/403 = problemi di autenticazione: anche qui niente fallback,
      // e inutile riprovare con un altro modello con la stessa key.
      if (err?.status === 401 || err?.status === 403) {
        throw err
      }

      // 3) Errori transienti: 429 (rate limit), 500, 502, 503, 504.
      // Se non abbiamo ancora provato il fallback, lo proviamo UNA volta.
      // Se il fallback e gia in uso (o ha fallito), propaghiamo l'errore
      // con un messaggio che menziona il modello usato cosi il banner
      // italiano del caller e utile.
      const status = err?.status
      const isTransient =
        status === 429 || status === 500 || status === 502 || status === 503 || status === 504 ||
        /UNAVAILABLE|Service Unavailable|Internal Server Error|rate limit|overloaded|try again later/i.test(msg)

      if (isTransient && !primaryTried) {
        console.warn(`[gemini] ${usedModel} ha risposto ${status ?? 'transient error'}, riprovo su ${FALLBACK_MODEL}`)
        return attempt(0, true)
      }
      if (isTransient && primaryTried) {
        // Anche il fallback ha fallito. Alza un errore tipizzato cosi i
        // caller mostrano il banner corretto.
        throw new Error(`Errore Gemini: sia ${options.model || DEFAULT_MODEL} che ${FALLBACK_MODEL} non disponibili (${status ?? 'transient'}). Riprova tra poco.`)
      }
      throw err
    }
  }

  return attempt(0, false)
}

export async function analyzeMaterialWithAI(examId: string, materialId: string) {
  const rate = await checkRateLimit('analyze_material')
  if (!rate.allowed) return { error: rate.error }

  const supabase = await createServerSupabase()

  const { data: material } = await supabase
    .from('materials')
    .select('*')
    .eq('id', materialId)
    .single()

  if (!material) return { error: 'Materiale non trovato' }

  // Cast perché l'inferenza supabase-js v2 può collassare a `never` per via
  // del vincolo GenericTable sul Database type (vedi src/types/database.ts).
  const mat = material as { tipo: string; nome_file: string; exam_id: string }

  const prompt = `Sei un tutor universitario esperto. Uno studente sta preparando un esame universitario e ha caricato un documento di tipo ${mat.tipo.toUpperCase()} chiamato "${mat.nome_file}".

ESTRARRE:
1. La lista degli argomenti principali che tipicamente si trovano in un documento di questo tipo per l'esame specificato
2. Per ogni argomento, assegna un peso di importanza da 1 a 5 (5 = fondamentale per l'esame)

REQUISITI:
- Identifica SOLO argomenti rilevanti per un esame universitario
- Raggruppa sotto-argomenti correlati in macro-argomenti
- Limitati a 5-8 argomenti principali
- I pesi devono riflettere l'importanza tipica nel programma

RISPONDI SOLO con un JSON valido nel formato:
{
  "argomenti": [
    {"nome": "Nome argomento", "peso": 4},
    ...
  ],
  "sommario": "Breve descrizione di cosa tratta il documento (max 200 caratteri)"
}`

  try {
    const text = await callGemini({
      contents: prompt,
      systemInstruction: 'Sei un tutor universitario esperto che risponde solo in JSON valido. Non mostrare processi di pensiero.',
      temperature: 0.1,
      maxOutputTokens: 320,
      jsonMode: true,
      timeout_ms: 20000,
      retries: 1
    })

    if (!text) return { error: 'Nessuna risposta da Google AI Studio' }

    const parsed = safeParseJSON<{ argomenti: GeminiTopic[], sommario: string }>(text)
    if (!parsed || !Array.isArray(parsed.argomenti)) {
      return {
        success: false,
        degraded: true,
        error: 'AI ha risposto in un formato non leggibile. Riprova.',
        topics: [],
        sommario: ''
      }
    }

    await supabase.from('topics').delete().eq('exam_id', examId)

    const topicsToInsert = parsed.argomenti.map((a, i) => ({
      exam_id: examId,
      nome_argomento: a.nome,
      peso: Math.min(5, Math.max(1, a.peso)),
      ordine: i
    }))

    // Workaround: l'inferenza supabase-js v2 su `from('topics').insert(...)`
    // collassa il parametro a `never[]` per via del vincolo GenericTable
    // sul Database type (vedi src/types/database.ts). Validato runtime da RLS
    // e check constraints del DB.
    const { data: insertedTopics, error: insertError } = await supabase
      .from('topics')
      .insert(topicsToInsert as never)
      .select()

    if (insertError) return { error: insertError.message }

    if (insertedTopics) {
      const { generateSubtopicsForTopic } = await import('./gemini')
      // Cast perché il tipo di insertedTopics collassa a `never[]` (vedi
      // workaround sopra sul `.insert()`). Validato runtime da RLS.
      const topics = insertedTopics as Array<{ id: string; nome_argomento: string }>
      await Promise.all(
        topics.map(topic =>
          generateSubtopicsForTopic(topic.id, topic.nome_argomento)
        )
      )

      const competences = topics.map(t => ({
        topic_id: t.id,
        teoria: 0,
        memoria: 0,
        esercizi: 0,
        problemi_complessi: 0,
        orale: 0
      }))
      // Workaround: stessa inferenza collassata di sopra. Validato runtime.
      await supabase.from('competences').insert(competences as never)
    }

    return {
      success: true,
      topics: parsed.argomenti,
      sommario: parsed.sommario
    }

  } catch (e: any) {
    if (isModelRetiredError(e)) {
      const slugMatch = e.message.match(/slug='([^']+)'/)
      const slug = slugMatch ? slugMatch[1] : '?'
      return {
        success: false,
        error: `Modello AI '${slug}' non disponibile su Google AI Studio. Scegline uno attivo da https://aistudio.google.com/app/apikey e impostalo come GEMINI_DEFAULT_MODEL in .env.local.`,
        modelRetired: true,
        modelSlug: slug
      }
    }
    if (isTimeoutError(e)) {
      return {
        success: false,
        degraded: true,
        error: 'AI temporaneamente non disponibile. Riprova o aggiungi argomenti manualmente.',
        topics: [],
        sommario: ''
      }
    }
    return { error: `Errore Gemini: ${e.message}` }
  }
}

export async function generateSubtopicsForTopic(topicId: string, topicName: string) {
  const rate = await checkRateLimit('generate_subtopics')
  if (!rate.allowed) return { error: rate.error }

  const supabase = await createServerSupabase()

  const subPrompt = `Sei un professore universitario. Dato l'argomento "${topicName}", dividilo in 4-6 micro-argomenti sequenziali per uno studente che studia autonomamente.

Per ogni micro-argomento specifica:
- titolo: nome conciso (max 60 caratteri)
- descrizione: cosa fare in questa sessione (max 120 caratteri)
- tipo: "teoria" | "esercizio" | "ripasso"
- durata_stimata: minuti (15, 20, 25 o 30)

REQUISITI:
- Deve essere una sequenza logica: prima teoria, poi esercizi, poi ripasso
- Non ripetere titoli generici come "Introduzione" o "Conclusione"
- Sii specifico: "Risolvi problema buca di potenziale 1D" invece di "Fai esercizi"

RISPONDI SOLO con JSON valido:
{
  "micro": [
    {"titolo": "...", "descrizione": "...", "tipo": "teoria", "durata_stimata": 20},
    ...
  ]
}`

  try {
    const subText = await callGemini({
      contents: subPrompt,
      systemInstruction: 'Sei un professore universitario che risponde solo in JSON valido. Non mostrare processi di pensiero.',
      temperature: 0.1,
      maxOutputTokens: 320,
      jsonMode: true,
      timeout_ms: 12000,
      retries: 1
    })

    if (subText) {
      const subParsed = safeParseJSON<{ micro: any[] }>(subText)
      if (!subParsed || !Array.isArray(subParsed.micro)) {
        return {
          error: 'Risposta AI non parsabile',
          degraded: true
        }
      }

      const subtopicsToInsert = (subParsed.micro || []).map((m: any, idx: number) => ({
        topic_id: topicId,
        titolo: m.titolo,
        descrizione: m.descrizione,
        tipo: ['teoria', 'esercizio', 'ripasso', 'simulazione'].includes(m.tipo) ? m.tipo : 'teoria',
        durata_stimata: Math.min(60, Math.max(10, m.durata_stimata || 20)),
        ordine: idx
      }))

      if (subtopicsToInsert.length > 0) {
        // Workaround: stessa inferenza collassata di sopra. Validato runtime.
        await supabase.from('subtopics').insert(subtopicsToInsert as never)
      }
    }

    return { success: true }
  } catch (e: any) {
    console.warn('Subtopics generation degraded for', topicName, '-', e.message)
    return { error: e.message, degraded: true }
  }
}

export async function generateQuizFromMaterial(examId: string, topicId: string, difficulty: 'easy' | 'medium' | 'hard' = 'medium') {
  const rate = await checkRateLimit('generate_quiz')
  if (!rate.allowed) return { error: rate.error }

  const supabase = await createServerSupabase()

  const { data: topic } = await supabase
    .from('topics')
    .select('*')
    .eq('id', topicId)
    .single()

  if (!topic) return { error: 'Argomento non trovato' }

  // Cast perché l'inferenza supabase-js v2 può collassare a `never` (vedi
  // src/types/database.ts e workaround sopra).
  const t = topic as { nome_argomento: string }

  const prompt = `Genera un quiz universitario sull'argomento: "${t.nome_argomento}".

Difficolta: ${difficulty}

REQUISITI:
- 5 domande a risposta multipla
- Per ogni domanda: testo, 4 opzioni, indice della risposta corretta (0-3), spiegazione breve
- Le domande devono essere realistiche per un esame universitario
- Mescola teoria e applicazione

RISPONDI SOLO con JSON:
{
  "domande": [
    {
      "testo": "...",
      "opzioni": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "risposta_corretta": 0,
      "spiegazione": "..."
    }
  ]
}`

  try {
    const text = await callGemini({
      model: FAST_MODEL,
      contents: prompt,
      systemInstruction: 'Sei un professore universitario che crea quiz. Rispondi solo in JSON valido. Non mostrare processi di pensiero.',
      temperature: 0.2,
      maxOutputTokens: 640,
      jsonMode: true,
      timeout_ms: 25000,
      retries: 1
    })

    if (!text) return { error: 'Nessuna risposta' }

    const parsed = safeParseJSON<{ domande: any[] }>(text)
    if (!parsed || !Array.isArray(parsed.domande)) {
      return {
        success: false,
        degraded: true,
        error: 'Quiz non generabile (risposta AI non valida). Riprova.'
      }
    }
    return { success: true, quiz: parsed.domande }

  } catch (e: any) {
    if (isModelRetiredError(e)) {
      const slugMatch = e.message.match(/slug='([^']+)'/)
      const slug = slugMatch ? slugMatch[1] : '?'
      return {
        success: false,
        error: `Modello AI '${slug}' non disponibile su Google AI Studio. Impostane uno nuovo come GEMINI_FAST_MODEL in .env.local.`,
        modelRetired: true,
        modelSlug: slug
      }
    }
    if (isTimeoutError(e)) {
      return {
        success: false,
        degraded: true,
        error: 'Quiz non disponibile adesso, riprova tra poco.'
      }
    }
    return { error: e.message }
  }
}

export async function explainConcept(topic: string, level: 'guida' | 'suggerimento' | 'completo') {
  const rate = await checkRateLimit('explain_concept')
  if (!rate.allowed) return { error: rate.error }

  const levelPrompts = {
    guida: `Lo studente sta studiando: "${topic}".\nFai SOLO 2-3 domande guida che lo aiutino a ragionare, senza dare la soluzione. Rispondi in italiano. Niente premesse, niente analisi del prompt: vai diretto alle domande.`,
    suggerimento: `Lo studente sta studiando: "${topic}".\nDai 2-3 suggerimenti utili e brevi che lo indirizzino senza rivelare la soluzione completa. Rispondi in italiano. Niente premesse, niente analisi del prompt: vai diretto ai suggerimenti.`,
    completo: `Lo studente sta studiando: "${topic}".\nSpiega il concetto in modo chiaro e conciso (max 4-5 frasi), con un esempio pratico. Rispondi in italiano. Niente premesse, niente analisi del prompt: vai diretto alla spiegazione.`
  }

  const maxTokens = level === 'completo' ? 384 : 320

  try {
    const text = await callGemini({
      model: FAST_MODEL,
      contents: levelPrompts[level],
      systemInstruction: 'Sei un tutor universitario. Rispondi SOLO con la risposta finale, in italiano, in modo breve e diretto. Non analizzare il prompt, non elencare passaggi, non mostrare ragionamenti interni. Vai dritto al contenuto utile per lo studente.',
      temperature: 0.1,
      maxOutputTokens: maxTokens
    })

    const cleaned = stripThinking(text || '')
    return { success: true, explanation: cleaned || 'Nessuna risposta' }

  } catch (e: any) {
    if (isTimeoutError(e)) {
      return {
        success: true,
        degraded: true,
        explanation: 'L\'AI sta impiegando troppo tempo. Puoi riprovare tra qualche secondo o consultare il tuo materiale.'
      }
    }
    if (isModelRetiredError(e)) {
      const slugMatch = e.message.match(/slug='([^']+)'/)
      const slug = slugMatch ? slugMatch[1] : '?'
      return {
        success: false,
        error: `Modello AI '${slug}' non disponibile su Google AI Studio. Impostane uno nuovo come GEMINI_FAST_MODEL in .env.local.`,
        modelRetired: true,
        modelSlug: slug
      }
    }
    return { error: e.message }
  }
}

// Helpers pubblici per diagnostica e gestione modelli.
// Ritorna la lista dei modelli Gemini attualmente disponibili per la API
// key dell'utente. Utile quando Google ruota gli slug o se il modello
// scelto non e abilitato per la key gratuita.
export async function discoverGeminiModels() {
  if (!ai || !GEMINI_API_KEY) {
    return { error: 'GEMINI_API_KEY mancante in .env.local' }
  }
  try {
    // La SDK espone ai.models.list() per i modelli disponibili
    const pager = await (ai as any).models.list()
    // Gestiamo sia un AsyncIterable sia una risposta con .models
    const all: any[] = []
    if (pager && typeof pager[Symbol.asyncIterator] === 'function') {
      for await (const m of pager) all.push(m)
    } else if (pager?.models) {
      all.push(...pager.models)
    } else if (Array.isArray(pager)) {
      all.push(...pager)
    }

    const ids: string[] = all
      .map((m: any) => m?.name || m?.id || '')
      .filter(Boolean)
      .map((s: string) => s.replace(/^models\//, ''))

    // Evidenziamo i modelli che fanno al caso nostro per renderli facili
    // da trovare (gemini-3 / 2.5 / 2.0 flash + pro).
    const recommended = ids.filter(id =>
      /^gemini-(3\.|2\.5|2\.0)/i.test(id) && /flash|pro|nano/i.test(id)
    )

    return {
      success: true,
      total: ids.length,
      recommended,
      all: ids.sort()
    }
  } catch (e: any) {
    return { error: `Impossibile contattare Google AI Studio /models: ${e.message}` }
  }
}
