'use client'

import { Trophy, PartyPopper, ArrowRight } from 'lucide-react'

interface ExamDayBannerProps {
  examName: string
  daysRemaining: number
}

export function ExamDayBanner({ examName, daysRemaining }: ExamDayBannerProps) {
  if (daysRemaining === 0) {
    return (
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-4 sm:p-6 text-white mb-6 shadow-lg">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-11 h-11 sm:w-12 sm:h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <PartyPopper className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg sm:text-xl font-bold mb-1 break-words">Oggi è il grande giorno! 🎓</h3>
            <p className="text-amber-100 text-sm leading-relaxed mb-3 break-words">
              Hai completato il percorso. Hai superato tutte le simulazioni necessarie.
              Ora devi solo applicare quello che sai. Respira, fidati della preparazione.
            </p>
            <div className="bg-white/15 rounded-lg px-4 py-3 inline-flex items-center gap-2 text-sm font-semibold break-words">
              <Trophy className="w-4 h-4 flex-shrink-0" />
              <span>In bocca al lupo per {examName}!</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (daysRemaining === 1) {
    return (
      <div className="bg-gradient-to-r from-red-500 to-rose-500 rounded-2xl p-4 sm:p-6 text-white mb-6 shadow-lg">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-11 h-11 sm:w-12 sm:h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Trophy className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-bold mb-1">Domani l'esame! ⏰</h3>
            <p className="text-red-100 text-sm leading-relaxed break-words">
              Ultimo giorno. Niente nuovi argomenti. Ripassa solo cio che gia sai.
              Dormi bene stasera. Sei pronto.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (daysRemaining > 1 && daysRemaining <= 7) {
    return (
      <div className="bg-gradient-to-r from-coach-500 to-coach-600 rounded-2xl p-4 sm:p-5 text-white mb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base break-words">Manca {daysRemaining} {daysRemaining === 1 ? 'giorno' : 'giorni'} all'esame</h3>
              <p className="text-coach-100 text-xs sm:text-sm">Fase finale: simulazioni e ripasso mirato.</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-coach-200 flex-shrink-0" />
        </div>
      </div>
    )
  }

  return null
}
