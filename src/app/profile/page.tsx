'use client'

import { useEffect, useState } from 'react'
import { redirect, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getUser, signOut } from '@/actions/auth'
import { getUserPlan, updateUserProfile, createCustomerPortalSession } from '@/actions/subscription'
import { DarkModeToggle } from '@/components/DarkModeToggle'
import {
  ArrowLeft,
  User,
  GraduationCap,
  Building2,
  Mail,
  Crown,
  LogOut,
  Loader2,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isPremium, setIsPremium] = useState(false)
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [universita, setUniversita] = useState('')
  const [corso, setCorso] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    async function load() {
      const [u, plan] = await Promise.all([getUser(), getUserPlan()])
      if (!u) {
        redirect('/login')
        return
      }
      setUser(u)
      setIsPremium(plan.isPremium)
      setPremiumUntil(plan.premiumUntil)
      setNome(u.user_metadata?.nome ?? '')
      setUniversita(u.user_metadata?.universita ?? '')
      setCorso(u.user_metadata?.corso ?? '')
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    const res = await updateUserProfile(nome.trim(), corso.trim(), universita.trim())
    setSaving(false)
    if (res.error) {
      setMessage({ type: 'error', text: res.error })
    } else {
      setMessage({ type: 'success', text: 'Profilo aggiornato' })
      setTimeout(() => setMessage(null), 2500)
    }
  }

  async function handleManageSubscription() {
    setPortalLoading(true)
    const res = await createCustomerPortalSession()
    setPortalLoading(false)
    if (res.error) {
      setMessage({ type: 'error', text: res.error })
      return
    }
    if (res.url) window.location.assign(res.url)
  }

  function handleResetTutorial() {
    try {
      localStorage.removeItem('study-coach-tutorial-completed')
      sessionStorage.removeItem('study-coach-tutorial-step')
      sessionStorage.removeItem('study-coach-tutorial-active')
    } catch {
      // ignore
    }
    router.push('/dashboard')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-coach-500 animate-spin" />
      </div>
    )
  }

  if (!user) {
    redirect('/login')
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/dashboard"
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-colors flex-shrink-0"
              aria-label="Torna alla dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">Profilo</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Gestisci il tuo account</p>
            </div>
          </div>
          <DarkModeToggle />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6">
        {/* Account card */}
        <div className="card">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-xl bg-coach-100 dark:bg-coach-900/40 flex items-center justify-center flex-shrink-0">
              <User className="w-6 h-6 text-coach-600 dark:text-coach-400" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 dark:text-white truncate">
                {nome || 'Utente'}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                {user.email}
              </p>
            </div>
          </div>

          {/* Piano */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 min-w-0">
              <Crown className={`w-4 h-4 flex-shrink-0 ${isPremium ? 'text-amber-500' : 'text-slate-400'}`} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {isPremium ? 'Premium' : 'Piano Free'}
                </p>
                {isPremium && premiumUntil && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Valido fino al {new Date(premiumUntil).toLocaleDateString('it-IT')}
                  </p>
                )}
                {!isPremium && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    1 esame attivo · materiali limitati
                  </p>
                )}
              </div>
            </div>
            {isPremium ? (
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="btn-secondary text-sm py-2 px-3"
              >
                {portalLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Gestisci abbonamento
                    <ExternalLink className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            ) : (
              <Link href="/pricing" className="btn-primary text-sm py-2 px-3">
                <Crown className="w-4 h-4" />
                Passa a Premium
              </Link>
            )}
          </div>
        </div>

        {/* Edit form */}
        <div className="card">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4">Dati personali</h2>

          {message && (
            <div
              className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
                message.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-200'
                  : 'bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : null}
              <span>{message.text}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="label dark:text-slate-300 flex items-center gap-2">
                <User className="w-4 h-4 text-coach-500" />
                Nome
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                placeholder="Il tuo nome"
                maxLength={80}
              />
            </div>

            <div>
              <label className="label dark:text-slate-300 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-coach-500" />
                Università
              </label>
              <input
                type="text"
                value={universita}
                onChange={(e) => setUniversita(e.target.value)}
                className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                placeholder="Es. Università di Roma"
                maxLength={120}
              />
            </div>

            <div>
              <label className="label dark:text-slate-300 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-coach-500" />
                Corso di laurea
              </label>
              <input
                type="text"
                value={corso}
                onChange={(e) => setCorso(e.target.value)}
                className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                placeholder="Es. Ingegneria Informatica"
                maxLength={120}
              />
            </div>

            <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Salva modifiche
            </button>
          </form>
        </div>

        {/* Tutorial */}
        <div className="card">
          <h2 className="font-bold text-slate-900 dark:text-white mb-1">Tutorial</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Vuoi rivedere la guida interattiva su come creare un esame?
          </p>
          <button onClick={handleResetTutorial} className="btn-secondary text-sm">
            <RefreshCw className="w-4 h-4" />
            Rivedi tutorial
          </button>
        </div>

        {/* Logout */}
        <div className="card">
          <form action={signOut}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 py-2.5 px-4 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Esci dall&apos;account
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}