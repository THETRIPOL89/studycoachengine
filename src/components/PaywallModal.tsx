'use client'

import { useState, useTransition } from 'react'
import { X, Lock, Sparkles, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { PLANS, PAYWALL_REASON_COPY, type PlanKey, type PaywallReason } from '@/lib/pricing'
import { createCheckoutSession } from '@/actions/subscription'

interface PaywallModalProps {
  reason: PaywallReason
  onClose: () => void
}

/**
 * Modale mostrata quando un free user tenta un'azione premium.
 * Riusa il pattern `fixed inset-0 bg-black/60 ... z-50` di DailyPlan/MaterialUploader.
 *
 * Mostra 3 card con i piani disponibili. Click su una card → createCheckoutSession
 * server action → window.location.assign(Stripe Checkout URL).
 *
 * IMPORTANTE: questa è SOLO UX. Il check vero è server-side in
 * checkPaywall / checkPaywallMaterial / isPremium dentro groq.ts.
 */
export function PaywallModal({ reason, onClose }: PaywallModalProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  const copy = PAYWALL_REASON_COPY[reason]

  function handleSelectPlan(plan: PlanKey) {
    setError(null)
    setLoadingPlan(plan)
    startTransition(async () => {
      const result = await createCheckoutSession(plan)
      setLoadingPlan(null)
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.url) {
        // Redirect a Stripe Checkout hosted.
        window.location.assign(result.url)
      }
    })
  }

  const benefits = [
    'Esami illimitati',
    'Materiali illimitati per esame',
    'AI Tutor con spiegazioni personalizzate',
    'Piani di studio ottimizzati senza limiti'
  ]

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose()
      }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="relative p-5 sm:p-8 border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            disabled={pending}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
            aria-label="Chiudi"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-3 mb-3 pr-10">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex-shrink-0">
              <Lock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
              Funzione Premium
            </span>
          </div>
          <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2 break-words">
            {copy.title}
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base break-words">{copy.subtitle}</p>
        </div>

        {/* Body: 3 card piani */}
        <div className="p-5 sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {PLANS.sort((a, b) => a.sortOrder - b.sortOrder).map((plan) => {
              const isLoading = loadingPlan === plan.key
              return (
                <button
                  key={plan.key}
                  onClick={() => handleSelectPlan(plan.key)}
                  disabled={pending}
                  className={[
                    'relative text-left p-4 rounded-xl border-2 transition-all',
                    'hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 min-w-0',
                    plan.isRecommended
                      ? 'border-coach-500 bg-coach-50 dark:bg-coach-900/20 dark:border-coach-400'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  ].join(' ')}
                >
                  {plan.isRecommended && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-full uppercase tracking-wider whitespace-nowrap">
                      Consigliato
                    </span>
                  )}

                  <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                    {plan.key === 'monthly' ? 'Mensile' : plan.key === 'semestral' ? 'Semestrale' : 'Annuale'}
                  </div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {plan.totalDisplay}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {plan.periodDisplay}
                  </div>
                  {plan.effectiveMonthly && (
                    <div className="text-[11px] text-coach-600 dark:text-coach-400 mt-1.5 font-medium">
                      {plan.effectiveMonthly}/mese effettivi
                    </div>
                  )}
                  {plan.savingBadge && (
                    <div className="inline-block mt-2 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold rounded">
                      {plan.savingBadge}
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400">
                    {isLoading ? 'Reindirizzamento a Stripe...' : 'Clicca per abbonarti'}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Benefits list */}
          <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl p-4 mb-4">
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1.5">
              <Sparkles size={16} className="text-coach-500" />
              Cosa sblocchi
            </div>
            <ul className="space-y-1.5">
              {benefits.map((b) => (
                <li key={b} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <Check size={14} className="text-emerald-500 flex-shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3 mb-3">
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span>Pagamento sicuro via Stripe. Cancellazione in qualsiasi momento.</span>
            <button
              onClick={() => router.push('/pricing')}
              disabled={pending}
              className="text-coach-600 dark:text-coach-400 hover:underline font-medium"
            >
              Vedi confronto completo →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
