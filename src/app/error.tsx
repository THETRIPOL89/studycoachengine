'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log lato client per debugging (in prod va a Sentry/console)
    console.error('App error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
          Qualcosa è andato storto
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
          Si è verificato un errore inatteso. Riprova o torna alla dashboard.
        </p>
        {error.digest && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-6 font-mono">
            ID errore: {error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="btn-primary inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Riprova
          </button>
          <Link href="/dashboard" className="btn-secondary inline-flex items-center gap-2">
            <Home className="w-4 h-4" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
