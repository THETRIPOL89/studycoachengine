'use client'

import { useState } from 'react'
import { Trophy, X, Star, MessageSquare, BookOpen } from 'lucide-react'

// 5 faccine per la soddisfazione. Emoji standard, accessibili via
// aria-label. La scala 1-5 segue l'ordine: triste -> euforico.
const FACCINE: Array<{ value: number; emoji: string; label: string }> = [
  { value: 1, emoji: '😞', label: 'Deluso' },
  { value: 2, emoji: '😕', label: 'Annoiato' },
  { value: 3, emoji: '😐', label: 'Neutro' },
  { value: 4, emoji: '🙂', label: 'Contento' },
  { value: 5, emoji: '😄', label: 'Euforico' }
]

interface PostExamModalProps {
  examName: string
  onSubmit: (data: {
    superato: boolean
    voto: number | null
    soddisfazione: number | null
    argomenti_usciti: string
    domande_ricevute: string
  }) => void
  onClose: () => void
}

export function PostExamModal({ examName, onSubmit, onClose }: PostExamModalProps) {
  const [superato, setSuperato] = useState<boolean | null>(null)
  const [voto, setVoto] = useState('')
  const [soddisfazione, setSoddisfazione] = useState<number | null>(null)
  const [argomenti, setArgomenti] = useState('')
  const [domande, setDomande] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (superato === null) return
    onSubmit({
      superato,
      voto: superato && voto ? parseInt(voto) : null,
      soddisfazione,
      argomenti_usciti: argomenti,
      domande_ricevute: domande
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5 gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 bg-coach-100 dark:bg-coach-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <Trophy className="w-5 h-5 text-coach-600 dark:text-coach-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 dark:text-white">Esame completato!</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 break-words">{examName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 flex-shrink-0" aria-label="Chiudi">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Superato? */}
          <div>
            <label className="label dark:text-slate-300">Esito *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSuperato(true)}
                className={`p-3 rounded-xl border-2 text-center font-semibold text-sm transition-all ${
                  superato === true
                    ? 'border-success bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500'
                }`}
              >
                <Star className="w-5 h-5 mx-auto mb-1" />
                Superato
              </button>
              <button
                type="button"
                onClick={() => setSuperato(false)}
                className={`p-3 rounded-xl border-2 text-center font-semibold text-sm transition-all ${
                  superato === false
                    ? 'border-danger bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500'
                }`}
              >
                <X className="w-5 h-5 mx-auto mb-1" />
                Non superato
              </button>
            </div>
          </div>

          {/* Voto */}
          {superato === true && (
            <div>
              <label className="label flex items-center gap-2 dark:text-slate-300">
                <Star className="w-4 h-4 text-coach-500 flex-shrink-0" />
                Voto ottenuto
              </label>
              <select
                value={voto}
                onChange={e => setVoto(e.target.value)}
                className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white"
              >
                <option value="">Seleziona...</option>
                {[18,19,20,21,22,23,24,25,26,27,28,29,30].map(v => (
                  <option key={v} value={v}>{v}{v === 30 ? ' e lode' : '/30'}</option>
                ))}
              </select>
            </div>
          )}

          {/* Faccina soddisfazione */}
          <div>
            <label className="label dark:text-slate-300">
              Quanto sei soddisfatto del risultato?
            </label>
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              {FACCINE.map((f) => {
                const selected = soddisfazione === f.value
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setSoddisfazione(f.value)}
                    aria-label={f.label}
                    aria-pressed={selected}
                    className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl border-2 transition-all ${
                      selected
                        ? 'border-coach-500 bg-coach-50 dark:bg-coach-900/30 scale-105'
                        : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                    }`}
                  >
                    <span className="text-2xl sm:text-3xl leading-none" aria-hidden="true">{f.emoji}</span>
                    <span className="text-[10px] sm:text-xs font-medium text-slate-600 dark:text-slate-300 leading-tight text-center">
                      {f.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Argomenti usciti */}
          <div>
            <label className="label flex items-center gap-2 dark:text-slate-300">
              <BookOpen className="w-4 h-4 text-coach-500 flex-shrink-0" />
              Argomenti usciti
            </label>
            <textarea
              value={argomenti}
              onChange={e => setArgomenti(e.target.value)}
              className="input min-h-[80px] dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
              placeholder="Quali argomenti sono usciti all'esame?"
            />
          </div>

          {/* Domande ricevute */}
          <div>
            <label className="label flex items-center gap-2 dark:text-slate-300">
              <MessageSquare className="w-4 h-4 text-coach-500 flex-shrink-0" />
              Domande / Note
            </label>
            <textarea
              value={domande}
              onChange={e => setDomande(e.target.value)}
              className="input min-h-[80px] dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
              placeholder="Domande particolari? Trappole? Consigli per chi viene dopo?"
            />
          </div>

          <button
            type="submit"
            disabled={superato === null}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Salva e chiudi
          </button>
        </form>
      </div>
    </div>
  )
}
