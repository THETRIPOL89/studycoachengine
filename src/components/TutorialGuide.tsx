'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { X, ChevronRight, ChevronLeft, Sparkles, CheckCircle2 } from 'lucide-react'
import { cleanupTutorialExams } from '@/actions/exams'

const COMPLETED_KEY = 'study-coach-tutorial-completed'
const STEP_KEY = 'study-coach-tutorial-step'
const ACTIVE_KEY = 'study-coach-tutorial-active'

type StepId =
  | 'welcome'
  | 'highlight-new-exam'
  | 'fill-form'
  | 'submit-form'
  | 'setup-choice'
  | 'complete'

interface StepDef {
  id: StepId
  /** Se impostato, il tour aspetta di essere su questa path (match startsWith) */
  pathMatch?: string
  /** data-tour target. Se assente → modal centrato */
  target?: string
  title: string
  body: string
  /** Testo bottone primario */
  primaryLabel: string
  /** Se true, il passo avanza solo quando l'utente clicca il target reale */
  waitForTargetClick?: boolean
  /** Allineamento preferito del tooltip */
  placement?: 'bottom' | 'top' | 'left' | 'right' | 'center'
}

const STEPS: StepDef[] = [
  {
    id: 'welcome',
    pathMatch: '/dashboard',
    title: 'Benvenuto in Study Coach',
    body: 'In meno di un minuto ti mostro come creare il tuo primo esame e far partire il Coach. Niente simulazioni: userai l’interfaccia vera.',
    primaryLabel: 'Inizia il tour',
    placement: 'center',
  },
  {
    id: 'highlight-new-exam',
    pathMatch: '/dashboard',
    target: 'nuovo-esame',
    title: 'Crea il tuo primo esame',
    body: 'Clicca su «Nuovo esame». È il punto di partenza di tutto: da qui il Coach costruirà il piano di studio.',
    primaryLabel: 'Clicca il bottone evidenziato',
    waitForTargetClick: true,
    placement: 'bottom',
  },
  {
    id: 'fill-form',
    pathMatch: '/exam/new',
    target: 'form-nuovo-esame',
    title: 'Compila i dati dell’esame',
    body: 'Inserisci nome, università, corso, data e voto obiettivo. Puoi usare dati reali o di prova: l’importante è arrivare in fondo.',
    primaryLabel: 'Avanti',
    placement: 'top',
  },
  {
    id: 'submit-form',
    pathMatch: '/exam/new',
    target: 'submit-esame',
    title: 'Crea esame e genera piano',
    body: 'Quando sei pronto, clicca questo bottone. Il Coach crea l’esame e ti porta alla configurazione degli argomenti.',
    primaryLabel: 'Clicca «Crea esame»',
    waitForTargetClick: true,
    placement: 'top',
  },
  {
    id: 'setup-choice',
    pathMatch: '/exam/', // /exam/[id]/setup
    target: 'setup-cards',
    title: 'Scegli come partire',
    body: 'Hai 3 strade: carica un PDF/slide (AI estrae gli argomenti), scrivili a mano, oppure lascia fare tutto all’AI. Puoi anche saltare e usare i 5 argomenti di default.',
    primaryLabel: 'Ho scelto / Salto',
    placement: 'bottom',
  },
  {
    id: 'complete',
    title: 'Sei pronto!',
    body: 'Hai creato un esame e visto come si configura. Da ora in poi apri la dashboard, scegli l’esame e segui il piano del giorno. Il Coach aggiorna le priorità in base a come studi.',
    primaryLabel: 'Inizia a studiare',
    placement: 'center',
  },
]

function isCompleted(): boolean {
  try {
    return localStorage.getItem(COMPLETED_KEY) === 'true'
  } catch {
    return false
  }
}

async function markCompletedAndCleanup() {
  try {
    localStorage.setItem(COMPLETED_KEY, 'true')
    sessionStorage.removeItem(STEP_KEY)
    sessionStorage.removeItem(ACTIVE_KEY)
  } catch { /* ignore */ }
  // Best-effort: non bloccare la UI
  cleanupTutorialExams().catch(() => {})
}

