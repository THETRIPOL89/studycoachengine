'use client'

import { Suspense, useState, useEffect, useMemo } from 'react'
import { redirect, useSearchParams } from 'next/navigation'
import { getUser } from '@/actions/auth'
import { getExams } from '@/actions/exams'
import { signOut } from '@/actions/auth'
import { getUserPlan } from '@/actions/subscription'
import { ExamCard } from '@/components/ExamCard'
import { EmptyState } from '@/components/EmptyState'
import { DailyReminder } from '@/components/DailyReminder'
import { DarkModeToggle } from '@/components/DarkModeToggle'
import { PaywallModal } from '@/components/PaywallModal'
import { Plus, LogOut, GraduationCap, Loader2, ArrowDownAZ, Calendar, BarChart3, Sparkles, ChevronUp, ChevronDown, Crown, X, CheckCircle } from 'lucide-react'
import Link from 'next/link'

// Modi di ordinamento possibili nella dashboard. 'consigliato' e un ibrido
// di urgenza (data vicina) + rischio (preparazione bassa) — vedi
// getConsigliatoScore() per la formula.
type SortMode = 'data' | 'preparazione' | 'consigliato' | 'nome'
type SortDir = 'asc' | 'desc'

// Direzione di default per ogni mode, applicata quando l'utente attiva
// quel filtro per la prima volta. Il sort ha senso solo in una direzione
// "naturale" per il dato:
//   - data asc      = piu vicino prima
//   - preparazione asc = meno pronto prima
//   - consigliato desc = piu urgente prima (score piu alto in alto)
//   - nome asc      = A-Z
const DEFAULT_DIR: Record<SortMode, SortDir> = {
  data: 'asc',
  preparazione: 'asc',
  consigliato: 'desc',
  nome: 'asc'
}

// Punteggio "consigliato" usato dal sort omonimo. Combina urgenza (quanto
// e vicino l'esame) e rischio (quanto sei indietro). Il signal principale
// e il prodotto urgenza * gap: sale tanto quando l'esame e imminente E
// la preparazione e bassa. Aggiungo un boost di rischio puro (max 20
// punti) per evitare che un esame lontano ma sotto-preparato finisca
// in fondo solo perche l'urgenza e zero.
//
// Esempi:
//   giorni=2  prep=20%  -> 74 (signal) + 16 (boost) = 90  [critico]
//   giorni=30 prep=0%   ->  0 (signal) + 20 (boost) = 20  [lontano ma a zero]
//   giorni=10 prep=50%  -> 33 (signal) + 10 (boost) = 43  [medio]
//   giorni=2  prep=100% ->  0 (signal) +  0 (boost) =  0  [gia pronto]
function getConsigliatoScore(e: { giorni_mancanti?: number; preparazione_percentuale?: number }): number {
  const giorni = Math.max(0, e.giorni_mancanti ?? 30)
  const prep = e.preparazione_percentuale ?? 0
  const urgenza = Math.max(0, 1 - giorni / 30) // 1.0 oggi, 0.0 a 30gg o piu
  const gap = (100 - prep) / 100                  // 0.0 pronto, 1.0 a zero
  const signal = urgenza * gap * 100
  const riskBoost = 0.2 * gap * 100               // fino a 20 punti
  return signal + riskBoost
}

// Comparatore per Array.sort(). Ritorna numero negativo se a < b.
// `dir` inverte il segno per il sort discendente.
function compareExams(
  a: any,
  b: any,
  mode: SortMode,
  dir: SortDir
): number {
  let cmp = 0
  switch (mode) {
    case 'data': {
      // data_esame e una stringa ISO (YYYY-MM-DD), confrontabile lessicograficamente
      const da = a.data_esame ?? ''
      const db = b.data_esame ?? ''
      cmp = da.localeCompare(db)
      break
    }
    case 'preparazione': {
      const pa = a.preparazione_percentuale ?? 0
      const pb = b.preparazione_percentuale ?? 0
      cmp = pa - pb
      break
    }
    case 'consigliato': {
      cmp = getConsigliatoScore(a) - getConsigliatoScore(b)
      break
    }
    case 'nome': {
      const na = (a.nome_esame ?? '').toString().toLowerCase()
      const nb = (b.nome_esame ?? '').toString().toLowerCase()
      cmp = na.localeCompare(nb)
      break
    }
  }
  return dir === 'desc' ? -cmp : cmp
}

