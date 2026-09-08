'use client'

import { useEffect, useState } from 'react'
import { Plus, Loader2, ArrowDownAZ, BarChart3, Sparkles, Calendar, ChevronUp, ChevronDown, Crown, X, CheckCircle } from 'lucide-react'
import Link from 'next/link'

// Stile coerente con il resto dell'app (coach palette, btn-primary, card, ecc.)
const STEP_KEYS = ['step1', 'step2', 'step3']
const TUTORIAL_COMPLETED_KEY = 'study-coach-tutorial-completed'

// ——— Helper: salva la completazione e ferma il componente ———
function markCompleted() {
  try {
    localStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true')
  } catch (_) {
    // ignored
  }
}

// ——— Step 1: Add Your First Exam ———
function Step1({ onNext }: { onNext: () => void }) {
  const [showNext, setShowNext] = useState(false)

  useEffect(() => {
    // after first paint, fade in the “Next” CTA
    const timer = setTimeout(() => setShowNext(true), 1200)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="tutorial-step">
      <div className="tutorial-overlay bg-slate-900/60 dark:bg-slate-900/80 absolute inset-0"></div>

      {/* Header highlight: + button area */}
      <div className="tutorial-header-highlight absolute top-0 right-0 left-0">
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 dark:bg-slate-700/50 rounded-t-lg">
          <h2 className="font-semibold text-slate-100 dark:text-slate-200 text-sm">
            1. Aggiungi il tuo primo esame
          </h2>
          <button
            onClick={onNext}
            className="ml-auto text-coach-600 dark:text-coach-400 text-xs font-medium hover:underline"
          >
            Salta questo passaggio
          </button>
        </div>

        {/* Evidenzia il + pulsante nella header */}
        <div className="absolute top-3 right-3 sm:right-3">
          <div className="w-10 h-10 bg-coach-600 rounded-xl border-2 border-white flex items-center justify-center">
            <Plus className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="absolute bottom-3 left-3 sm:left-3">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Clicca sul + rosso per aprire la pagina di creazione esame
          </p>
        </div>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-coach-100 dark:bg-coach-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-coach-600 dark:text-coach-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            È il momento di aggiungere il tuo primo esame
          </h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-xl">
            Nel header superiore trovi il pulsante + (rosso). Cliccaci per aprire il modulo di creazione esame.
          </p>

          <div>
            <button
              onClick={() => setShowNext(true)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-slate-900 dark:text-slate-100 transition-colors ${
                showNext ? 'bg-coach-600 text-white' : 'hover:bg-coach-700 dark:hover:bg-coach-600'
              }`}
            >
              {showNext ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Continua
                </>
              ) : (
                <>
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                  Carica...
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ——— Step 2: Explore the Dashboard ———
function Step2({ onNext }: { onNext: () => void }) {
  const [showNext, setShowNext] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShowNext(true), 1200)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="tutorial-step">
      <div className="tutorial-overlay bg-slate-900/60 dark:bg-slate-900/80 absolute inset-0"></div>

      <div className="tutorial-header-highlight absolute top-0 right-0 left-0">
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 dark:bg-slate-700/50 rounded-t-lg">
          <h2 className="font-semibold text-slate-100 dark:text-slate-200 text-sm">
            2. Esplora la dashboard
          </h2>
          <button onClick={onNext} className="ml-auto text-coach-600 dark:text-coach-400 text-xs font-medium hover:underline">
            Salta questo passaggio
          </button>
        </div>

        <div className="absolute top-3 right-3 sm:right-3">
          <div className="w-10 h-10 bg-coach-600 rounded-xl border-2 border-white flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="absolute bottom-3 left-3 sm:left-3">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            La dashboard mostra i tuoi esami in corso, i filtri di ordinamento e gli esami passati.
          </p>
        </div>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-coach-100 dark:bg-coach-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-coach-600 dark:text-coach-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            La dashboard a parecchie aree principali
          </h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-xl">
            Ecco cosa trovi:
          </p>

          <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-2 max-w-xl">
            <li>
              <strong>I tuoi esami:</strong> la griglia centrale con le tue schede esame
            </li>
            <li>
              <strong>Ordinamento:</strong> usa le pillole in alto per ordinare per data, preparazione,
              "consigliato" o nome
            </li>
            <li>
              <strong>Esami passati:</strong> in fondo alla pagina, mostrano voto e soddisfazione
            </li>
            <li>
              <strong>Promemoria giornalieri:</strong> la barra sotto il titolo ti ricorda di studiare
            </li>
          </ul>

          <div>
            <button
              onClick={() => setShowNext(true)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-slate-900 dark:text-slate-100 transition-colors ${
                showNext ? 'bg-coach-600 text-white' : 'hover:bg-coach-700 dark:hover:bg-coach-600'
              }`}
            >
              {showNext ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Continua
                </>
              ) : (
                <>
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                  Carica...
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ——— Step 3: Start Studying ———
function Step3({ onComplete }: { onComplete: () => void }) {
  const [showComplete, setShowComplete] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShowComplete(true), 1200)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="tutorial-step">
      <div className="tutorial-overlay bg-slate-900/60 dark:bg-slate-900/80 absolute inset-0"></div>

      <div className="tutorial-header-highlight absolute top-0 right-0 left-0">
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 dark:bg-slate-700/50 rounded-t-lg">
          <h2 className="font-semibold text-slate-100 dark:text-slate-200 text-sm">
            3. Inizia a studiare
          </h2>
          <button onClick={onComplete} className="ml-auto text-coach-600 dark:text-coach-400 text-xs font-medium hover:underline">
            Finito, torna alla dashboard
          </button>
        </div>

        <div className="absolute top-3 right-3 sm:right-3">
          <div className="w-10 h-10 bg-coach-600 rounded-xl border-2 border-white flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="absolute bottom-3 left-3 sm:left-3">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Hai completato il tutorial. Puoi iniziare a gestire i tuoi esami e studiare!
          </p>
        </div>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-coach-100 dark:bg-coach-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-coach-600 dark:text-coach-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            Sei pronto/a!
          </h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-xl">
            Hai imparato come:
          </p>

          <ul className="list-disc list-inside text-slate-600 dark:text-slate-500 space-y-2 max-w-xl">
            <li>Aggiungere esami usando il pulsante +</li>
            <li>Navigare la dashboard e usare i filtri</li>
            <li>Accedere al workspace di un esame (pagina /exam/[id])</li>
            <li>Lanciare il timer di studio con l'AI Tutor</li>
          </ul>

          <div>
            <button
              onClick={onComplete}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-coach-600 text-white font-semibold hover:bg-coach-700 transition-colors"
            >
              Inizia ora
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ——— Main TutorialGuide Component ———
export function TutorialGuide() {
  const [step, setStep] = useState(1)
  const [completed, setCompleted] = useState(false)

  // Check localStorage on mount
  useEffect(() => {
    try {
      const val = localStorage.getItem(TUTORIAL_COMPLETED_KEY)
      if (val === 'true') {
        setCompleted(true)
        return
      }
    } catch (_) {
      // ignored
    }
    setCompleted(false)
  }, [])

  if (completed) {
    // Render nothing — user has finished
    return null
  }

  const goToNext = () => {
    setStep((prev) => {
      if (prev < 3) return prev + 1
      // last step → mark completed
      markCompleted()
      return 3
    })
  }

  const onSkip = () => {
    markCompleted()
    setStep(3) // jump to final step
  }

  return (
    <div className="tutorial-wrapper min-h-screen">
      {step === 1 && <Step1 onNext={goToNext} />}
      {step === 2 && <Step2 onNext={goToNext} />}
      {step === 3 && <Step3 onComplete={() => { markCompleted(); setStep(3) }} />}
    </div>
  )
}