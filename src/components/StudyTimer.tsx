'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Pause, Play, CheckCircle, ArrowLeft, Clock, BookOpen, X, Loader2, Sparkles, MessageCircle, Volume2, VolumeX, RefreshCw } from 'lucide-react'
import { explainConcept } from '@/actions/groq'
import { MarkdownText } from './MarkdownText'

interface StudyTimerProps {
  attivita: string
  durataConsigliata: number
  motivo: string
  topicId?: string | null
  examId?: string
  /** Se false, click su "Chiedi AI" apre il paywall invece del pannello. */
  isPremium?: boolean
  onComplete: (durataEffettivaMinuti: number) => void
  onCancel: () => void
  /** Callback quando l'utente tenta di aprire l'AI Tutor senza essere premium. */
  onRequestPaywall?: () => void
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.5)
  } catch {
    // Audio non supportato, ignora silenziosamente
  }
}

export function StudyTimer({ attivita, durataConsigliata, motivo, topicId, examId, isPremium = true, onComplete, onCancel, onRequestPaywall }: StudyTimerProps) {
  const [secondsElapsed, setSecondsElapsed] = useState(0)
  const [isRunning, setIsRunning] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)

  const [aiOpen, setAiOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResponse, setAiResponse] = useState('')
  const [aiLevel, setAiLevel] = useState<'guida' | 'suggerimento' | 'completo'>('completo')

  const totalSeconds = durataConsigliata * 60
  const remainingSeconds = Math.max(0, totalSeconds - secondsElapsed)
  const progress = Math.min(100, (secondsElapsed / totalSeconds) * 100)

  const beepFired = useRef(false)

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        setSecondsElapsed(s => s + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isRunning, isPaused])

  // Suono quando il timer finisce
  useEffect(() => {
    if (remainingSeconds === 0 && isRunning && !beepFired.current && soundEnabled) {
      beepFired.current = true
      playBeep()
      // Doppio beep con pausa
      setTimeout(() => playBeep(), 600)
      setTimeout(() => playBeep(), 1200)
    }
  }, [remainingSeconds, isRunning, soundEnabled])

  const formatTime = (totalSecs: number) => {
    const m = Math.floor(totalSecs / 60)
    const s = totalSecs % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleComplete = useCallback(() => {
    setIsRunning(false)
    onComplete(Math.ceil(secondsElapsed / 60))
  }, [secondsElapsed, onComplete])

  const handlePauseToggle = () => {
    setIsPaused(p => !p)
  }

  useEffect(() => {
    if (secondsElapsed >= totalSeconds && isRunning) {
      handleComplete()
    }
  }, [secondsElapsed, totalSeconds, isRunning, handleComplete])

  async function handleAskAI(level: 'guida' | 'suggerimento' | 'completo') {
    setAiLoading(true)
    setAiLevel(level)
    setAiResponse('')
    const result = await explainConcept(attivita, level)
    if (result.error) {
      setAiResponse('Errore: ' + result.error)
    } else {
      // Extract only the actual answer, removing any thinking process
      let explanation = result.explanation || 'Nessuna risposta'

      // Remove common thinking process patterns
      explanation = explanation
        .replace(/^Here\'s a thinking process:[\s\S]*?(?=\n\n|$)/g, '')
        .replace(/^Let me think[\s\S]*?(?=\n\n|$)/g, '')
        .replace(/^I need to[\s\S]*?(?=\n\n|$)/g, '')
        .replace(/^First,[\s\S]*?(?=\n\n|$)/g, '')
        .replace(/^Breaking this down:[\s\S]*?(?=\n\n|$)/g, '')
        .replace(/^\d+\.\s+[\s\S]*?(?=\n\n|$)/g, '')
        .replace(/\n\s*\n/g, '\n') // Clean up extra newlines
        .trim()

      // If we removed too much and got empty, fallback to original
      if (!explanation || explanation.length < 10) {
        explanation = result.explanation || 'Nessuna risposta'
      }

      setAiResponse(explanation)
    }
    setAiLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col">
      {/* Top bar: su mobile si compatta per fare spazio al timer circolare.
          Niente label "Esci dalla sessione" su mobile (solo icona), il
          timer rimane sempre visibile. */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-6 py-3 sm:py-4 border-b border-slate-800">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm min-w-0"
          aria-label="Esci dalla sessione"
        >
          <ArrowLeft className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline truncate">Esci dalla sessione</span>
        </button>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => setSoundEnabled(s => !s)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg transition-colors"
            title={soundEnabled ? 'Disattiva suono' : 'Attiva suono'}
            aria-label={soundEnabled ? 'Disattiva suono' : 'Attiva suono'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Suono on' : 'Suono off'}</span>
          </button>
          <button
            onClick={() => {
              if (!isPremium) {
                // Free user: blocca l'apertura del pannello AI e segnala
                // al parent di aprire il PaywallModal. Il check server in
                // `explainConcept` è la vera protezione (anche se l'utente
                // forza l'apertura da DevTools, la chiamata viene rifiutata).
                onRequestPaywall?.()
                return
              }
              setAiOpen(true)
            }}
            className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-coach-300 hover:text-coach-200 bg-coach-900/50 hover:bg-coach-800/50 px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors border border-coach-800"
          >
            <Sparkles className="w-4 h-4" />
            <span>Chiedi AI</span>
          </button>
          <div className="flex items-center gap-1.5 sm:gap-2 text-slate-400 text-xs sm:text-sm whitespace-nowrap">
            <Clock className="w-4 h-4" />
            <span className="font-mono">{formatTime(secondsElapsed)}</span>
            <span className="text-slate-600 hidden sm:inline">/ {durataConsigliata} min</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 relative overflow-y-auto">
        <div className="w-full max-w-lg py-4 sm:py-0">
          <div className="text-center mb-6 sm:mb-10">
            <div className="inline-flex items-center gap-2 bg-coach-900/50 text-coach-300 px-3 py-1.5 rounded-full text-xs font-semibold mb-4 border border-coach-800">
              <BookOpen className="w-3.5 h-3.5" />
              SESSIONE IN CORSO
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3 break-words px-2">{attivita}</h2>
            <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed break-words px-2">{motivo}</p>
          </div>

          <div className="relative w-48 h-48 sm:w-64 sm:h-64 mx-auto mb-6 sm:mb-10">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#1e293b" strokeWidth="6" />
              <circle
                cx="50" cy="50" r="45"
                fill="none"
                stroke="#0284c7"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl sm:text-5xl font-bold text-white font-mono tracking-tight">
                {formatTime(remainingSeconds)}
              </span>
              <span className="text-slate-500 text-xs sm:text-sm mt-1">
                {isPaused ? 'In pausa' : 'Rimanenti'}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-4 px-4 sm:px-0">
            <button
              onClick={handlePauseToggle}
              className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
                isPaused
                  ? 'bg-coach-600 hover:bg-coach-500 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {isPaused ? 'Riprendi' : 'Pausa'}
            </button>

            <button
              onClick={handleComplete}
              className="flex items-center justify-center gap-2 px-6 sm:px-8 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-green-900/30"
            >
              <CheckCircle className="w-4 h-4" />
              Completa sessione
            </button>
          </div>

          <p className="text-center text-slate-600 text-xs mt-6 px-4">
            Consiglio del Coach: se resti bloccato più di 5 minuti, chiedi aiuto. Non perdere tempo su un punto.
          </p>
        </div>
      </div>

      {/* AI Tutor Panel: fullscreen su mobile, drawer a destra su desktop.
          Su mobile il timer non sarebbe piu' visibile se il pannello
          lo coprisse, quindi diventa un overlay a tutto schermo che
          l'utente puo' chiudere con la X. */}
      {aiOpen && (
        <div className="fixed inset-0 sm:inset-y-0 sm:left-auto sm:right-0 w-full sm:max-w-md bg-slate-800 border-l border-slate-700 z-[60] flex flex-col shadow-2xl">
          <div className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 border-b border-slate-700 gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-8 h-8 bg-coach-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-white text-sm">AI Tutor</h3>
                <p className="text-xs text-slate-400 truncate">{attivita}</p>
              </div>
            </div>
            <button onClick={() => setAiOpen(false)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors flex-shrink-0" aria-label="Chiudi tutor">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-3 sm:p-4 border-b border-slate-700">
            <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider font-semibold">Livello di aiuto</p>
            <div className="flex gap-2">
              {([
                { key: 'guida' as const, label: 'Guida', desc: 'Domande' },
                { key: 'suggerimento' as const, label: 'Hint', desc: 'Suggerimenti' },
                { key: 'completo' as const, label: 'Completo', desc: 'Spiegazione' }
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleAskAI(key)}
                  disabled={aiLoading}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    aiLevel === key && aiResponse
                      ? 'bg-coach-600 text-white shadow-lg shadow-coach-900/30'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {aiLoading && aiLevel === key ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                  ) : (
                    label
                  )}
                </button>
              ))}
            </div>
            {aiResponse && (
              <button
                onClick={() => handleAskAI(aiLevel)}
                disabled={aiLoading}
                className="mt-3 w-full py-1.5 rounded-lg text-[11px] font-medium text-slate-300 hover:text-white bg-slate-700/50 hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className="w-3 h-3" />
                Riprova con lo stesso livello
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-5">
            {!aiResponse && !aiLoading && (
              <div className="text-center py-8">
                <Sparkles className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400">
                  Seleziona un livello per ricevere aiuto su questa attività.
                </p>
              </div>
            )}
            {aiResponse && (
              <div className="prose prose-invert prose-sm max-w-none">
                <div className="text-sm text-slate-200 leading-relaxed break-words">
                  <MarkdownText text={aiResponse} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
