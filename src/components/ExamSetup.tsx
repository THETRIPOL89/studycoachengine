'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { addManualTopics } from '@/actions/exams'
import { seedExamTopicsFromTitle } from '@/actions/groq'
import { ArrowLeft, Upload, ListChecks, Sparkles, Loader2, Plus, Trash2, AlertCircle } from 'lucide-react'

interface ExamSetupProps {
  examId: string
  examTitle: string
  categoria: 'scientifica' | 'mnemonica' | 'applicativa'
  currentTopicCount: number
}

interface ManualTopic {
  nome: string
  peso: number
}

const PESO_OPTIONS = [1, 2, 3, 4, 5]

export function ExamSetup({ examId, examTitle, categoria, currentTopicCount }: ExamSetupProps) {
  const router = useRouter()
  const [manualTopics, setManualTopics] = useState<ManualTopic[]>([
    { nome: '', peso: 3 },
    { nome: '', peso: 3 },
    { nome: '', peso: 3 },
  ])
  const [saving, setSaving] = useState(false)
  const [aiSeeding, setAiSeeding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  const hasExistingTopics = currentTopicCount > 0

  function updateManualTopic(i: number, patch: Partial<ManualTopic>) {
    setManualTopics((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)))
  }

  function removeManualTopic(i: number) {
    setManualTopics((prev) => prev.filter((_, idx) => idx !== i))
  }

  function addManualRow() {
    if (manualTopics.length >= 12) return
    setManualTopics((prev) => [...prev, { nome: '', peso: 3 }])
  }

  async function handleSaveManual() {
    setError(null)
    const cleaned = manualTopics
      .map((t) => ({ nome: t.nome.trim(), peso: t.peso }))
      .filter((t) => t.nome.length > 0)
    if (cleaned.length === 0) {
      setError('Inserisci almeno un argomento.')
      return
    }
    setSaving(true)
    const result = await addManualTopics(examId, cleaned)
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    router.replace(`/exam/${examId}`)
  }

  async function handleAiSeed() {
    setAiError(null)
    setAiSeeding(true)
    const result = await seedExamTopicsFromTitle(examId)
    setAiSeeding(false)
    if ((result as any).error) {
      setAiError((result as any).error)
      return
    }
    router.replace(`/exam/${examId}`)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-600">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-2">
          <Link href="/dashboard" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-colors flex-shrink-0" aria-label="Torna alla dashboard">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-bold text-base sm:text-xl text-slate-900 dark:text-white truncate">{examTitle}</h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate">Scegli come vuoi iniziare</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
          Abbiamo già creato 5 argomenti di default. Ora scegli se vuoi personalizzarli.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {/* Card A — Carica materiale */}
          <div className="card flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 bg-coach-100 dark:bg-coach-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
                <Upload className="w-5 h-5 text-coach-600 dark:text-coach-400" />
              </div>
              <h2 className="font-bold text-slate-900 dark:text-white">Carica materiale</h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 flex-1">
              Carica un PDF o delle slide. L'AI estrarrà automaticamente gli argomenti dal documento.
            </p>
            <button
              onClick={() => router.replace(`/exam/${examId}?tab=materiali`)}
              className="btn-primary w-full text-sm"
            >
              Vai ai materiali
            </button>
          </div>

          {/* Card B — Capitoli manuali */}
          <div className="card flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 bg-coach-100 dark:bg-coach-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
                <ListChecks className="w-5 h-5 text-coach-600 dark:text-coach-400" />
              </div>
              <h2 className="font-bold text-slate-900 dark:text-white">Dimmi gli argomenti</h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
              Scrivi i capitoli del programma. Per ognuno assegna un peso 1-5.
            </p>

            <div className="space-y-2 mb-3 max-h-64 overflow-y-auto pr-1">
              {manualTopics.map((t, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={t.nome}
                    onChange={(e) => updateManualTopic(i, { nome: e.target.value })}
                    placeholder={`Argomento ${i + 1}`}
                    maxLength={100}
                    className="input flex-1 text-xs py-1.5 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  />
                  <select
                    value={t.peso}
                    onChange={(e) => updateManualTopic(i, { peso: parseInt(e.target.value) })}
                    className="input w-16 text-xs py-1.5 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    aria-label={`Peso argomento ${i + 1}`}
                  >
                    {PESO_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeManualTopic(i)}
                    disabled={manualTopics.length <= 1}
                    className="p-1.5 text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label={`Rimuovi argomento ${i + 1}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addManualRow}
              disabled={manualTopics.length >= 12}
              className="text-xs text-coach-600 dark:text-coach-400 hover:underline flex items-center gap-1 mb-3 disabled:opacity-50"
            >
              <Plus className="w-3 h-3" /> Aggiungi riga
            </button>

            {error && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start gap-2 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span className="flex-1">{error}</span>
              </div>
            )}

            <button
              onClick={handleSaveManual}
              disabled={saving}
              className="btn-primary w-full text-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
              Salva argomenti
            </button>
          </div>

          {/* Card C — Lascia fare a noi (AI) */}
          <div className="card flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 bg-coach-100 dark:bg-coach-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-coach-600 dark:text-coach-400" />
              </div>
              <h2 className="font-bold text-slate-900 dark:text-white">
                {hasExistingTopics ? 'Rigenera con AI' : 'Lascia fare a noi'}
              </h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 flex-1">
              {hasExistingTopics
                ? `L'AI genererà nuovi argomenti basandosi sul titolo dell'esame. Verranno sostituiti i ${currentTopicCount} argomenti esistenti.`
                : `L'AI genererà gli argomenti basandosi sul titolo dell'esame e sul tipo di materia (${categoria}).`}
            </p>

            {aiError && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start gap-2 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span className="flex-1">{aiError}</span>
                <button
                  onClick={handleAiSeed}
                  className="text-xs font-semibold underline hover:no-underline"
                >
                  Riprova
                </button>
              </div>
            )}

            <button
              onClick={handleAiSeed}
              disabled={aiSeeding}
              className="btn-primary w-full text-sm"
            >
              {aiSeeding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                  Sto estraendo…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 inline mr-2" />
                  Genera con AI
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => router.replace(`/exam/${examId}`)}
            className="text-sm text-slate-500 dark:text-slate-400 hover:text-coach-600 dark:hover:text-coach-400 underline"
          >
            Salta per ora (usa i 5 argomenti di default)
          </button>
        </div>
      </main>
    </div>
  )
}
