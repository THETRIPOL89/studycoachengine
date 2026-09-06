'use client'

import { formatDate } from '@/lib/utils'
import { submitPostExam } from '@/actions/post-exam'
import { PostExamModal } from '@/components/PostExamModal'
import { useState } from 'react'
import { CheckCircle, XCircle, ArrowRight, Calendar, Clock, Target, TrendingUp, GraduationCap } from 'lucide-react'
import { CompetenceBar } from '@/components/CompetenceBar'

const FACCINA_EMOJI: Record<number, string> = {
  1: '😞',
  2: '😕',
  3: '😐',
  4: '🙂',
  5: '😄'
}

interface ExamSummaryProps {
  examProp: {
    id: string
    nome_esame: string
    universita: string | null
    corso: string | null
    data_esame: string
    voto_obiettivo: number
    voto_finale: number | null
    soddisfazione: number | null
    stato: 'in_corso' | 'completato' | 'sospeso'
    preparazione_percentuale: number
  }
  sessionCount: number
  totalMinutesStudied: number
  avgCompetences: {
    teoria: number
    esercizi: number
    problemi: number
    orale: number
  }
}

export function ExamSummary({ examProp, sessionCount, totalMinutesStudied, avgCompetences }: ExamSummaryProps) {
  const [exam, setExam] = useState(examProp)
  const [showPostExamModal, setShowPostExamModal] = useState(false)

  const handlePostExamSubmit = async (data: {
    superato: boolean
    voto: number | null
    soddisfazione: number | null
    argomenti_usciti: string
    domande_ricevute: string
  }) => {
    const result = await submitPostExam(exam.id, data)
    if (result.success) {
      // Update exam locally with submitted data
      setExam(prev => ({
        ...prev,
        voto_finale: data.voto,
        soddisfazione: data.soddisfazione,
        stato: data.superato ? 'completato' : 'sospeso'
      }))
      setShowPostExamModal(false)
    } else {
      // TODO: handle error
      console.error('Failed to submit post-exam feedback:', result.error)
    }
  }

  const formattedDate = formatDate(exam.data_esame)
  const totalHours = Math.floor(totalMinutesStudied / 60)
  const totalMinutes = totalMinutesStudied % 60
  const timeString = totalHours > 0
    ? `${totalHours} h ${totalMinutes} min`
    : `${totalMinutes} min`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-bold text-2xl text-slate-900 dark:text-white break-words">
            {exam.nome_esame}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 break-words">
            {exam.universita} • {exam.corso}
          </p>
        </div>
        {exam.voto_finale !== null && (
          <div className="flex items-center gap-3">
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
            {exam.soddisfazione !== null && (
              <div className="flex-shrink-0 text-2xl" title={`Soddisfazione: ${exam.soddisfazione}/5`}>
                {FACCINA_EMOJI[exam.soddisfazione]}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        <div className="card py-3 sm:py-4 px-3 sm:px-6 min-w-0">
          <div className="flex items-center gap-2 text-coach-600 dark:text-coach-400 text-xs sm:text-sm mb-1">
            <Calendar className="w-4 h-4" /> Data
          </div>
          <p className="font-semibold text-coach-600 dark:text-coach-400 text-xs sm:text-sm break-words">
            {formattedDate}
          </p>
        </div>
        <div className="card py-3 sm:py-4 px-3 sm:px-6 min-w-0">
          <div className="flex items-center gap-2 text-coach-600 dark:text-coach-400 text-xs sm:text-sm mb-1">
            <Target className="w-4 h-4" /> Obiettivo
          </div>
          <p className="font-semibold text-coach-600 dark:text-coach-400 text-xs sm:text-sm">{exam.voto_obiettivo}/30</p>
        </div>
        <div className="card py-3 sm:py-4 px-3 sm:px-6 min-w-0">
          <div className="flex items-center gap-2 text-coach-600 dark:text-coach-400 text-xs sm:text-sm mb-1">
            <Clock className="w-4 h-4" /> Tempo studio
          </div>
          <p className="font-semibold text-coach-600 dark:text-coach-400 text-xs sm:text-sm">{timeString}</p>
        </div>
        <div className="card py-3 sm:py-4 px-3 sm:px-6 min-w-0">
          <div className="flex items-center gap-2 text-coach-600 dark:text-coach-400 text-xs sm:text-sm mb-1">
            <TrendingUp className="w-4 h-4" /> Sessioni
          </div>
          <p className="font-semibold text-coach-600 dark:text-coach-400 text-xs sm:text-sm">{sessionCount}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card">
          <h3 className="font-bold text-coach-600 dark:text-coach-400 mb-3 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-coach-500" />
            Competenze medie
          </h3>
          <div className="space-y-4">
            <CompetenceBar label="Teoria" value={avgCompetences.teoria} color="bg-blue-500" />
            <CompetenceBar label="Esercizi" value={avgCompetences.esercizi} color="bg-green-500" />
            <CompetenceBar label="Problemi complessi" value={avgCompetences.problemi} color="bg-purple-500" />
            <CompetenceBar label="Orale" value={avgCompetences.orale} color="bg-orange-500" />
          </div>
        </div>
      </div>

      <div className="bg-slate-900 dark:bg-slate-950 rounded-2xl p-4 sm:p-5 text-white">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 bg-coach-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-xs text-coach-300 uppercase tracking-wider">Coach</span>
        </div>
        <p className="text-sm text-coach-200 leading-relaxed break-words">
          Esame sostenuto il {formattedDate}
        </p>
        {exam.preparazione_percentuale < 40
          ? `Preparazione sotto la soglia critica. Con ${daysUntil(exam.data_esame)} giorni rimanenti, devi aumentare il ritmo.`
          : exam.preparazione_percentuale < 70
          ? `Sei in miglioramento. Concentrati sugli esercizi: e il tuo punto debole piu critico.`
          : `Ottimo lavoro! Mantieni questo ritmo. Fase finale: simulazioni e consolidamento.`
        }
      </div>

      {exam.voto_finale === null && (
        <div className="mt-6">
          <button
            onClick={() => setShowPostExamModal(true)}
            className="btn-primary w-full"
          >
            Lascia feedback
          </button>
        </div>
      )}

      {showPostExamModal && (
      <PostExamModal
        examName={exam.nome_esame}
        onSubmit={handlePostExamSubmit}
        onClose={() => setShowPostExamModal(false)}
      />
)}
    </div>
  )
}

// Helper function to calculate days until exam (same as in lib/utils.ts)
function daysUntil(dateString: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateString)
  target.setHours(0, 0, 0, 0)
  const diffTime = target.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}