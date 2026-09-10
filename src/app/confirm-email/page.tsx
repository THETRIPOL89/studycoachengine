'use client'

import { Suspense, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { GraduationCap, Mail, ArrowLeft, RefreshCw, Loader2 } from 'lucide-react'

function ConfirmEmailInner() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email')

  const emailLabel = useMemo(() => {
    if (!email) return null
    try {
      return decodeURIComponent(email)
    } catch {
      return email
    }
  }, [email])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-3 sm:px-4 py-10 transition-colors">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-11 h-11 bg-coach-600 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-900 dark:text-white">Study Coach</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Il tuo tutor personale</p>
          </div>
        </div>

        <div className="card text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-coach-100 dark:bg-coach-900/40 flex items-center justify-center">
            <Mail className="w-7 h-7 text-coach-600 dark:text-coach-400" />
          </div>

          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Controlla la tua email
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-1">
            Ti abbiamo inviato un link di conferma
            {emailLabel ? (
              <>
                {' '}a{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200 break-all">
                  {emailLabel}
                </span>
              </>
            ) : (
              '.'
            )}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
            Apri la mail e clicca sul link per attivare l&apos;account. Poi potrai accedere e creare il tuo primo esame.
          </p>

          <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-left mb-6 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Non trovi la mail?
            </p>
            <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1.5 list-disc list-inside">
              <li>Controlla la cartella spam / promozioni</li>
              <li>Attendi 1–2 minuti e ricarica la casella</li>
              <li>Verifica di aver digitato bene l&apos;indirizzo</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <Link href="/login" className="btn-primary w-full">
              Torna al login
            </Link>
            <Link
              href={emailLabel ? `/login?email=${encodeURIComponent(emailLabel)}` : '/login'}
              className="btn-secondary w-full text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Ho confermato, accedi
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
          <Link href="/login" className="inline-flex items-center gap-1 hover:text-coach-600 dark:hover:text-coach-400 transition-colors">
            <ArrowLeft className="w-3 h-3" />
            Indietro
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function ConfirmEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-coach-500 animate-spin" />
        </div>
      }
    >
      <ConfirmEmailInner />
    </Suspense>
  )
}