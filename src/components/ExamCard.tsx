import Link from 'next/link'
import { Exam } from '@/types/database'
import { daysUntil, getPreparationColor, getPreparationBg } from '@/lib/utils'
import { Calendar, Target, TrendingUp, ArrowRight } from 'lucide-react'

interface ExamCardProps {
  exam: Exam
}

export function ExamCard({ exam }: ExamCardProps) {
  const giorni = daysUntil(exam.data_esame)
  const prepColor = getPreparationColor(exam.preparazione_percentuale)
  const prepBg = getPreparationBg(exam.preparazione_percentuale)

  return (
    <Link href={`/exam/${exam.id}`} className="block">
      <div className="card hover:shadow-md transition-shadow cursor-pointer h-full flex flex-col dark:bg-slate-800 dark:border-slate-700">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white break-words">{exam.nome_esame}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 break-words">{exam.universita}</p>
          </div>
          <div className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
            giorni <= 7 ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
            giorni <= 30 ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
            'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'
          }`}>
            {giorni > 0 ? `${giorni} giorni` : 'In corso'}
          </div>
        </div>

        <div className="space-y-3 flex-1">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Calendar className="w-4 h-4" />
            <span>{new Date(exam.data_esame).toLocaleDateString('it-IT')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Target className="w-4 h-4" />
            <span>Obiettivo: {exam.voto_obiettivo}/30</span>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <TrendingUp className="w-4 h-4" />
                Preparazione
              </span>
              <span className={`font-semibold ${prepColor}`}>
                {exam.preparazione_percentuale}%
              </span>
            </div>
            <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${Math.max(2, exam.preparazione_percentuale)}%`,
                  backgroundColor: exam.preparazione_percentuale < 30 ? '#ef4444' : 
                                  exam.preparazione_percentuale < 70 ? '#f59e0b' : '#22c55e'
                }}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <span className="text-sm text-slate-500 dark:text-slate-400 capitalize">
            {exam.modalita || 'Misto'}
          </span>
          <span className="text-coach-600 dark:text-coach-400 text-sm font-medium flex items-center gap-1">
            Apri Coach <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </Link>
  )
}
