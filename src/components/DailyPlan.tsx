'use client'

import { useState, useEffect } from 'react'
import { generateDailyPlan, markActivityComplete, PlanActivity } from '@/actions/coach'
import { createSession, completeSession } from '@/actions/sessions'
import { generateQuizFromMaterial } from '@/actions/groq'
import { getUserPlan } from '@/actions/subscription'
import { StudyTimer } from './StudyTimer'
import { SessionFeedback } from './SessionFeedback'
import { PaywallModal } from './PaywallModal'
import type { PaywallReason } from '@/lib/pricing'
// ... resto del file identico
import { Clock, BookOpen, CheckCircle, AlertCircle, Play, RefreshCw, Loader2, Sparkles, X } from 'lucide-react'

interface DailyPlanProps {
  examId: string
  initialPlan?: PlanActivity[] | null
  date: string
}

export function DailyPlan({ examId, initialPlan, date }: DailyPlanProps) {
  const [plan, setPlan] = useState<PlanActivity[] | null>(initialPlan || null)
  const [loading, setLoading] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  // Stato piano utente: passato a StudyTimer per il gate dell'AI Tutor.
  const [isPremium, setIsPremium] = useState<boolean | null>(null)
  const [paywallReason, setPaywallReason] = useState<PaywallReason | null>(null)

  useEffect(() => {
    getUserPlan().then((p) => setIsPremium(p.isPremium))
  }, [])

  const [activeSession, setActiveSession] = useState<{
    activity: PlanActivity
    index: number
    sessionId: string
  } | null>(null)

  const [showFeedback, setShowFeedback] = useState<{
    activity: PlanActivity
    index: number
    sessionId: string
    durataEffettiva: number
  } | null>(null)

  const [completedActivities, setCompletedActivities] = useState<Set<number>>(new Set())

  const [showQuiz, setShowQuiz] = useState<{ activity: PlanActivity, quiz: any[]; selectedAnswers: number[]; showResults: boolean } | null>(null)
  const [quizLoading, setQuizLoading] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    setGenerateError(null)
    const result = await generateDailyPlan(examId, date)
    if (result.error) {
      setGenerateError(result.error)
    } else if (result.plan) {
      setPlan(result.plan as PlanActivity[])
      setCompletedActivities(new Set())
    }
    setLoading(false)
  }

  async function handleStart(activity: PlanActivity, index: number) {
    const result = await createSession(
      examId,
      activity.topic_id,
      activity.attivita,
      activity.durata,
      activity.subtopic_id
    )

    if (result.error || !result.sessionId) {
      alert("Errore nell'avvio della sessione: " + (result.error || 'Nessun sessionId'))
      return
    }

    setActiveSession({
      activity,
      index,
      sessionId: result.sessionId
    })
  }

  async function handleGenerateQuiz(activity: PlanActivity) {
    if (!activity.topic_id) {
      alert('Nessun argomento associato per generare il quiz')
      return
    }
    setQuizLoading(true)
    const result = await generateQuizFromMaterial(examId, activity.topic_id, 'medium')
    if (result.error) {
      alert('Errore: ' + result.error)
    } else {
      const quiz = result.quiz || []
      setShowQuiz({ activity, quiz, selectedAnswers: new Array(quiz.length).fill(-1), showResults: false })
    }
    setQuizLoading(false)
  }

  function handleTimerComplete(durataEffettiva: number) {
    if (!activeSession) return
    setShowFeedback({
      activity: activeSession.activity,
      index: activeSession.index,
      sessionId: activeSession.sessionId,
      durataEffettiva
    })
    setActiveSession(null)
  }

  function handleTimerCancel() {
    setActiveSession(null)
  }

  async function handleFeedbackSubmit(feedback: {
    difficolta: number
    risultato_quiz: number | null
    note: string
  }) {
    if (!showFeedback) return

    const result = await completeSession(showFeedback.sessionId, examId, {
      ...feedback,
      durata_effettiva: showFeedback.durataEffettiva,
      topic_id: showFeedback.activity.topic_id,
      tipo_competenza: showFeedback.activity.tipo_competenza,
      subtopic_id: showFeedback.activity.subtopic_id
    })

    if (result.error) {
      alert('Errore: ' + result.error)
      setShowFeedback(null)
      return
    }

    await markActivityComplete(examId, date, showFeedback.index)

    setCompletedActivities(prev => new Set(prev).add(showFeedback.index))
    setShowFeedback(null)
    window.location.reload()
  }

  function handleFeedbackSkip() {
    setShowFeedback(null)
  }

  if (!plan) {
    return (
      <div className="card text-center py-12">
        <div className="w-14 h-14 bg-coach-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-7 h-7 text-coach-600" />
        </div>
        <h3 className="font-semibold text-slate-900 mb-2">Nessun piano per oggi</h3>
        <p className="text-slate-500 text-sm mb-4">Genera il tuo piano di studio personalizzato</p>
        {generateError && (
          <div className="mb-4 mx-auto max-w-sm p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex items-center gap-2 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left">{generateError}</span>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="text-xs font-semibold underline hover:no-underline disabled:opacity-50"
            >
              Riprova
            </button>
          </div>
        )}
        <button onClick={handleGenerate} disabled={loading} className="btn-primary">
          {loading ? (
            <Loader2 className="w-4 h-4 text-coach-500 animate-spin" />
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Genera piano
            </>
          )}
        </button>
      </div>
    )
  }

  const totalMinutes = plan.reduce((acc, a) => acc + a.durata, 0)
  const completedCount = completedActivities.size
  const allCompleted = completedCount === plan.length

  const hasQuizButton = (activity: PlanActivity) => {
    return activity.topic_id && (
      activity.tipo_competenza === 'esercizi' ||
      activity.tipo_competenza === 'problemi_complessi' ||
      activity.attivita.toLowerCase().includes('esercizi') ||
      activity.attivita.toLowerCase().includes('quiz')
    )
  }

  return (
    <>
      {activeSession && (
        <StudyTimer
          attivita={activeSession.activity.attivita}
          durataConsigliata={activeSession.activity.durata}
          motivo={activeSession.activity.motivo}
          topicId={activeSession.activity.topic_id}
          examId={examId}
          isPremium={isPremium ?? false}
          onComplete={handleTimerComplete}
          onCancel={handleTimerCancel}
          onRequestPaywall={() => setPaywallReason('ai_tutor')}
        />
      )}

      {showFeedback && (
        <SessionFeedback
          attivita={showFeedback.activity.attivita}
          durataEffettiva={showFeedback.durataEffettiva}
          onSubmit={handleFeedbackSubmit}
          onSkip={handleFeedbackSkip}
        />
      )}

      {paywallReason && (
        <PaywallModal
          reason={paywallReason}
          onClose={() => setPaywallReason(null)}
        />
      )}

      {/* Quiz Modal */}
      {showQuiz && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-5 gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 dark:text-white">Quiz AI</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 break-words">{showQuiz.activity.attivita}</p>
              </div>
              <button onClick={() => setShowQuiz(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 flex-shrink-0" aria-label="Chiudi quiz">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              {showQuiz.quiz.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">Nessuna domanda generata.</p>
              ) : (
                <>
                  {showQuiz.quiz.map((q: any, i: number) => {
                    const selected = showQuiz?.selectedAnswers?.[i] ?? -1;
                    // Normalizza i campi della domanda: i modelli AI
                    // occasionalmente restituiscono oggetti malformati
                    // (es. `opzioni` mancante, `risposta_corretta` fuori
                    // range). Senza guard qui l'intera modale crasha con
                    // "Cannot read properties of undefined (reading 'map')".
                    const opzioni: string[] = Array.isArray(q?.opzioni) ? q.opzioni : [];
                    const correctIdx = typeof q?.risposta_corretta === 'number' && q.risposta_corretta >= 0 && q.risposta_corretta < opzioni.length
                      ? q.risposta_corretta
                      : -1;
                    const isCorrect = selected !== -1 && selected === correctIdx;
                    const answered = selected !== -1;
                    const malformed = opzioni.length === 0 || typeof q?.testo !== 'string';
                    if (malformed) {
                      return (
                        <div key={i} className="border border-amber-200 rounded-xl p-4 bg-amber-50">
                          <p className="text-sm font-semibold text-amber-800 mb-1">
                            Domanda {i + 1} non disponibile
                          </p>
                          <p className="text-xs text-amber-700">
                            L'AI ha restituito una domanda in un formato non valido. Chiudi il quiz e riprova.
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div key={i} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                        <p className="text-sm font-semibold text-slate-800 mb-3">
                          {i + 1}. {q.testo}
                        </p>
                        <div className="space-y-2">
                          {opzioni.map((opt: string, j: number) => {
                            const isSelected = selected === j;
                            const showAnswer = showQuiz?.showResults ?? false;
                            const getLabelClass = () => {
                              const base = "flex items-center gap-3 text-sm text-slate-700 p-2.5 rounded-lg border border-slate-200 hover:border-coach-300 cursor-pointer transition-colors";
                              if (!showAnswer) return base + " bg-white";
                              if (isCorrect) return base + " bg-green-100 text-green-800 border-green-300";
                              if (isSelected && !isCorrect) return base + " bg-red-100 text-red-800 border-red-300";
                              return base + " bg-white";
                            };
                            return (
                              <label key={j} onClick={() => {
                                if (!showQuiz?.showResults) {
                                  setShowQuiz(prev => {
                                    if (!prev) return prev;
                                    const newSelected = [...prev.selectedAnswers];
                                    newSelected[i] = j;
                                    return { ...prev, selectedAnswers: newSelected };
                                  });
                                }
                              }} className={getLabelClass()}>
                                <input
                                  type="radio"
                                  name={`quiz-q-${i}`}
                                  checked={isSelected}
                                  onChange={() => { /* la selezione è gestita dal label onClick */ }}
                                  disabled={showQuiz?.showResults}
                                  className="accent-coach-600 w-4 h-4"
                                />
                                <span>{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                        {showQuiz?.showResults && q.spiegazione && (
                          <p className="text-xs text-slate-500 mt-3 italic">
                            Spiegazione: {q.spiegazione}
                          </p>
                        )}
                        {!showQuiz?.showResults && answered && !isCorrect && (
                          <p className="text-xs text-red-600 mt-2">
                            Risposta sbagliata. La corretta è: {correctIdx >= 0 ? opzioni[correctIdx] : 'non disponibile'}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  {!showQuiz?.showResults && (
                    <div className="flex justify-center">
                      <button
                        onClick={() => setShowQuiz(prev => {
                          if (!prev) return prev;
                          return { ...prev, showResults: true };
                        })}
                        className="btn-secondary text-xs px-4 py-2"
                      >
                        Verifica risposte
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end mt-4">
              <button onClick={() => setShowQuiz(null)} className="btn-primary w-auto">
                Chiudi quiz
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h3 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-white">Piano di oggi</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {totalMinutes} minuti totali
              {completedCount > 0 && (
                <span className="text-green-600 dark:text-green-400 font-medium ml-2">
                  ({completedCount}/{plan.length} completate)
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {allCompleted && (
              <span className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-3 py-1.5 rounded-full border border-green-200 dark:border-green-700">
                Piano completato!
              </span>
            )}
            <button onClick={handleGenerate} disabled={loading} className="btn-secondary font-medium">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Rigenera</span>
            </button>
          </div>
        </div>
        {generateError && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex items-center gap-2 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{generateError}</span>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="text-xs font-semibold underline hover:no-underline disabled:opacity-50"
            >
              Riprova
            </button>
          </div>
        )}

        <div className="mb-6">
          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-coach-500 rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / plan.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="space-y-3">
          {plan.map((activity, i) => {
            const isCompleted = completedActivities.has(i)

            return (
              <div
                key={i}
                className={`flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border transition-all ${
                  isCompleted
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 opacity-70'
                    : 'bg-slate-50 dark:bg-slate-700/50 border-slate-100 dark:border-slate-600'
                }`}
              >
                <div className="flex-shrink-0">
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center ${
                    isCompleted ? 'bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-300' : 'bg-coach-100 dark:bg-coach-900/40 text-coach-700 dark:text-coach-300'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <span className="font-bold text-sm">{i + 1}</span>
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap sm:flex-nowrap">
                  <h4 className={`font-semibold text-sm break-words min-w-0 ${isCompleted ? 'text-green-800 dark:text-green-300 line-through' : 'text-slate-900 dark:text-white'}`}>
                      {activity.attivita}
                    </h4>
                    <span className={`flex-shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded-md whitespace-nowrap ${
                      isCompleted
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-600'
                    }`}>
                      <Clock className="w-3 h-3" />
                      {activity.durata} min
                    </span>
                  </div>
                  <p
                    className={`text-xs mt-1 flex items-start gap-1.5 leading-relaxed ${
                      isCompleted ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'
                    }`}
                    title={(activity as any)._debug ? JSON.stringify((activity as any)._debug) : ''}
                  >
                    <AlertCircle className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${isCompleted ? 'text-green-500' : 'text-coach-500'}`} />
                    <span className="break-words">{activity.motivo}</span>
                  </p>

                  {!isCompleted && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => handleStart(activity, i)}
                        className="text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-coach-50 dark:hover:bg-coach-900/30 hover:border-coach-300 px-3 py-1.5 rounded-lg font-medium text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5"
                      >
                        <Play className="w-3 h-3 text-coach-600" /> Inizia
                      </button>
                      {hasQuizButton(activity) && (
                        <button
                          onClick={() => handleGenerateQuiz(activity)}
                          disabled={quizLoading}
                          className="text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:border-amber-300 px-3 py-1.5 rounded-lg font-medium text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5"
                        >
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          {quizLoading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            'Quiz AI'
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {allCompleted && (
          <div className="mt-6 p-4 bg-gradient-to-r from-coach-50 to-green-50 rounded-xl border border-coach-200 text-center">
            <p className="text-sm font-semibold text-coach-800">
              Ottimo lavoro! Hai completato tutte le attivita di oggi.
            </p>
            <p className="text-xs text-coach-600 mt-1">
              Il Coach aggiornera il piano per domani in base ai tuoi progressi.
            </p>
          </div>
        )}
      </div>
    </>
  )
}
