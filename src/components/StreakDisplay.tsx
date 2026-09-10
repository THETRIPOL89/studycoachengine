'use client'

import { useEffect, useRef, useState } from 'react'
import { Flame } from 'lucide-react'
import { getStreak } from '@/actions/streak'

// ============================================================
// StreakDisplay - fiamma + count per il top-right header
// ============================================================
// Self-fetching: riceve uno `initial` dal parent (cosi al primo
// render mostra subito il valore, senza skeleton) e poi lo ri-fetcha
// in background. Se il parent non passa initial, parte da 0.
//
// `pulse` = true per 1.2s dopo che il count sale rispetto al valore
// precedente. Usa la classe CSS .animate-flame-pulse (vedi
// src/app/globals.css).
//
// Tre stati visivi:
//   - active   (count > 0, non a rischio, non rotto): fiamma ambra piena
//   - at-risk  (24h..36h dall'ultima sessione): fiamma ambra opacizzata
//   - broken   (>= 36h, oppure count = 0): fiamma grigia, "Ricomincia oggi"
//
// Tutto il copy e in italiano. Niente toni giudicanti.
// ============================================================

export interface StreakDisplayProps {
  initial?: {
    streakCount: number
    lastUpdated: string | null
    isAtRisk: boolean
    isBroken: boolean
  }
  className?: string
  onClick?: () => void
}

const NEUTRAL_INITIAL = {
  streakCount: 0,
  lastUpdated: null as string | null,
  isAtRisk: false,
  isBroken: false
}

export function StreakDisplay({ initial, className = '', onClick }: StreakDisplayProps) {
  const [state, setState] = useState(initial ?? NEUTRAL_INITIAL)
  const prevCountRef = useRef(state.streakCount)
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    // Ri-fetcha in background (es. quando la pagina rimane aperta a
    // lungo e si vuole aggiornare isAtRisk). Non blocca la UI: lo
    // stato iniziale e gia visibile.
    getStreak()
      .then((s) => {
        setState({
          streakCount: s.streakCount,
          lastUpdated: s.lastUpdated,
          isAtRisk: s.isAtRisk,
          isBroken: s.isBroken
        })
      })
      .catch(() => { /* silenzioso: stato di default va bene */ })
  }, [])

  useEffect(() => {
    if (state.streakCount > prevCountRef.current) {
      setPulse(true)
      const t = setTimeout(() => setPulse(false), 1200)
      prevCountRef.current = state.streakCount
      return () => clearTimeout(t)
    }
    prevCountRef.current = state.streakCount
  }, [state.streakCount])

  const isZero = state.streakCount === 0 || state.isBroken

  const colorClass = isZero
    ? 'text-slate-400 dark:text-slate-500'
    : state.isAtRisk
    ? 'text-amber-400/60 dark:text-amber-400/50'
    : 'text-amber-500 dark:text-amber-400'

  // Su mobile mostriamo SOLO l'icona (no label) per ridurre l'ingombro
  // nell'header; la label completa riapare da sm: in su. Il tooltip
  // resta sempre accessibile via title/aria-label.
  const label = isZero
    ? 'Ricomincia oggi'
    : `${state.streakCount} ${state.streakCount === 1 ? 'giorno' : 'giorni'}`

  const tooltip = isZero
    ? 'Hai fatto una pausa — quando vuoi, ricominciamo.'
    : state.isAtRisk
    ? `Hai studiato ${state.streakCount} giorni di fila. Hai tempo fino a stasera per mantenere la streak.`
    : `Hai studiato ${state.streakCount} giorni di fila. Continua così!`

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg
        bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700
        transition-colors ${pulse ? 'animate-flame-pulse' : ''}
        ${onClick
      ? 'hover:bg-coach-50 dark:hover:bg-coach-900/30 hover:border-coach-200 dark:hover:border-coach-700 cursor-pointer'
      : 'cursor-default'
    }
        ${className}`}
      title={tooltip}
      aria-label={tooltip}
    >
      <Flame className={`w-4 h-4 ${colorClass} flex-shrink-0`} aria-hidden="true" />
      <span className={`text-xs font-semibold ${colorClass} whitespace-nowrap hidden sm:inline`}>
        {label}
      </span>
    </button>
  )
}
