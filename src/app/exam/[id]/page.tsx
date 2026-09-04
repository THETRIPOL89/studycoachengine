'use client'

import { useState, useEffect } from 'react'
import { redirect } from 'next/navigation'
import { useParams } from 'next/navigation'
import { getUser } from '@/actions/auth'
import { getExamById } from '@/actions/exams'
import { getDailyPlan } from '@/actions/coach'
import { getMaterials } from '@/actions/materials'
import { signOut } from '@/actions/auth'
import { ExamTabs } from '@/components/ExamTabs'
import { CompetenceBar } from '@/components/CompetenceBar'
import { ExamDayBanner } from '@/components/ExamDayBanner'
import { daysUntil, formatDate } from '@/lib/utils'
import { ArrowLeft, LogOut, Calendar, Target, Clock, TrendingUp, GraduationCap, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function ExamPage() {
  const [user, setUser] = useState<any>(null)
  const [exam, setExam] = useState<any>(null)
  const [topics, setTopics] = useState<any[]>([])
  const [plan, setPlan] = useState<any>(null)
  const [materials, setMaterials] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { id } = useParams<{ id: string }>()

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setError(null)
        const [userRes, examRes, planRes, materialsRes] = await Promise.all([
          getUser(),
          getExamById(id),
          getDailyPlan(id, new Date().toISOString().split('T')[0]),
          getMaterials(id)
        ])
        setUser(userRes)
        if (examRes.exam) {
          setExam(examRes.exam)
          setTopics(examRes.topics ?? [])
        } else {
          setError('Esame non trovato')
        }
        setPlan(planRes.plan ?? null)
        setMaterials(materialsRes.materials ?? [])
        setLoading(false)
      } catch (err) {
        console.error('Failed to load exam data:', err)
        setError('Errore nel caricamento dei dati')
        setLoading(false)
      }
    }

    if (id) {
      loadData()
    } else {
      setError('ID esame non valido')
      setLoading(false)
    }
  }, [id])

  if (loading) return (
    <div className="flex h-[200px] items-center justify-center">
      <Loader2 className="w-8 h-8 text-coach-500 animate-spin" />
    </div>
  );
  if (error) return <div className="p-6">Errore: {error}</div>
  if (!user) {
    redirect('/login')
    return null
  }
  if (!exam) {
    redirect('/dashboard')
    return null
  }

  const avgCompetences = topics.length > 0 ? {
    teoria: Math.round(topics.reduce((a, t) => a + (t.competences?.[0]?.teoria || 0), 0) / topics.length),
    esercizi: Math.round(topics.reduce((a, t) => a + (t.competences?.[0]?.esercizi || 0), 0) / topics.length),
    problemi: Math.round(topics.reduce((a, t) => a + (t.competences?.[0]?.problemi_complessi || 0), 0) / topics.length),
    orale: Math.round(topics.reduce((a, t) => a + (t.competences?.[0]?.orale || 0), 0) / topics.length),
  } : { teoria: 0, esercizi: 0, problemi: 0, orale: 0 }

  const giorni = daysUntil(exam.data_esame)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-600 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/dashboard" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-colors flex-shrink-0" aria-label="Torna alla dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="font-bold text-base sm:text-xl text-slate-900 dark:text-white truncate">{exam.nome_esame}</h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate">{exam.universita} • {exam.corso}</p>
            </div>
          </div>
          <form action={signOut} className="flex-shrink-0">
            <button type="submit" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-colors" aria-label="Esci">
              <LogOut className="w-5 h-5" />
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <ExamDayBanner examName={exam.nome_esame} daysRemaining={giorni} />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-8">
          <div className="card py-3 sm:py-4 px-3 sm:px-6 min-w-0">
            <div className="flex items-center gap-2 text-coach-600 dark:text-coach-400 text-xs sm:text-sm mb-1">
              <Calendar className="w-4 h-4" /> Data
            </div>
            <p className="font-semibold text-coach-600 dark:text-coach-400 text-xs sm:text-sm break-words">{formatDate(exam.data_esame)}</p>
          </div>
          <div className="card py-3 sm:py-4 px-3 sm:px-6 min-w-0">
            <div className="flex items-center gap-2 text-coach-600 dark:text-coach-400 text-xs sm:text-sm mb-1">
              <Target className="w-4 h-4" /> Obiettivo
            </div>
            <p className="font-semibold text-coach-600 dark:text-coach-400 text-xs sm:text-sm">{exam.voto_obiettivo}/30</p>
          </div>
          <div className="card py-3 sm:py-4 px-3 sm:px-6 min-w-0">
            <div className="flex items-center gap-2 text-coach-600 dark:text-coach-400 text-xs sm:text-sm mb-1">
              <Clock className="w-4 h-4" /> Ore/giorno
            </div>
            <p className="font-semibold text-coach-600 dark:text-coach-400 text-xs sm:text-sm">{exam.ore_giorno}h</p>
          </div>
          <div className="card py-3 sm:py-4 px-3 sm:px-6 min-w-0">
            <div className="flex items-center gap-2 text-coach-600 dark:text-coach-400 text-xs sm:text-sm mb-1">
              <TrendingUp className="w-4 h-4" /> Preparazione
            </div>
            <p className={`font-semibold text-xs sm:text-sm ${exam.preparazione_percentuale < 30 ? 'text-red-600 dark:text-red-400' : exam.preparazione_percentuale < 70 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>{exam.preparazione_percentuale}%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2 space-y-4 sm:space-y-6 min-w-0">
            <ExamTabs
              examId={exam.id}
              initialPlan={plan?.piano_json as any}
              date={new Date().toISOString().split('T')[0]}
              materials={materials}
              initialOreGiorno={exam.ore_giorno}
            />
          </div>

          <div className="space-y-4 sm:space-y-6 min-w-0">
            <div className="card">
              <h3 className="font-bold text-coach-600 dark:text-coach-400 mb-3 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-coach-500" />
                Competenze
              </h3>
              <div className="space-y-4">
                <CompetenceBar label="Teoria" value={avgCompetences.teoria} color="bg-blue-500" />
                <CompetenceBar label="Esercizi" value={avgCompetences.esercizi} color="bg-green-500" />
                <CompetenceBar label="Problemi complessi" value={avgCompetences.problemi} color="bg-purple-500" />
                <CompetenceBar label="Orale" value={avgCompetences.orale} color="bg-orange-500" />
              </div>
            </div>

            <div className="card">
              <h3 className="font-bold text-coach-600 dark:text-coach-400 mb-3">Argomenti</h3>
              <div className="space-y-1">
                {topics.map((topic) => (
                  <div key={topic.id} className="flex items-center justify-between gap-2 py-2 border-b border-slate-100 dark:border-slate-600 last:border-0">
                    <span className="text-sm text-slate-700 dark:text-slate-300 min-w-0 break-words">{topic.nome_argomento}</span>
                    <div className="flex gap-1 flex-shrink-0">
                      {Array.from({ length: topic.peso }).map((_, i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-coach-400" />
                      ))}
                    </div>
                  </div>
                ))}
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
                {exam.preparazione_percentuale < 40
                  ? `Preparazione sotto la soglia critica. Con ${giorni} giorni rimanenti, devi aumentare il ritmo.`
                  : exam.preparazione_percentuale < 70
                  ? `Sei in miglioramento. Concentrati sugli esercizi: e il tuo punto debole piu critico.`
                  : `Ottimo lavoro! Mantieni questo ritmo. Fase finale: simulazioni e consolidamento.`
                }
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}