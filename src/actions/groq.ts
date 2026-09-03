'use server'

import { createServerSupabase } from '@/lib/supabase'
import { checkRateLimit } from './rate-limit'
import { extractFirstJson, repairTruncatedJson } from './quiz-helpers'

const GROQ_API_KEY = process.env.GROQ_API_KEY
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'

// Groq e OpenAI-compatible (stesso formato di NIM/OpenRouter). Modello
// primario: openai/gpt-oss-120b — rilascio OpenAI "gpt-oss" hosted da Groq.
// Permettiamo override via env perche Groq ruota/modera i modelli free
// tier piu spesso di NIM. Scopri gli slug vivi con `discoverGroqModels()`
// o direttamente da https://console.groq.com/docs/models
const DEFAULT_MODEL = process.env.GROQ_DEFAULT_MODEL || 'openai/gpt-oss-120b'
const FAST_MODEL = process.env.GROQ_FAST_MODEL || 'openai/gpt-oss-120b'

const TIMEOUT_ERROR = 'AI request timeout - please try again'
const MODEL_RETIRED_PREFIX = 'AI_MODEL_RETIRED:'
// Groq segnala "model not found" (404) o "model decommissioned" quando uno
// slug viene ritirato. Catturiamo anche "model unavailable" per varianti
// del tier gratuito. Per l'utente e lo stesso shape del "model retired"
// NIM, cosi i caller (DailyPlan, MaterialUploader, StudyTimer) non cambiano.
const MODEL_RETIRED_PATTERN = /model\s+(not\s+found|decommissioned|unavailable)|no\s+available\s+model|free\s+model\s+rate\s+limit\s+exceeded/i

// Groq segnala "model has reached its end" o "model not found" (slug
// ritirato o non piu servito). Lo trasformiamo in un errore tipizzato con
// prefisso, cosi i caller possono reagire (suggerire `discoverGroqModels`)
// invece di trattarlo come un timeout generico.
function isModelRetiredError(e: any): boolean {
  const msg = e?.message || ''
  return msg.includes(MODEL_RETIRED_PREFIX) || MODEL_RETIRED_PATTERN.test(msg)
}

// Helper: rileva se un'eccezione e un timeout Groq (vs. un altro errore).
// Usato dai caller per scegliere tra fallback "degradato" e propagazione
// errore.
function isTimeoutError(e: any): boolean {
  return e?.message === TIMEOUT_ERROR || e?.message === 'Request timeout' || e?.name === 'AbortError'
}

// Parser JSON robusto. I modelli Groq (specialmente gpt-oss) emettono
// risposte "sporche": blocchi markdown ```json ... ```, testo esplicativo
// prima/dopo il JSON, risposte troncate perche max_tokens era basso.
// Proviamo in ordine:
//   1) JSON.parse diretto
//   2) extractFirstJson (scanner bracket-bilanciato, NON greedy)
//   3) extractFirstJson dopo aver riparato il truncamento
// Restituisce il JSON parsato oppure null.
function safeParseJSON<T = any>(text: string): T | null {
  if (!text) return null
  // 1) Tentativo diretto
  try {
    return JSON.parse(text) as T
  } catch {
    // continua
  }
  // 2) Estrai il primo blocco {} bilanciato (ignora prefisso/suffisso spurio)
  const extracted = extractFirstJson(text)
  if (extracted) {
    try {
      return JSON.parse(extracted) as T
    } catch {
      // continua: probabilmente troncato
    }
    // 3) Prova a riparare un JSON troncato
    try {
      const repaired = repairTruncatedJson(extracted)
      return JSON.parse(repaired) as T
    } catch {
      // fallisce anche questo
    }
  }
  return null
}

// Cache for AI responses (simple in-memory cache). Identica a nim/openrouter:
// chiave sul payload, TTL 1h, cap 150 entries. Vive nell'istanza del
// server, non e condivisa tra processi.
const aiResponseCache = new Map<string, { response: string; timestamp: number }>()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

// Helper to generate cache key from request parameters
function getCacheKey(messages: Array<{ role: string; content: string }>, options: {
  model?: string
  temperature?: number
  max_tokens?: number
  response_format?: { type: string }
}) {
  const keyParts = [
    JSON.stringify(messages),
    options.model || DEFAULT_MODEL,
    options.temperature ?? 0.2,
    options.max_tokens ?? 2048,
    JSON.stringify(options.response_format || {})
  ]
  return keyParts.join('|')
}

// Fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(id)
    return response
  } catch (err) {
    clearTimeout(id)
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timeout')
    }
    throw err
  }
}

interface GroqTopic {
  nome: string
  peso: number
}

// Strip chain-of-thought / "thinking" preambles che gpt-oss-120b puo
// emettere prima della risposta vera. Il modello restituisce cose tipo:
//   1. **Analyze User Input:**
//      - User says: "..."
//      - This seems like a prompt/instruction to me...
//   2. **Actual Response:**
//      <real answer>
// Vogliamo solo la risposta vera.
function stripThinking(text: string): string {
  if (!text) return text

  let cleaned = text

  // If there's a clear "Final" / "Answer" / "Response" / "Risposta" marker, keep only what follows
  const markerMatch = cleaned.match(/(?:\*\*|^|\n)\s*(?:final\s+answer|actual\s+response|risposta|answer|response|risposta\s+finale|spiegazione)\s*:?\s*[\*:\n]/i)
  if (markerMatch && markerMatch.index !== undefined) {
    cleaned = cleaned.slice(markerMatch.index + markerMatch[0].length)
  }

  // Drop leading "Analyze / Let me / First, / Breaking / Step 1:" reasoning lines
  cleaned = cleaned.replace(
    /^(?:\s*(?:\*\*)?\s*(?:\d+\.\s*)?(?:analyze|analizza|let me|i need to|first,?|breaking this down|step \d+:?|user says|this seems|they mention|the user wants)[^*:\n]*[\*:\n]?)[\s\S]*?(?=\n\s*\n|\n\s*\*\*\s*[A-Z]|\n\s*\d+\.\s*\*\*|$)/i,
    ''
  )

  // Drop leading numbered-list preamble (e.g. "1. **Analyze User Input:**\n  - ...\n  - ...\n\n2. **Actual Response:**\n  ...")
  const numberedBlock = cleaned.match(/^(\s*\d+\.\s*\*\*[^*\n]+\*\*[:\s][\s\S]*?)(?=\n\s*\d+\.\s*\*\*[A-Z][^*\n]*\*\*[:\s]|\n\n|$)/)
  if (numberedBlock && numberedBlock[1]) {
    const blockText = numberedBlock[1]
    // Only strip if the block looks like a "thinking" step (Analyze / Break down / Understand / Interpret)
    if (/analyze|analizza|interpret|understand|break|identify|determine|recognize|note/i.test(blockText)) {
      cleaned = cleaned.slice(blockText.length).trimStart()
    }
  }

  // Drop anything inside <think>...</think> tags (some models emit these)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

  // Collapse multiple blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim()

  // Fallback: if stripping left something tiny/empty, return original
  if (cleaned.length < 20 && text.length > 50) {
    return text.trim()
  }

  return cleaned
}

