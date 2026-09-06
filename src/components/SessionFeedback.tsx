'use client'

import { useState } from 'react'
import { Star, MessageSquare, Trophy, X, CheckCircle } from 'lucide-react'

interface SessionFeedbackProps {
  attivita: string
  durataEffettiva: number
  onSubmit: (data: {
    difficolta: number
    risultato_quiz: number | null
    note: string
  }) => void
  onSkip: () => void
}

export function SessionFeedback({ attivita, durataEffettiva, onSubmit, onSkip }: SessionFeedbackProps) {
  const [difficolta, setDifficolta] = useState<number>(3)
  const [risultato, setRisultato] = useState<string>('')
  const [note, setNote] = useState('')
  const [hoveredStar, setHoveredStar] = useState<number | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({
      difficolta,
      risultato_quiz: risultato ? parseInt(risultato) : null,
      note
    })
  }

  const labels = ['', 'Molto facile', 'Facile', 'Normale', 'Difficile', 'Molto difficile']

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <Trophy className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Sessione completata!</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 break-words">{durataEffettiva} minuti • {attivita}</p>
            </div>
          </div>
          <button onClick={onSkip} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 flex-shrink-0" aria-label="Chiudi">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Difficolta stelle */}
          <div>
            <label className="label dark:text-slate-300">Quanto e stata difficile?</label>
            <div className="flex items-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setDifficolta(star)}
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(null)}
                  className="p-1 transition-transform hover:scale-110"
                  aria-label={`Difficolta ${star} su 5`}
                >
                  <Star
                    className={`w-7 h-7 transition-colors ${
                      star <= (hoveredStar ?? difficolta)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-300 dark:text-slate-600'
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{labels[difficolta]}</p>
          </div>

          {/* Risultato quiz */}
          <div>
            <label className="label flex items-center gap-2 dark:text-slate-300">
              <CheckCircle className="w-4 h-4 text-coach-500 flex-shrink-0" />
              Risultato quiz/esercizi (0-100)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                value={risultato || 0}
                onChange={e => setRisultato(e.target.value)}
                className="flex-1 min-w-0 accent-coach-600"
              />
              <input
                type="number"
                min="0"
                max="100"
                value={risultato}
                onChange={e => setRisultato(e.target.value)}
                className="w-20 input text-center"
                placeholder="--"
              />
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Opzionale. Aiuta il Coach a calibrare meglio.</p>
          </div>

          {/* Note */}
          <div>
            <label className="label flex items-center gap-2 dark:text-slate-300">
              <MessageSquare className="w-4 h-4 text-coach-500 flex-shrink-0" />
              Note per il Coach
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              className="input min-h-[80px] dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
              placeholder="Dove hai avuto difficolta? Cosa vorresti ripassare?"
            />
          </div>

          <div className="flex gap-2 sm:gap-3 pt-2">
            <button
              type="button"
              onClick={onSkip}
              className="flex-1 btn-secondary text-sm"
            >
              Salta
            </button>
            <button
              type="submit"
              className="flex-1 btn-primary text-sm"
            >
              Salva e continua
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
