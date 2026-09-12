'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabase } from '@/lib/supabase-browser' // adatta al path del tuo client browser
import { GraduationCap, Loader2, Lock } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  // 1) Stabilisci la session di recovery dal link email
  useEffect(() => {
    const supabase = createBrowserSupabase()

    async function init() {
      try {
        // PKCE: ?code=...
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            setError('Link non valido o scaduto. Richiedine uno nuovo.')
            setReady(false)
            return
          }
          // Pulisci la query
          window.history.replaceState({}, '', '/reset-password')
        }

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setError('Sessione assente. Apri il link dalla email oppure richiedi un nuovo reset.')
          setReady(false)
          return
        }

        setReady(true)
      } catch {
        setError('Impossibile verificare il link. Richiedi un nuovo reset.')
        setReady(false)
      }
    }

    init()

    // Fallback: evento recovery (alcuni setup)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('La password deve avere almeno 6 caratteri')
      return
    }
    if (password !== confirm) {
      setError('Le password non coincidono')
      return
    }

    setLoading(true)
    const supabase = createBrowserSupabase()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(
        updateError.message.includes('session')
          ? 'Sessione scaduta. Richiedi un nuovo link dalla pagina Password dimenticata.'
          : updateError.message
      )
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md card">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 bg-coach-600 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Nuova password
          </h1>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-300 text-sm">
            {error}
            {error.includes('link') && (
              <div className="mt-2">
                <Link href="/forgot-password" className="underline font-medium">
                  Richiedi un nuovo link
                </Link>
              </div>
            )}
          </div>
        )}

        {!ready && !error && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-coach-500 animate-spin" />
          </div>
        )}

        {ready && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nuova password</label>
              <input
                type="password"
                required
                minLength={6}
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Almeno 6 caratteri"
              />
            </div>
            <div>
              <label className="label">Conferma password</label>
              <input
                type="password"
                required
                minLength={6}
                className="input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Ripeti la password"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Salva password
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