// Configurazione UI dei 4 bottoni-pill. Definita in un unico posto cosi
// aggiungere/togliere un filtro e' una modifica isolata.
const SORT_OPTIONS: Array<{
  key: SortMode
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { key: 'data', label: 'Data esame', icon: Calendar },
  { key: 'preparazione', label: 'Preparazione', icon: BarChart3 },
  { key: 'consigliato', label: 'Consigliato', icon: Sparkles },
  { key: 'nome', label: 'Nome', icon: ArrowDownAZ }
]

export default function DashboardPage() {
  // useSearchParams() in Next 15 richiede che questa pagina (client) sia
  // wrappata in un <Suspense> boundary per evitare il bailout della
  // static prerendering. Il fallback mostra uno spinner neutro.
  return (
    <Suspense fallback={
      <div className="flex h-[200px] items-center justify-center">
        <Loader2 className="w-8 h-8 text-coach-500 animate-spin" />
      </div>
    }>
      <DashboardPageInner />
    </Suspense>
  )
}

function DashboardPageInner() {
  const [user, setUser] = useState<any>(null)
  const [exams, setExams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isPremium, setIsPremium] = useState<boolean | null>(null)
  const [paywallOpen, setPaywallOpen] = useState(false)
  const [toast, setToast] = useState<{ kind: 'success' | 'canceled' | 'info'; message: string } | null>(null)

  const searchParams = useSearchParams()

  const [sortMode, setSortMode] = useState<SortMode>('data')
  // Direzione di sort per ogni mode: ricordiamo la scelta dell'utente
  // quando naviga tra i filtri, cosi non perde l'orientamento che aveva
  // impostato su un altro filtro.
  const [sortDirByMode, setSortDirByMode] = useState<Record<SortMode, SortDir>>({
    data: 'asc',
    preparazione: 'asc',
    consigliato: 'desc',
    nome: 'asc'
  })
  const currentDir = sortDirByMode[sortMode]

  useEffect(() => {
    async function loadData() {
      const [userRes, examsRes, planRes] = await Promise.all([
        getUser(),
        getExams(),
        getUserPlan()
      ])
      setUser(userRes)
      setExams(examsRes.exams ?? [])
      setIsPremium(planRes.isPremium)
      setLoading(false)
    }
    loadData()
  }, [])

  // Toast quando l'utente torna da Stripe Checkout (success/canceled).
  // Dopo 1.5s ri-fetcha il piano per allineare la cache client (il webhook
  // potrebbe non aver ancora aggiornato profiles, gestito con un fallback).
  useEffect(() => {
    const upgrade = searchParams.get('upgrade')
    if (upgrade === 'success') {
      setToast({ kind: 'success', message: 'Pagamento riuscito! Sto attivando il tuo account Premium...' })
      // Tenta di riallineare il piano locale dopo 1.5s (tempo tipico per
      // il webhook Stripe). Se l'utente è ancora free, mostra un fallback.
      const t = setTimeout(() => {
        getUserPlan().then((p) => {
          setIsPremium(p.isPremium)
          if (p.isPremium) {
            setToast({ kind: 'success', message: 'Benvenuto in Premium! 🎉' })
            setTimeout(() => setToast(null), 3000)
          } else {
            setToast({ kind: 'info', message: 'Stiamo ancora elaborando il tuo upgrade. Riprova tra poco.' })
            setTimeout(() => setToast(null), 5000)
          }
        })
      }, 1500)
      // Pulisci la query string per evitare che il toast si mostri di nuovo
      // dopo un refresh.
      window.history.replaceState({}, '', '/dashboard')
      return () => clearTimeout(t)
    }
    if (upgrade === 'canceled') {
      setToast({ kind: 'canceled', message: 'Nessun addebito. Puoi riprovare quando vuoi.' })
      window.history.replaceState({}, '', '/dashboard')
      setTimeout(() => setToast(null), 4000)
    }
  }, [searchParams])

  // Lista ordinata in base al sortMode/dir correnti. useMemo evita di
  // riallocare l'array ad ogni render (importante per il grid di ExamCard).
  const sortedExams = useMemo(() => {
    const copy = [...exams]
    copy.sort((a, b) => compareExams(a, b, sortMode, currentDir))
    return copy
  }, [exams, sortMode, currentDir])

  // Click su un filtro inattivo: switch mode + applica direzione default.
  // Click sul filtro attivo: inverte la direzione asc/desc mantenendo il mode.
  function handleSortClick(mode: SortMode) {
    if (mode === sortMode) {
      setSortDirByMode(prev => ({ ...prev, [mode]: prev[mode] === 'asc' ? 'desc' : 'asc' }))
    } else {
      setSortMode(mode)
      // Non tocchiamo sortDirByMode[mode]: l'utente potrebbe averlo
      // gia invertito in passato su un altro mode e noi vogliamo ricordare
      // la sua preferenza. Il default vive solo in DEFAULT_DIR come
      // documentazione; lo stato iniziale di sortDirByMode gia rispetta
      // quei default.
    }
  }

  if (loading) return (
    <div className="flex h-[200px] items-center justify-center">
      <Loader2 className="w-8 h-8 text-coach-500 animate-spin" />
    </div>
  );
  if (!user) {
    redirect('/login')
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 transition-colors">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-coach-600 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-slate-900 dark:text-white">Study Coach</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Il tuo tutor personale</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <DarkModeToggle />
            {isPremium === false && (
              <button
                onClick={() => setPaywallOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white shadow-sm transition-all hover:shadow"
              >
                <Crown className="w-3.5 h-3.5" />
                Passa a Premium
              </button>
            )}
            {isPremium === true && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                <Crown className="w-3.5 h-3.5" />
                Premium
              </span>
            )}
            <span className="text-sm text-slate-600 dark:text-slate-300 hidden sm:block">
              {user.email}
            </span>
            <form action={signOut}>
              <button type="submit" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Daily Reminders */}
        <DailyReminder exams={exams.map(e => ({
          id: e.id,
          nome_esame: e.nome_esame,
          giorni_mancanti: e.giorni_mancanti,
          preparazione_percentuale: e.preparazione_percentuale,
          ore_giorno: e.ore_giorno
        }))} />

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">I tuoi esami</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              {exams.length > 0
                ? `Hai ${exams.length} esam${exams.length > 1 ? 'i' : 'e'} in corso`
                : 'Inizia aggiungendo il tuo primo esame'
              }
            </p>
          </div>
          <Link href="/exam/new" className="btn-primary">
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Nuovo esame</span>
          </Link>
        </div>

        {/* Filter bar — solo se ci sono piu' di 1 esame (con un solo esame
            il sort non ha senso). Mostra 4 pillole con icona + label;
            quella attiva ha background coach-600 e ChevronUp/Down per
            indicare la direzione del sort corrente. */}
        {exams.length > 1 && (
          <div className="mb-6 flex flex-wrap items-center gap-2" role="toolbar" aria-label="Ordinamento esami">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1">
              Ordina:
            </span>
            {SORT_OPTIONS.map(({ key, label, icon: Icon }) => {
              const isActive = key === sortMode
              const dir = sortDirByMode[key]
              const DirIcon = dir === 'asc' ? ChevronUp : ChevronDown
              return (
                <button
                  key={key}
                  onClick={() => handleSortClick(key)}
                  aria-pressed={isActive}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                    isActive
                      ? 'bg-coach-600 border-coach-600 text-white hover:bg-coach-700'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-coach-300 dark:hover:border-coach-500 hover:text-coach-700 dark:hover:text-coach-300'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                  {isActive && <DirIcon className="w-3 h-3" />}
                </button>
              )
            })}
          </div>
        )}

        {exams.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedExams.map((exam) => (
              <ExamCard key={exam.id} exam={exam} />
            ))}
          </div>
        )}
      </main>

      {/* Toast per upgrade success/canceled */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-2">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${
            toast.kind === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
              : toast.kind === 'canceled'
              ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200'
              : 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200'
          }`}>
            {toast.kind === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <X className="w-5 h-5 flex-shrink-0" />}
            <span className="text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 p-0.5 hover:bg-black/5 dark:hover:bg-white/5 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Paywall modal (apribile dal bottone "Passa a Premium" in header) */}
      {paywallOpen && (
        <PaywallModal
          reason="exam"
          onClose={() => setPaywallOpen(false)}
        />
      )}
    </div>
  )
}
