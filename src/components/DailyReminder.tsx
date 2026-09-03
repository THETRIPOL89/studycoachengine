'use client'

import { Bell, Clock, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

interface ExamReminder {
  id: string
  nome_esame: string
  giorni_mancanti: number
  preparazione_percentuale: number
  ore_giorno: number
}

interface DailyReminderProps {
  exams: ExamReminder[]
}

export function DailyReminder({ exams }: DailyReminderProps) {
  if (exams.length === 0) return null

  const urgent = exams.filter(e => e.giorni_mancanti <= 7 && e.giorni_mancanti > 0)
  const atRisk = exams.filter(e => 
    e.preparazione_percentuale < 50 && e.giorni_mancanti <= 14
  )

  if (urgent.length === 0 && atRisk.length === 0) return null

  return (
    <div className="mb-8 space-y-3">
      {urgent.map(exam => (
        <div key={exam.id} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
              {exam.nome_esame} — tra {exam.giorni_mancanti} {exam.giorni_mancanti === 1 ? 'giorno' : 'giorni'}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Hai {exam.ore_giorno} ore disponibili oggi. Apri il Coach per il piano.
            </p>
          </div>
          <Link 
            href={`/exam/${exam.id}`}
            className="text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 px-3 py-2 rounded-lg transition-colors"
          >
            Vai
          </Link>
        </div>
      ))}

      {atRisk.filter(e => !urgent.find(u => u.id === e.id)).map(exam => (
        <div key={exam.id} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-900 dark:text-red-300">
              {exam.nome_esame} — preparazione a rischio
            </p>
            <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
              Solo {exam.preparazione_percentuale}% completato con {exam.giorni_mancanti} giorni rimanenti.
            </p>
          </div>
          <Link 
            href={`/exam/${exam.id}`}
            className="text-xs font-semibold text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 px-3 py-2 rounded-lg transition-colors"
          >
            Vai
          </Link>
        </div>
      ))}
    </div>
  )
}
