'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signUp, signIn } from '@/actions/auth'
import { BookOpen, GraduationCap, LogIn, UserPlus, AlertTriangle, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault()
  setError('')
  setLoading(true)

  const formData = new FormData(e.currentTarget)
  const email = String(formData.get('email') || '').trim()

  if (isLogin) {
    const result = await signIn(formData)

    if (result?.error) {
      let msg = result.error
      if (msg.includes('Invalid login credentials')) {
        msg = 'Email o password non corretti.'
      } else if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) {
        msg = 'Troppe richieste. Aspetta qualche minuto prima di riprovare.'
      }
      setError(msg)
      setLoading(false)
      return
    }

    if (result?.success) {
      window.location.href = '/dashboard'
      return
    }

    setLoading(false)
    return
  }

  // Registrazione
  const result = await signUp(formData)

  if (result?.error) {
    let msg = result.error
    if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) {
      msg = 'Troppe richieste. Aspetta qualche minuto prima di riprovare.'
    } else if (msg.includes('User already registered')) {
      msg = 'Questa email e gia registrata. Prova ad accedere.'
    } else if (msg.includes('Password should be at least')) {
      msg = 'La password deve essere di almeno 6 caratteri.'
    }
    setError(msg)
    setLoading(false)
    return
  }

  if (result?.needsEmailConfirmation) {
    router.push(`/confirm-email?email=${encodeURIComponent(email)}`)
    return
  }

  if (result?.success) {
    window.location.href = '/dashboard'
    return
  }

  setLoading(false)
}

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-coach-900 flex-col justify-center px-16 text-white">
        <div className="mb-8">
          <GraduationCap className="w-16 h-16 text-coach-400 mb-6" />
          <h1 className="text-4xl font-bold mb-4">Study Coach</h1>
          <p className="text-xl text-coach-200 leading-relaxed">
            Il tuo tutor personale universitario.<br/>
            Non devi piu decidere cosa studiare.<br/>
            Il Coach decide per te.
          </p>
        </div>
        <div className="space-y-4 mt-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-coach-800 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-coach-400" />
            </div>
            <div>
              <p className="font-semibold">Piano di studio personalizzato</p>
              <p className="text-sm text-coach-300">Basato sui tuoi obiettivi e tempo disponibile</p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900">
              {isLogin ? 'Bentornato!' : 'Inizia il tuo percorso'}
            </h2>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="label">Nome completo</label>
                <input name="nome" type="text" required className="input" placeholder="Mario Rossi" />
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <input name="email" type="email" required className="input" placeholder="nome@uni.it" />
            </div>
            <div>
              <label className="label">Password</label>
              <input name="password" type="password" required minLength={6} className="input" placeholder="******" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-6">
              {loading ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : isLogin ? (
                <>
                  <LogIn className="w-4 h-4" />
                  Accedi
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Registrati
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsLogin(!isLogin); setError('') }}
              className="text-coach-600 hover:text-coach-700 text-sm font-medium"
            >
              {isLogin ? 'Non hai un account? Registrati' : 'Hai gia un account? Accedi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
