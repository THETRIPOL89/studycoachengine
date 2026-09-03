'use client'

import { useState } from 'react'
import { Trophy, X, Star, MessageSquare, BookOpen } from 'lucide-react'

interface PostExamModalProps {
  examName: string
  onSubmit: (data: {
    superato: boolean
    voto: number | null
    argomenti_usciti: string
    domande_ricevute: string
  }) => void
  onClose: () => void
}

export function PostExamModal({ examName, onSubmit, onClose }: PostExamModalProps) {
  const [superato, setSuperato] = useState<boolean | null>(null)
  const [voto, setVoto] = useState('')
  const [argomenti, setArgomenti] = useState('')
  const [domande, setDomande] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (superato === null) return
    onSubmit({
      superato,
      voto: superato && voto ? parseInt(voto) : null,
      argomenti_usciti: argomenti,
      domande_ricevute: domande
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-coach-100 rounded-xl flex items-center justify-center">
              <Trophy className="w-5 h-5 text-coach-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Esame completato!</h3>
              <p className="text-xs text-slate-500">{examName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Superato? */}
          <div>
            <label className="label">Esito *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSuperato(true)}
                className={`p-3 rounded-xl border-2 text-center font-semibold text-sm transition-all ${
                  superato === true 
                    ? 'border-success bg-green-50 text-green-700' 
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
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
                    ? 'border-danger bg-red-50 text-red-700' 
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
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
              <label className="label flex items-center gap-2">
                <Star className="w-4 h-4 text-coach-500" />
                Voto ottenuto
              </label>
              <select 
                value={voto} 
                onChange={e => setVoto(e.target.value)}
                className="input"
              >
                <option value="">Seleziona...</option>
                {[18,19,20,21,22,23,24,25,26,27,28,29,30].map(v => (
                  <option key={v} value={v}>{v}{v === 30 ? ' e lode' : '/30'}</option>
                ))}
              </select>
            </div>
          )}

          {/* Argomenti usciti */}
          <div>
            <label className="label flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-coach-500" />
              Argomenti usciti
            </label>
            <textarea
              value={argomenti}
              onChange={e => setArgomenti(e.target.value)}
              className="input min-h-[80px]"
              placeholder="Quali argomenti sono usciti all'esame?"
            />
          </div>

          {/* Domande ricevute */}
          <div>
            <label className="label flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-coach-500" />
              Domande / Note
            </label>
            <textarea
              value={domande}
              onChange={e => setDomande(e.target.value)}
              className="input min-h-[80px]"
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
