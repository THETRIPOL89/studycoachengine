'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updatePassword } from '@/actions/auth'
import { GraduationCap, Loader2, Lock } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const result = await updatePassword(formData)
    setLoading(false)
    if (result.error) {
      setError(result.error)
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
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nuova password</label>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              className="input"
              placeholder="Almeno 6 caratteri"
            />
          </div>
          <div>
            <label className="label">Conferma password</label>
            <input
              name="confirm"
              type="password"
              required
              minLength={6}
              className="input"
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

        <p className="mt-4 text-center text-sm text-slate-500">
          <Link href="/login" className="hover:text-coach-600">
            Torna al login
          </Link>
        </p>
      </div>
    </div>
  )
}
