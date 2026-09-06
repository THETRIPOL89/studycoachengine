'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap, Loader2 } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    router.push('/login')
  }, [router])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 bg-coach-100 rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
          <GraduationCap className="w-6 h-6 text-coach-600" />
        </div>
        <Loader2 className="w-8 h-8 text-coach-500 animate-spin" />
      </div>
    </div>
  )
}
