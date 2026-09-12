'use client'

import { useState } from 'react'
import Link from 'next/link'
import { GraduationCap, ArrowLeft, Loader2, Mail } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const email = String(formData.get('email') || '').trim()

    const supabase = createBrowserClient()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setDone(true)

  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-coach-600 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-slate-900 dark:text-white">Study Coach</span>
        </div>

        <div className="card">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
            Password dimenticata
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Ti inviamo un link per sceglierne una nuova.
          </p>

          {done ? (
            <div className="text-sm text-slate-600 dark:text-slate-300 space-y-4">
              <p>
                Controlla la casella email (e lo spam). Il link è valido per un tempo limitato.
              </p>
              <Link href="/login" className="btn-primary w-full">
                Torna al login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-300 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="label dark:text-slate-300">Email</label>
                <input
                  name="email"
                  type="email"
                  required
                  className="input"
                  placeholder="nome@uni.it"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Invia link
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-coach-600"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Torna al login
          </Link>
        </p>
      </div>
    </div>
  )
}
