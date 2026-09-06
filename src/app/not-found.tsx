import Link from 'next/link'
import { Home, Search } from 'lucide-react'

export const metadata = {
  title: 'Pagina non trovata'
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-coach-100 dark:bg-coach-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Search className="w-10 h-10 text-coach-600 dark:text-coach-400" />
        </div>
        <h1 className="text-5xl font-bold text-slate-900 dark:text-white mb-3">404</h1>
        <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-2">
          Pagina non trovata
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
          La pagina che stai cercando non esiste o è stata spostata.
        </p>
        <Link
          href="/dashboard"
          className="btn-primary inline-flex items-center gap-2"
        >
          <Home className="w-4 h-4" />
          Torna alla dashboard
        </Link>
      </div>
    </div>
  )
}