async function callGroq(options: {
  model?: string
  messages: Array<{ role: string; content: string }>
  temperature?: number
  max_tokens?: number
  response_format?: { type: string }
  timeout_ms?: number
  retries?: number
}) {
  if (!GROQ_API_KEY) {
    throw new Error(`${MODEL_RETIRED_PREFIX}slug='(no-key)' body=GROQ_API_KEY mancante in .env.local`)
  }

  // Check cache first
  const cacheKey = getCacheKey(options.messages, {
    model: options.model,
    temperature: options.temperature,
    max_tokens: options.max_tokens,
    response_format: options.response_format
  })

  const cached = aiResponseCache.get(cacheKey)
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.response
  }

  const maxRetries = Math.max(0, options.retries ?? 1)
  const baseTimeout = options.timeout_ms ?? 15000

  const attempt = async (attemptIndex = 0) => {
    const payload: any = {
      messages: options.messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.max_tokens ?? 2048,
      ...(options.response_format ? { response_format: options.response_format } : {}),
      model: options.model || DEFAULT_MODEL
    }

    // Each retry gets a bit more headroom for the timeout
    const timeoutMs = baseTimeout + attemptIndex * 4000

    try {
      const response = await fetchWithTimeout(
        `${GROQ_BASE_URL}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`
          },
          body: JSON.stringify(payload)
        },
        timeoutMs
      )

      if (!response.ok) {
        const errText = await response.text()
        const usedModel = options.model || DEFAULT_MODEL

        // Groq comunica "model not found" / "model decommissioned" / "model
        // unavailable" (slug ritirato o non servito per questa key). Non ha
        // senso fare retry sullo stesso modello: l'errore e permanente
        // finche l'utente non cambia GROQ_DEFAULT_MODEL / GROQ_FAST_MODEL.
        // Lo marchiamo con un prefisso riconoscibile e includiamo lo slug
        // usato cosi l'utente sa cosa correggere.
        if (MODEL_RETIRED_PATTERN.test(errText)) {
          throw new Error(`${MODEL_RETIRED_PREFIX}slug='${usedModel}' body=${errText}`)
        }
        // 404 esplicito: lo slug richiesto non esiste per questa API key.
        if (response.status === 404) {
          throw new Error(`${MODEL_RETIRED_PREFIX}slug='${usedModel}' body=${errText}`)
        }
        // Altri errori Groq: includiamo lo slug nel messaggio generico.
        throw new Error(`Groq Error ${response.status} (model='${usedModel}'): ${errText}`)
      }

      const result = await response.json()
      const content = result.choices?.[0]?.message?.content || ''

      // Cache the successful response
      aiResponseCache.set(cacheKey, {
        response: content,
        timestamp: Date.now()
      })

      // Clean old cache entries when cache gets too large
      if (aiResponseCache.size > 150) {
        const now = Date.now()
        for (const [key, value] of aiResponseCache.entries()) {
          if (now - value.timestamp > CACHE_TTL_MS) {
            aiResponseCache.delete(key)
          }
        }
        if (aiResponseCache.size > 150) {
          const sortedEntries = Array.from(aiResponseCache.entries()).sort(
            (a, b) => a[1].timestamp - b[1].timestamp
          )
          for (let i = 0; i < 50; i++) {
            aiResponseCache.delete(sortedEntries[i][0])
          }
        }
      }

      return content
    } catch (err: any) {
      const isTimeout = err.message === 'Request timeout' || err.name === 'AbortError'
      if (isTimeout && attemptIndex < maxRetries) {
        // Retry with a longer timeout
        return attempt(attemptIndex + 1)
      }
      if (isTimeout) {
        throw new Error(TIMEOUT_ERROR)
      }
      throw err
    }
  }
  return attempt(0)
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

  // Cast perché l'inferenza supabase-js v2 può collassare a `never` (vedi
  // workaround su src/actions/gemini.ts:373 e src/types/database.ts).
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
    const text = await callGroq({
      messages: [
        { role: 'system', content: 'Sei un tutor universitario esperto che risponde solo in JSON valido. Non mostrare processi di pensiero.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 320,
      timeout_ms: 20000,
      retries: 1
    })

    if (!text) return { error: 'Nessuna risposta da Groq' }

    const parsed = safeParseJSON<{ argomenti: GroqTopic[], sommario: string }>(text)
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
      // Le subtopics sono gestite da NIM anche quando l'analisi del
      // materiale e Groq. Il progetto ha deciso che NIM ha la qualita
      // piu alta nel parsing JSON strutturato per subtopics. Importiamo
      // dinamicamente da @/actions/nim per non creare un ciclo di
      // import statico tra groq.ts e nim.ts.
      const { generateSubtopicsForTopic } = await import('@/actions/nim')
      // Cast perché il tipo di insertedTopics e `never[]` (vedi workaround
      // sopra sul `.insert()`). Validato runtime da RLS.
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
        error: `Modello AI '${slug}' non più disponibile su Groq. Scegline uno attivo da https://console.groq.com/docs/models e impostalo come GROQ_DEFAULT_MODEL in .env.local.`,
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
    return { error: `Errore Groq: ${e.message}` }
  }
}

