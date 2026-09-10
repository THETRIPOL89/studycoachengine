import Link from 'next/link'
import { Plus, BookOpen } from 'lucide-react'

export function EmptyState() {
  return (
    <div className="card text-center py-16 dark:bg-slate-800 dark:border-slate-700">
      <div className="w-16 h-16 bg-coach-100 dark:bg-coach-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <BookOpen className="w-8 h-8 text-coach-600 dark:text-coach-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
        Nessun esame in corso
      </h3>
      <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
        Aggiungi il tuo primo esame e lascia che il Coach costruisca il tuo piano di studio ottimale.
      </p>
      <Link href="/exam/new" className="btn-primary inline-flex" data-tour="nuovo-esame">
        <Plus className="w-5 h-5" />
        Aggiungi esame
      </Link>
    </div>
  )
}
