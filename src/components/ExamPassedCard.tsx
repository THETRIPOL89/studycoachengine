import Link from 'next/link'
import { Exam } from '@/types/database'
import { Calendar, CheckCircle, XCircle, ArrowRight } from 'lucide-react'

// ============================================================
// ExamPassedCard - card compatta per la sezione "Esami passati"
// ============================================================
// Mostra: nome, data, esito finale (voto + faccina di soddisfazione).
// Cliccabile: porta alla pagina /exam/[id] in modalita' "passato"
// (vedi src/app/exam/[id]/page.tsx) dove l'utente vede il riepilogo
// completo ma non puo' fare nuove sessioni.
//
// Se l'utente ha sostenuto l'esame ma non ha ancora compilato il
// feedback (voto_finale IS NULL), la card mostra un banner di
// sollecito + il bottone "Lascia feedback".
// ============================================================

const FACCINA_EMOJI: Record<number, string> = {
  1: '😞',
  2: '😕',
  3: '😐',
  4: '🙂',
  5: '😄'
}

interface ExamPassedCardProps {
  exam: Exam
}

export function ExamPassedCard({ exam }: ExamPassedCardProps) {
  const hasVoto = exam.voto_finale != null
  const isSuperato = exam.stato === 'completato'

  return (
    <Link href={`/exam/${exam.id}`} className="block">
      <div className="card hover:shadow-md transition-shadow cursor-pointer h-full flex flex-col dark:bg-slate-800 dark:border-slate-700 border-l-4 border-l-slate-300 dark:border-l-slate-600">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-base text-slate-900 dark:text-white break-words">
              {exam.nome_esame}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{new Date(exam.data_esame).toLocaleDateString('it-IT')}</span>
            </div>
          </div>
          {isSuperato ? (
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" aria-label="Superato" />
          ) : (
            <XCircle className="w-5 h-5 text-slate-400 flex-shrink-0" aria-label="Non superato" />
          )}
        </div>

        {/* Blocco esito: voto + faccina, oppure banner "feedback mancante" */}
        {hasVoto ? (
          <div className="flex items-center gap-3 py-2">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              <span className="text-2xl font-bold text-coach-600 dark:text-coach-400">
                {exam.voto_finale}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 dark:text-slate-400">Voto finale</p>
              <p className="text-sm text-slate-700 dark:text-slate-200 font-medium">
                Obiettivo: {exam.voto_obiettivo}/30
              </p>
            </div>
            {exam.soddisfazione != null && (
              <div className="flex-shrink-0 text-2xl" title={`Soddisfazione: ${exam.soddisfazione}/5`}>
                {FACCINA_EMOJI[exam.soddisfazione]}
              </div>
            )}
          </div>
        ) : (
          <div className="py-2 px-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
              Feedback mancante
            </p>
            <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
              Dicci com'è andata.
            </p>
          </div>
        )}

        <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end">
          <span className="text-coach-600 dark:text-coach-400 text-sm font-medium flex items-center gap-1">
            Vedi riepilogo <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </Link>
  )
}
