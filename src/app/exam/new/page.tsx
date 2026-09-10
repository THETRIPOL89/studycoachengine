'use client'

import { useEffect, useState } from 'react'
import { createExam } from '@/actions/exams'
import { getUser } from '@/actions/auth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, Target, Clock, BookOpen, GraduationCap, User, FileText, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { PaywallModal } from '@/components/PaywallModal'
import { TutorialGuide } from '@/components/TutorialGuide'
import type { PaywallReason } from '@/lib/pricing'
import { TUTORIAL_EXAM_PREFIX } from '@/lib/tutorial'

function isTourActive(): boolean {
  try {
    return sessionStorage.getItem('study-coach-tutorial-active') === '1'
  } catch {
    return false
  }
}

export default function NewExamPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [paywallReason, setPaywallReason] = useState<PaywallReason | null>(null)

  // Prefill dal profilo
  const [universita, setUniversita] = useState('')
  const [corso, setCorso] = useState('')
  const [prefillReady, setPrefillReady] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      try {
        const user = await getUser()
        const meta = user?.user_metadata ?? {}
        setUniversita(meta.universita ?? '')
        setCorso(meta.corso ?? '')
      } catch {
        // ignore
      } finally {
        setPrefillReady(true)
      }
    }
    loadProfile()
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const formData = new FormData(e.currentTarget)

    if (isTourActive()) {
      const nome = String(formData.get('nome_esame') || '').trim()
      if (!nome.startsWith(TUTORIAL_EXAM_PREFIX)) {
        formData.set('nome_esame', `${TUTORIAL_EXAM_PREFIX}${nome || 'Esame di prova'}`)
      }
      try {
        sessionStorage.setItem('study-coach-tutorial-step', 'setup-choice')
        sessionStorage.setItem('study-coach-tutorial-active', '1')
      } catch {
        // ignore
      }
    }

    const result = await createExam(formData)

    if (result?.error) {
      setLoading(false)
      if ('code' in result && result.code === 'quota_exceeded' && 'reason' in result) {
        setPaywallReason(result.reason as PaywallReason)
      } else {
        setError(result.error)
      }
    } else if (result?.examId) {
      router.push(`/exam/${result.examId}/setup`)
    } else {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <TutorialGuide />

      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-4 sm:mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Torna alla dashboard
        </Link>

        <div className="card">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Nuovo esame</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Il Coach costruira il tuo piano di studio personalizzato.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Aspetta il prefill così i default non restano vuoti */}
          {!prefillReady ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-coach-500 animate-spin" />
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-4 sm:space-y-5"
              data-tour="form-nuovo-esame"
            >
              <div>
                <label className="label dark:text-slate-300 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-coach-500 flex-shrink-0" />
                  Nome esame *
                </label>
                <input
                  name="nome_esame"
                  type="text"
                  required
                  className="input"
                  placeholder="Analisi Matematica 1"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <label className="label dark:text-slate-300 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-coach-500 flex-shrink-0" />
                    Universita *
                  </label>
                  <input
                    name="universita"
                    type="text"
                    required
                    className="input"
                    placeholder="Universita di Roma"
                    value={universita}
                    onChange={(e) => setUniversita(e.target.value)}
                  />
                </div>
                <div className="min-w-0">
                  <label className="label dark:text-slate-300">Corso di laurea *</label>
                  <input
                    name="corso"
                    type="text"
                    required
                    className="input"
                    placeholder="Ingegneria"
                    value={corso}
                    onChange={(e) => setCorso(e.target.value)}
                  />
                </div>
              </div>

              {/* ... resto dei campi invariato (data, voto, ore, modalita, professore, categoria, submit) ... */}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="label dark:text-slate-300 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-coach-500 flex-shrink-0" />
                  Data esame *
                </label>
                <input name="data_esame" type="date" required className="input" />
              </div>
              <div className="min-w-0">
                <label className="label dark:text-slate-300 flex items-center gap-2">
                  <Target className="w-4 h-4 text-coach-500 flex-shrink-0" />
                  Voto obiettivo *
                </label>
                <select name="voto_obiettivo" required className="input">
                  <option value="">Seleziona...</option>
                  <option value="18">18 - Sufficiente</option>
                  <option value="21">21 - Discreto</option>
                  <option value="24">24 - Buono</option>
                  <option value="27">27 - Distinto</option>
                  <option value="30">30 - Ottimo</option>
                </select>
              </div>
            </div>
            <div className="min-w-0">
  <label className="label dark:text-slate-300">CFU *</label>
  <input
    name="cfu"
    type="number"
    required
    min={1}
    max={30}
    defaultValue={6}
    className="input"
    placeholder="6"
  />
</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="label dark:text-slate-300 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-coach-500 flex-shrink-0" />
                  Ore al giorno *
                </label>
                <select name="ore_giorno" required className="input" defaultValue="2">
                  <option value="1">1 ora</option>
                  <option value="2">2 ore</option>
                  <option value="3">3 ore</option>
                  <option value="4">4 ore</option>
                  <option value="5">5 ore</option>
                  <option value="6">6+ ore</option>
                </select>
              </div>

              <div className="min-w-0">
                <label className="label dark:text-slate-300">Modalita esame</label>
                <select name="modalita" className="input">
                  <option value="">Seleziona...</option>
                  <option value="scritto">Scritto</option>
                  <option value="orale">Orale</option>
                  <option value="misto">Misto</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="label dark:text-slate-300 flex items-center gap-2">
                  <User className="w-4 h-4 text-coach-500 flex-shrink-0" />
                  Professore
                </label>
                <input
                  name="professore"
                  type="text"
                  className="input"
                  placeholder="Opzionale"
                />
              </div>
              <div className="min-w-0">
                <label className="label dark:text-slate-300 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-coach-500 flex-shrink-0" />
                  Categoria materia
                </label>
                <select name="categoria" className="input">
                  <option value="scientifica">Scientifica (es. Ingegneria)</option>
                  <option value="mnemonica">Mnemonica (es. Giurisprudenza)</option>
                  <option value="applicativa">Applicativa (es. Economia)</option>
                </select>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
                data-tour="submit-esame"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  'Crea esame e genera piano'
                )}
              </button>
            </div>
            </form>
            )}
          </div>
        </div>

        {paywallReason && (
          <PaywallModal
            reason={paywallReason}
            onClose={() => setPaywallReason(null)}
          />
        )}
      </div>
    )
  }