// NB: generateSubtopicsForTopic NON e esportato da groq.ts. Il progetto
// ha deciso che NIM (gpt-oss-20b) ha la qualita piu alta nel parsing
// JSON strutturato per le subtopics, quindi coach.ts e la chiamata
// interna di analyzeMaterialWithAI importano entrambi da @/actions/nim.
// Se esponessimo anche qui la stessa funzione, rischiamo che un import
// accidentale la chiami da Groq — meglio non duplicarla.

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
  // workaround su src/actions/gemini.ts:373 e src/types/database.ts).
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
    const text = await callGroq({
      model: FAST_MODEL,
      messages: [
        { role: 'system', content: 'Sei un professore universitario che crea quiz. Rispondi solo in JSON valido. Non mostrare processi di pensiero.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 640,
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
        error: `Modello AI '${slug}' non più disponibile su Groq. Impostane uno nuovo come GROQ_FAST_MODEL in .env.local.`,
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

  // Paywall: AI Tutor è una funzione Premium. Il checkRateLimit protegge
  // da DDoS; il checkPaywall protegge da free user che chiamano la funzione.
  const { checkPaywall } = await import('./subscription')
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  const paywall = await checkPaywall('ai_tutor')
  if (!paywall.allowed) {
    if ('code' in paywall) {
      return { error: 'AI Tutor è una funzione Premium. Passa a Premium per sbloccarlo.', code: paywall.code, reason: paywall.reason }
    }
    return { error: paywall.error }
  }

  const levelPrompts = {
    guida: `Lo studente sta studiando: "${topic}".\nFai SOLO 2-3 domande guida che lo aiutino a ragionare, senza dare la soluzione. Rispondi in italiano. Niente premesse, niente analisi del prompt: vai diretto alle domande.`,
    suggerimento: `Lo studente sta studiando: "${topic}".\nDai 2-3 suggerimenti utili e brevi che lo indirizzino senza rivelare la soluzione completa. Rispondi in italiano. Niente premesse, niente analisi del prompt: vai diretto ai suggerimenti.`,
    completo: `Lo studente sta studiando: "${topic}".\nSpiega il concetto in modo chiaro e conciso (max 4-5 frasi), con un esempio pratico. Rispondi in italiano. Niente premesse, niente analisi del prompt: vai diretto alla spiegazione.`
  }

  const maxTokens = level === 'completo' ? 384 : 320

  try {
    const text = await callGroq({
      model: FAST_MODEL,
      messages: [
        { role: 'system', content: 'Sei un tutor universitario. Rispondi SOLO con la risposta finale, in italiano, in modo breve e diretto. Non analizzare il prompt, non elencare passaggi, non mostrare ragionamenti interni. Vai dritto al contenuto utile per lo studente.\n\nFORMATTING MATEMATICO: quando introduci formule, espressioni, equazioni o simboli matematici, scrivili SEMPRE in LaTeX. Usa $...$ per formule inline (es. $E = mc^2$) e $$...$$ per formule in display/centrate (es. $$\\nabla \\cdot \\vec{E} = \\frac{\\rho}{\\varepsilon_0}$$). Non usare notazione ASCII tipo "a^2 + b^2 = c^2": scrivi "$a^2 + b^2 = c^2$". Le formule renderizzate correttamente sono essenziali per lo studente.' },
        { role: 'user', content: levelPrompts[level] }
      ],
      temperature: 0.1,
      max_tokens: maxTokens
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
        error: `Modello AI '${slug}' non più disponibile su Groq. Impostane uno nuovo come GROQ_FAST_MODEL in .env.local.`,
        modelRetired: true,
        modelSlug: slug
      }
    }
    return { error: e.message }
  }
}

// Helpers pubblici per diagnostica e gestione modelli.
// Ritorna la lista di modelli attualmente disponibili per la API key
// dell'utente. Utile quando Groq decommissa/ritira uno slug e il modello
// scelto va in pensione ("model decommissioned").
export async function discoverGroqModels() {
  if (!GROQ_API_KEY) {
    return { error: 'GROQ_API_KEY mancante in .env.local' }
  }
  try {
    const res = await fetch(`${GROQ_BASE_URL}/models`, {
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` },
      cache: 'no-store'
    })
    if (!res.ok) {
      return { error: `Groq /models ha risposto ${res.status}` }
    }
    const json = await res.json()
    const ids: string[] = (json?.data || []).map((m: any) => m.id).filter(Boolean)

    // Evidenziamo i modelli che fanno al caso nostro (Llama, Mixtral,
    // Gemma, gpt-oss) per renderli facili da trovare.
    const recommended = ids.filter(id =>
      /llama|mixtral|gemma|gpt-oss|whisper/i.test(id)
    )

    return {
      success: true,
      total: ids.length,
      recommended,
      all: ids.sort()
    }
  } catch (e: any) {
    return { error: `Impossibile contattare Groq /models: ${e.message}` }
  }
}
