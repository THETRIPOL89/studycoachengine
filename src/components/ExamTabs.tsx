'use client'

import { useState } from 'react'
import { DailyPlan } from './DailyPlan'
import { MaterialUploader } from './MaterialUploader'
import { StudyCalendar } from './StudyCalendar'
import { updateExam, reseedTopicsFromTemplate } from '@/actions/exams'
import type { Exam } from '@/types/database'
import { BookOpen, FileText, Pencil, X, Clock, Loader2, CalendarDays, Beaker, Brain, Wrench } from 'lucide-react'

interface ExamTabsProps {
  examId: string
  initialPlan: any
  date: string
  materials: any[]
  initialOreGiorno: number
  initialCategoria: Exam['categoria']
  initialSessionCount: number
  initialTab?: 'piano' | 'materiali' | 'calendario'
}

const CATEGORIA_LABEL: Record<Exam['categoria'], string> = {
  scientifica: 'Scientifica',
  mnemonica: 'Mnemonica',
  applicativa: 'Applicativa',
}

const CATEGORIA_ICON: Record<Exam['categoria'], typeof Beaker> = {
  scientifica: Beaker,
  mnemonica: Brain,
  applicativa: Wrench,
}

export function ExamTabs({
  examId,
  initialPlan,
  date,
  materials,
  initialOreGiorno,
  initialCategoria,
  initialSessionCount,
  initialTab,
}: ExamTabsProps) {
  const [activeTab, setActiveTab] = useState<'piano' | 'materiali' | 'calendario'>(
    initialTab ?? 'piano'
  )
  const [showEditHours, setShowEditHours] = useState(false)
  const [showEditCategory, setShowEditCategory] = useState(false)
  const [oreGiorno, setOreGiorno] = useState(initialOreGiorno)
  const [categoria, setCategoria] = useState<Exam['categoria']>(initialCategoria)
  const [saving, setSaving] = useState(false)
  const [reseeding, setReseeding] = useState(false)

  async function handleSaveHours() {
    setSaving(true)
    const result = await updateExam(examId, { ore_giorno: oreGiorno })
    if (result.error) {
      alert('Errore: ' + result.error)
    } else {
      setShowEditHours(false)
      window.location.reload()
    }
    setSaving(false)
  }

  async function handleSaveCategory() {
    setSaving(true)
    const result = await updateExam(examId, { categoria })
    if (result.error) {
      alert('Errore: ' + result.error)
    } else {
      setShowEditCategory(false)
      window.location.reload()
    }
    setSaving(false)
  }

  async function handleReseedFromTemplate() {
    if (!confirm('Rigenerare gli argomenti dal template di categoria? Verranno cancellati tutti gli argomenti attuali (non sono ancora state registrate sessioni di studio).')) return
    setReseeding(true)
    const result = await reseedTopicsFromTemplate(examId, categoria)
    if (result.error) {
      alert('Errore: ' + result.error)
    } else {
      setShowEditCategory(false)
      window.location.reload()
    }
    setReseeding(false)
  }

  const CategoriaIcon = CATEGORIA_ICON[categoria]

  return (
    <div>
      <div className="border-b border-slate-200 dark:border-slate-700 mb-6">
        <div className="flex items-center gap-1 overflow-x-auto -mx-1 px-1 scrollbar-hide">
          <button
            onClick={() => setActiveTab('piano')}
            className={`whitespace-nowrap px-3 sm:px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex-shrink-0 ${
              activeTab === 'piano'
                ? 'text-coach-600 border-coach-600'
                : 'text-slate-500 border-transparent hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4 inline mr-1.5" />
            Piano di studio
          </button>
          <button
            onClick={() => setActiveTab('materiali')}
            className={`whitespace-nowrap px-3 sm:px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex-shrink-0 ${
              activeTab === 'materiali'
                ? 'text-coach-600 border-coach-600'
                : 'text-slate-500 border-transparent hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-1.5" />
            Materiali ({materials.length})
          </button>
          <button
            onClick={() => setActiveTab('calendario')}
            className={`whitespace-nowrap px-3 sm:px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex-shrink-0 ${
              activeTab === 'calendario'
                ? 'text-coach-600 border-coach-600'
                : 'text-slate-500 border-transparent hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <CalendarDays className="w-4 h-4 inline mr-1.5" />
            Calendario
          </button>
        </div>

        <div className="flex justify-end flex-wrap gap-1 pt-2 pb-1">
          <button
            onClick={() => setShowEditCategory(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-coach-600 dark:text-slate-400 dark:hover:text-coach-400 px-3 py-1.5 rounded-lg hover:bg-coach-50 dark:hover:bg-coach-900/20 transition-colors"
            title="Modifica categoria"
          >
            <CategoriaIcon className="w-3.5 h-3.5" />
            {CATEGORIA_LABEL[categoria]}
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={() => setShowEditHours(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-coach-600 dark:text-slate-400 dark:hover:text-coach-400 px-3 py-1.5 rounded-lg hover:bg-coach-50 dark:hover:bg-coach-900/20 transition-colors"
          >
            <Clock className="w-3.5 h-3.5" />
            {initialOreGiorno}h/giorno
            <Pencil className="w-3 h-3" />
          </button>
        </div>
      </div>

      {activeTab === 'piano' && (
        <DailyPlan examId={examId} initialPlan={initialPlan} date={date} />
      )}

      {activeTab === 'materiali' && (
        <div className="card dark:bg-slate-800 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
            <FileText className="w-5 h-5 text-coach-500" />
            Materiali di studio
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Carica PDF o slide. L'AI analizzera automaticamente gli argomenti.
          </p>
          <MaterialUploader examId={examId} initialMaterials={materials} />
        </div>
      )}

      {activeTab === 'calendario' && (
        <StudyCalendar examId={examId} />
      )}

      {showEditHours && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-900 dark:text-white">Modifica ore di studio</h3>
              <button onClick={() => setShowEditHours(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400" aria-label="Chiudi">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label flex items-center gap-2 dark:text-slate-300">
                  <Clock className="w-4 h-4 text-coach-500" />
                  Ore al giorno
                </label>
                <select
                  value={oreGiorno}
                  onChange={(e) => setOreGiorno(parseInt(e.target.value))}
                  className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                >
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
                    <option key={n} value={n}>{n} {n === 1 ? 'ora' : 'ore'}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleSaveHours}
                disabled={saving}
                className="btn-primary w-full"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
                Salva
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditCategory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-900 dark:text-white">Modifica categoria</h3>
              <button onClick={() => setShowEditCategory(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400" aria-label="Chiudi">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label flex items-center gap-2 dark:text-slate-300">
                  <CategoriaIcon className="w-4 h-4 text-coach-500" />
                  Categoria materia
                </label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value as Exam['categoria'])}
                  className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                >
                  <option value="scientifica">Scientifica (es. Ingegneria)</option>
                  <option value="mnemonica">Mnemonica (es. Giurisprudenza)</option>
                  <option value="applicativa">Applicativa (es. Economia)</option>
                </select>
              </div>

              <button
                onClick={handleSaveCategory}
                disabled={saving}
                className="btn-primary w-full"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
                Salva categoria
              </button>

              {initialSessionCount === 0 && (
                <>
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                      Non hai ancora registrato sessioni di studio. Se vuoi, puoi anche
                      <strong> rigenerare gli argomenti</strong> dal template della nuova categoria
                      (verranno cancellati quelli attuali).
                    </p>
                    <button
                      onClick={handleReseedFromTemplate}
                      disabled={reseeding || saving}
                      className="w-full text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-800 dark:text-amber-300 font-medium px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      {reseeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      Rigenera da template
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
