import Link from 'next/link'
import type { Metadata } from 'next'
import {
  GraduationCap,
  BookOpen,
  Sparkles,
  Target,
  Clock,
  ArrowRight,
  Timer,
  Tag,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Study Coach — Il tuo tutor personale universitario',
  description:
    'AI personal study coach per studenti universitari. Piani di studio giornalieri, tracking competenze e tutor AI. Offerta di lancio a tempo limitato.',
  alternates: {
    canonical: '/',
  },
}

/** Cambia questa data quando l'offerta scade (ISO: YYYY-MM-DD) */
const LAUNCH_OFFER_END = '2026-10-15'
const LAUNCH_DISCOUNT = 40 // %

export default function HomePage() {
  const offerEndLabel = new Date(LAUNCH_OFFER_END).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white">
      {/* Banner offerta lancio */}
      <div className="bg-coach-600 text-white">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3 text-center text-sm">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <Tag className="w-3.5 h-3.5" />
            Offerta di lancio
          </span>
          <span className="text-coach-100">
            <strong className="text-white">{LAUNCH_DISCOUNT}% di sconto</strong> sul primo
            abbonamento — solo fino al {offerEndLabel}
          </span>
          <Link
            href="/pricing"
            className="underline underline-offset-2 font-medium hover:text-white text-coach-50"
          >
            Scopri i piani →
          </Link>
        </div>
      </div>

      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-coach-600 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm sm:text-base">Study Coach</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                Il tuo tutor personale
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-coach-600 px-3 py-2 rounded-lg"
            >
              Accedi
            </Link>
            <Link href="/pricing" className="btn-primary text-sm py-2 px-3">
              Sblocca l&apos;offerta
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="max-w-5xl mx-auto px-4 py-14 sm:py-20 text-center">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-coach-600 dark:text-coach-400 bg-coach-50 dark:bg-coach-900/30 px-3 py-1 rounded-full mb-5">
            <Sparkles className="w-3.5 h-3.5" />
            AI study coach universitario
          </p>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4 max-w-3xl mx-auto leading-tight">
            Non devi più decidere cosa studiare.
            <span className="text-coach-600 dark:text-coach-400"> Il Coach lo fa per te.</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mb-6 leading-relaxed">
            Study Coach è il tutor AI per studenti universitari: crea piani giornalieri,
            tiene traccia delle competenze e ti dice esattamente su cosa concentrarti
            con il tempo che hai oggi.
          </p>

          {/* Card offerta */}
          <div className="max-w-md mx-auto mb-8 text-left rounded-2xl border-2 border-coach-500 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
            <div className="bg-coach-600 text-white px-4 py-2 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide">
              <span className="inline-flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5" />
                A tempo limitato
              </span>
              <span>Lancio app</span>
            </div>
            <div className="p-4 sm:p-5">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                Prezzo di lancio per chi si abbona ora
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                −{LAUNCH_DISCOUNT}%{' '}
                <span className="text-base font-semibold text-coach-600 dark:text-coach-400">
                  sul primo abbonamento
                </span>
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
                Stiamo lanciando Study Coach adesso. Chi entra in questa fase ottiene lo
                sconto di lancio: dopo il {offerEndLabel} tornerà il prezzo pieno.
              </p>
              <Link href="/pricing" className="btn-primary w-full text-sm">
                Approfitta dell&apos;offerta
                <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="text-[11px] text-slate-400 mt-2 text-center">
                Valida fino al {offerEndLabel} · Annulli quando vuoi
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/login" className="btn-secondary text-base px-6 py-3">
              Crea account gratis
            </Link>
            <Link href="/pricing" className="text-sm font-medium text-coach-600 dark:text-coach-400 hover:underline">
              Confronta i piani →
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-5xl mx-auto px-4 pb-16 sm:pb-24">
          <h2 className="text-xl sm:text-2xl font-bold text-center mb-8">
            Come ti aiuta a superare gli esami
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <Feature
              icon={<Target className="w-5 h-5 text-coach-600" />}
              title="Piano del giorno"
              text="Apri l'app e sai subito cosa studiare. Priorità basate su data esame, preparazione e obiettivo di voto."
            />
            <Feature
              icon={<BookOpen className="w-5 h-5 text-coach-600" />}
              title="Competenze tracciate"
              text="Teoria, esercizi, problemi, orale: il Coach aggiorna i punteggi dopo ogni sessione."
            />
            <Feature
              icon={<Clock className="w-5 h-5 text-coach-600" />}
              title="Timer + AI Tutor"
              text="Studia con il timer integrato e chiedi spiegazioni all'AI quando resti bloccato."
            />
          </div>
        </section>

        {/* CTA finale */}
        <section className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="max-w-5xl mx-auto px-4 py-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-coach-600 dark:text-coach-400 mb-2">
              Offerta di lancio · −{LAUNCH_DISCOUNT}%
            </p>
            <h2 className="text-xl sm:text-2xl font-bold mb-3">
              Ora è il momento di abbonarsi
            </h2>
            <p className="text-slate-600 dark:text-slate-300 mb-6 max-w-lg mx-auto">
              Il sito è appena online. Chi si abbona entro il {offerEndLabel} paga il
              prezzo di lancio. Poi si torna al listino pieno.
            </p>
            <Link href="/pricing" className="btn-primary text-base px-6 py-3 inline-flex">
              Vedi sconto e piani
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-700 py-6">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Study Coach</p>
          <div className="flex gap-4">
            <Link href="/pricing" className="hover:text-coach-600">
              Prezzi
            </Link>
            <Link href="/login" className="hover:text-coach-600">
              Accedi
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode
  title: string
  text: string
}) {
  return (
    <div className="card h-full">
      <div className="w-10 h-10 rounded-xl bg-coach-50 dark:bg-coach-900/40 flex items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="font-bold mb-1.5">{title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{text}</p>
    </div>
  )
}