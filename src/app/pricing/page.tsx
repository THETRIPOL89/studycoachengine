'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, X, Lock, Sparkles, ArrowLeft, Loader2 } from 'lucide-react'
import { PLANS, type PlanKey } from '@/lib/pricing'
import { getUserPlan, createCheckoutSession } from '@/actions/subscription'
import { DarkModeToggle } from '@/components/DarkModeToggle'

export default function PricingPage() {
  const router = useRouter()
  const [isPremium, setIsPremium] = useState<boolean | null>(null)
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null)
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    getUserPlan().then((p) => {
      setIsPremium(p.isPremium)
      setPremiumUntil(p.premiumUntil)
    })
  }, [])

  function handleSelect(plan: PlanKey) {
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
        window.location.assign(result.url)
      }
    })
  }

  const compareFeatures: Array<{ label: string; free: string | boolean; premium: string | boolean }> = [
    { label: 'Esami attivi', free: '1', premium: 'Illimitati' },
    { label: 'Materiali per esame', free: '1', premium: 'Illimitati' },
    { label: 'AI Tutor (spiegazioni)', free: false, premium: true },
    { label: 'Piano di studio giornaliero', free: true, premium: true },
    { label: 'Timer di studio + feedback', free: true, premium: true },
    { label: 'Calendario e sessioni', free: true, premium: true },
    { label: 'Post-esame feedback', free: true, premium: true },
    { label: 'Analisi AI dei materiali', free: '1 materiale', premium: 'Illimitati' }
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 hover:text-coach-600 dark:hover:text-coach-400"
          >
            <ArrowLeft size={16} />
            Torna alla dashboard
          </Link>
          <DarkModeToggle />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 sm:py-16">
        {/* Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-semibold mb-4">
            <Sparkles size={14} />
            Study Coach Premium
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-3">
            Studia senza limiti
          </h1>
          <p className="text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            Sblocca esami illimitati, materiali illimitati e l'AI Tutor che ti spiega
            qualsiasi concetto, in italiano, in tempo reale.
          </p>

          {isPremium === true && premiumUntil && (
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm">
              <Check size={14} />
              Sei Premium fino al {new Date(premiumUntil).toLocaleDateString('it-IT')}
            </div>
          )}
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {PLANS.sort((a, b) => a.sortOrder - b.sortOrder).map((plan) => {
            const isLoading = loadingPlan === plan.key
            return (
              <div
                key={plan.key}
                className={[
                  'relative rounded-2xl p-6 border-2 transition-all flex flex-col',
                  plan.isRecommended
                    ? 'border-coach-500 bg-white dark:bg-slate-800 shadow-xl'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm'
                ].join(' ')}
              >
                {plan.isRecommended && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full uppercase tracking-wider">
                    Consigliato
                  </span>
                )}

                <div className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                  {plan.key === 'monthly' ? 'Mensile' : plan.key === 'semestral' ? 'Semestrale' : 'Annuale'}
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold text-slate-900 dark:text-white">
                    {plan.totalDisplay}
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {plan.periodDisplay}
                  </span>
                </div>
                {plan.effectiveMonthly && (
                  <div className="text-xs text-coach-600 dark:text-coach-400 font-medium mb-1">
                    {plan.effectiveMonthly}/mese effettivi
                  </div>
                )}
                {plan.savingBadge && (
                  <div className="inline-block self-start mt-1 mb-3 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded">
                    {plan.savingBadge}
                  </div>
                )}
                {!plan.savingBadge && <div className="h-5 mb-3" />}

                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                  {plan.pitch}
                </p>

                <button
                  onClick={() => handleSelect(plan.key)}
                  disabled={isPremium === true || isLoading}
                  className={[
                    'mt-auto w-full py-2.5 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2',
                    plan.isRecommended
                      ? 'bg-coach-600 hover:bg-coach-700 text-white disabled:bg-slate-300'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-white disabled:opacity-50'
                  ].join(' ')}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Reindirizzamento...
                    </>
                  ) : isPremium ? (
                    'Sei già Premium'
                  ) : (
                    'Abbonati'
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3 mb-6 text-center">
            {error}
          </div>
        )}

        {/* Compare table */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-10">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Confronto dettagliato
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/40">
                  <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">
                    Funzione
                  </th>
                  <th className="text-center px-6 py-3 font-semibold text-slate-600 dark:text-slate-300 w-32">
                    Free
                  </th>
                  <th className="text-center px-6 py-3 font-semibold text-coach-700 dark:text-coach-300 w-32">
                    Premium
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {compareFeatures.map((f) => (
                  <tr key={f.label}>
                    <td className="px-6 py-3 text-slate-700 dark:text-slate-300">{f.label}</td>
                    <td className="px-6 py-3 text-center">
                      {typeof f.free === 'boolean' ? (
                        f.free ? (
                          <Check className="w-5 h-5 text-emerald-500 inline" />
                        ) : (
                          <X className="w-5 h-5 text-slate-300 dark:text-slate-600 inline" />
                        )
                      ) : (
                        <span className="text-slate-600 dark:text-slate-400">{f.free}</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {typeof f.premium === 'boolean' ? (
                        f.premium ? (
                          <Check className="w-5 h-5 text-emerald-500 inline" />
                        ) : (
                          <X className="w-5 h-5 text-slate-300 dark:text-slate-600 inline" />
                        )
                      ) : (
                        <span className="font-semibold text-coach-700 dark:text-coach-300">
                          {f.premium}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-coach-500" />
            Domande frequenti
          </h2>
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Posso cancellare in qualsiasi momento?
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Sì. L'abbonamento si gestisce dal portale Stripe: cancelli quando vuoi,
                continui a usare Premium fino alla fine del periodo pagato.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Cosa succede se smetto di essere Premium?
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Resti con i tuoi esami esistenti. Però non potrai crearne di nuovi oltre
                il limite Free (1 esame attivo, 1 materiale per esame) né usare l'AI Tutor.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                I miei dati sono al sicuro?
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                I pagamenti sono gestiti interamente da Stripe (PCI SAQ A): noi non
                vediamo mai i dati della tua carta. Le modifiche al tuo account
                passano da un webhook firmato e verificato.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Posso cambiare piano?
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Sì, dal portale Stripe dopo il primo acquisto. Le variazioni di prezzo
                vengono riproporzionate automaticamente.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