function getStoredStep(): StepId | null {
  try {
    const v = sessionStorage.getItem(STEP_KEY) as StepId | null
    return v && STEPS.some((s) => s.id === v) ? v : null
  } catch {
    return null
  }
}

function setStoredStep(id: StepId) {
  try {
    sessionStorage.setItem(STEP_KEY, id)
    sessionStorage.setItem(ACTIVE_KEY, '1')
  } catch {
    // ignore
  }
}

function isTourActive(): boolean {
  try {
    return sessionStorage.getItem(ACTIVE_KEY) === '1'
  } catch {
    return false
  }
}

function pathMatches(pathname: string, match?: string): boolean {
  if (!match) return true
  if (match === '/exam/') {
    return /^\/exam\/[^/]+\/setup/.test(pathname)
  }
  return pathname === match || pathname.startsWith(match + '/')
}

export function TutorialGuide() {
  const pathname = usePathname()
  const router = useRouter()
  const [active, setActive] = useState(false)
  const [stepId, setStepId] = useState<StepId>('welcome')
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [ready, setReady] = useState(false)
  const targetRef = useRef<Element | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)

  const stepIndex = STEPS.findIndex((s) => s.id === stepId)
  const step = STEPS[stepIndex] ?? STEPS[0]

// Boot: avvia o riprendi il tour
useEffect(() => {
  if (typeof window === 'undefined') return

  // Già completato → non mostrare mai
  try {
    if (localStorage.getItem(COMPLETED_KEY) === 'true') {
      setActive(false)
      cleanupTutorialExams().catch(() => {})
      return
    }
  } catch {
    // ignore
  }

  const stored = getStoredStep()
  const tourWasActive = (() => {
    try {
      return sessionStorage.getItem(ACTIVE_KEY) === '1'
    } catch {
      return false
    }
  })()

  // 1) Tour già in corso (es. dopo navigazione) → riprendi
  if (tourWasActive && stored) {
    setStepId(stored)
    setActive(true)
    return
  }

  // 2) Prima volta / non completato + sei in dashboard → parti da welcome
  if (pathname === '/dashboard' || pathname === '/') {
    setStepId('welcome')
    setStoredStep('welcome') // setta anche ACTIVE_KEY = '1'
    setActive(true)
    return
  }

  // 3) Altre pagine senza tour attivo → niente
  setActive(false)
}, [pathname])
  useEffect(() => {
  if (!active || isCompleted()) return

  // Da dashboard "Nuovo esame" → form
  if (
    (stepId === 'highlight-new-exam' || stepId === 'welcome') &&
    pathname === '/exam/new'
  ) {
    goTo('fill-form')
    return
  }

  // Da form (fill o submit) → setup dopo createExam
  if (
    (stepId === 'submit-form' || stepId === 'fill-form') &&
    /^\/exam\/[^/]+\/setup/.test(pathname)
  ) {
    goTo('setup-choice')
    return
  }

  // Già su setup ma step sbagliato
  if (
    stepId !== 'setup-choice' &&
    stepId !== 'complete' &&
    /^\/exam\/[^/]+\/setup/.test(pathname)
  ) {
    goTo('setup-choice')
  }
}, [pathname, active, stepId])

  // Quando cambia path, avanza automaticamente se siamo sul passo giusto
  useEffect(() => {
    if (!active || isCompleted()) return

    // Dopo submit form → arrivo su setup
    if (stepId === 'submit-form' && pathMatches(pathname, '/exam/')) {
      goTo('setup-choice')
      return
    }
    // Dopo click Nuovo esame → arrivo su /exam/new
    if (stepId === 'highlight-new-exam' && pathname === '/exam/new') {
      goTo('fill-form')
      return
    }
    // Se siamo su una pagina sbagliata per lo step corrente, non forzare
  }, [pathname, active, stepId])

  const measure = useCallback(() => {
    if (!step.target) {
      setRect(null)
      targetRef.current = null
      return
    }
    const el = document.querySelector(`[data-tour="${step.target}"]`)
    targetRef.current = el
    if (el) {
      const r = el.getBoundingClientRect()
      setRect(r)
      // Porta l'elemento in vista se fuori schermo
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    } else {
      setRect(null)
    }
  }, [step.target])

  useLayoutEffect(() => {
    if (!active) return
    setReady(false)
    const t = requestAnimationFrame(() => {
      measure()
      setReady(true)
    })
    return () => cancelAnimationFrame(t)
  }, [active, stepId, pathname, measure])

  useEffect(() => {
    if (!active) return
    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)

    observerRef.current = new ResizeObserver(measure)
    if (targetRef.current) observerRef.current.observe(targetRef.current)

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
      observerRef.current?.disconnect()
    }
  }, [active, stepId, measure])

  // Click sul target reale quando waitForTargetClick
  useEffect(() => {
    if (!active || !step.waitForTargetClick || !step.target) return

    const handler = (e: MouseEvent) => {
      const el = (e.target as HTMLElement)?.closest?.(`[data-tour="${step.target}"]`)
      if (!el) return
      // Lascia che il click nativo avvenga (navigazione / submit), poi avanza
      if (step.id === 'highlight-new-exam') {
        // navigazione gestita dal Link; avanziamo al prossimo step in storage
        setStoredStep('fill-form')
      } else if (step.id === 'submit-form') {
        setStoredStep('setup-choice')
      }
    }

    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [active, step])

  function goTo(id: StepId) {
    setStepId(id)
    setStoredStep(id)
  }

  function handlePrimary() {
    if (step.id === 'welcome') {
      goTo('highlight-new-exam')
      return
    }
    if (step.id === 'fill-form') {
      goTo('submit-form')
      return
    }
    if (step.id === 'setup-choice') {
      goTo('complete')
      return
    }
    if (step.id === 'complete') {
      markCompletedAndCleanup()
      setActive(false)
      // Torna in dashboard se siamo ancora in setup
      if (pathMatches(pathname, '/exam/')) {
        router.push('/dashboard')
      }
      return
    }
    // Per waitForTargetClick non avanziamo dal bottone primario
  }

  function handleSkip() {
    markCompletedAndCleanup()
    setActive(false)
  }

  function handleBack() {
    if (stepIndex <= 0) return
    const prev = STEPS[stepIndex - 1]
    goTo(prev.id)
    if (prev.pathMatch === '/dashboard' && pathname !== '/dashboard') {
      router.push('/dashboard')
    } else if (prev.pathMatch === '/exam/new' && pathname !== '/exam/new') {
      router.push('/exam/new')
    }
  }

  if (!active || isCompleted()) return null

  // Se lo step richiede una path e non ci siamo, non mostrare overlay
  // (aspettiamo la navigazione). Eccezione: welcome/complete senza path stretta.
  if (step.pathMatch && !pathMatches(pathname, step.pathMatch) && step.id !== 'complete') {
    return null
  }

  const pad = 8
  const spotlightStyle: React.CSSProperties | undefined = rect
    ? {
        position: 'fixed',
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
        borderRadius: 12,
        boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.72)',
        zIndex: 9998,
        pointerEvents: 'none',
        transition: 'all 0.25s ease',
      }
    : undefined

  // Tooltip position
  const tooltipStyle = computeTooltipStyle(rect, step.placement ?? 'bottom')

  return (
    <>
      {/* Overlay scuro full-page quando non c'è target (welcome / complete) */}
      {!step.target && (
        <div
          className="fixed inset-0 z-[9997] bg-slate-900/70"
          aria-hidden
        />
      )}

      {/* Spotlight cutout */}
      {step.target && ready && rect && (
        <div style={spotlightStyle} aria-hidden />
      )}

      {/* Se c'è target ma non trovato ancora, overlay pieno leggero */}
      {step.target && ready && !rect && (
        <div className="fixed inset-0 z-[9997] bg-slate-900/50" aria-hidden />
      )}

      {/* Tooltip / card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        className="fixed z-[9999] w-[min(100%-1.5rem,22rem)] animate-in fade-in zoom-in-95 duration-200"
        style={tooltipStyle}
      >
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-coach-100 dark:bg-coach-900/40 flex items-center justify-center flex-shrink-0">
                {step.id === 'complete' ? (
                  <CheckCircle2 className="w-4 h-4 text-coach-600 dark:text-coach-400" />
                ) : (
                  <Sparkles className="w-4 h-4 text-coach-600 dark:text-coach-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-coach-600 dark:text-coach-400">
                  Tutorial · {stepIndex + 1}/{STEPS.length}
                </p>
                <h2 id="tour-title" className="font-bold text-slate-900 dark:text-white text-sm leading-tight">
                  {step.title}
                </h2>
              </div>
            </div>
            <button
              onClick={handleSkip}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              aria-label="Salta tutorial"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="px-4 pb-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {step.body}
          </p>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 px-4 pb-3">
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                className={`h-1.5 rounded-full transition-all ${
                  i === stepIndex
                    ? 'w-5 bg-coach-600'
                    : i < stepIndex
                    ? 'w-1.5 bg-coach-300'
                    : 'w-1.5 bg-slate-200 dark:bg-slate-600'
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 px-4 pb-4">
            <div className="flex items-center gap-1">
              {stepIndex > 0 && step.id !== 'complete' && (
                <button
                  onClick={handleBack}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-1.5 rounded-lg"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Indietro
                </button>
              )}
              <button
                onClick={handleSkip}
                className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-2 py-1.5"
              >
                Salta
              </button>
            </div>

            {!step.waitForTargetClick && (
              <button
                onClick={handlePrimary}
                className="inline-flex items-center gap-1.5 text-sm font-semibold bg-coach-600 hover:bg-coach-700 text-white px-3.5 py-2 rounded-lg transition-colors"
              >
                {step.primaryLabel}
                {step.id !== 'complete' && <ChevronRight className="w-4 h-4" />}
              </button>
            )}

            {step.waitForTargetClick && (
              <span className="text-xs font-medium text-coach-600 dark:text-coach-400 animate-pulse">
                Clicca l’elemento evidenziato →
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function computeTooltipStyle(
  rect: DOMRect | null,
  placement: 'bottom' | 'top' | 'left' | 'right' | 'center'
): React.CSSProperties {
  const gap = 14
  const vw = typeof window !== 'undefined' ? window.innerWidth : 400
  const vh = typeof window !== 'undefined' ? window.innerHeight : 700
  const maxW = Math.min(vw - 24, 352)

  if (!rect || placement === 'center') {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: maxW,
    }
  }

  let top = 0
  let left = rect.left + rect.width / 2

  if (placement === 'bottom') {
    top = rect.bottom + gap
  } else if (placement === 'top') {
    top = rect.top - gap
    // tooltip sopra: useremo translateY(-100%)
  } else if (placement === 'right') {
    top = rect.top + rect.height / 2
    left = rect.right + gap
  } else {
    top = rect.top + rect.height / 2
    left = rect.left - gap
  }

  // Clamp orizzontale
  const half = maxW / 2
  left = Math.max(half + 12, Math.min(left, vw - half - 12))

  // Clamp verticale grezzo
  if (placement === 'bottom' && top + 220 > vh) {
    top = Math.max(12, rect.top - gap)
    return {
      top,
      left,
      transform: 'translate(-50%, -100%)',
      width: maxW,
    }
  }
  if (placement === 'top') {
    return {
      top,
      left,
      transform: 'translate(-50%, -100%)',
      width: maxW,
    }
  }

  return {
    top,
    left,
    transform: placement === 'bottom' ? 'translateX(-50%)' : 'translate(-50%, -50%)',
    width: maxW,
  }
}