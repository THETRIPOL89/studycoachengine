/**
 * Costanti per i 3 piani Premium (single source of truth per la UI).
 *
 * Il webhook Stripe legge i Price ID da env (vedi `getPriceIdForPlan` in
 * `src/lib/stripe.ts`), NON da qui. Questo file serve solo per display.
 *
 * Se cambi un prezzo in Stripe Dashboard, aggiorna anche qui.
 */

export type PlanKey = 'monthly' | 'semestral' | 'annual'

export const LAUNCH_DISCOUNT_PERCENT = 40
export const LAUNCH_OFFER_END = '2026-10-15' // allinea con la landing

export interface PlanInfo {
  key: PlanKey
  /** Prezzo totale del periodo, formattato per display (es. "€24,99"). */
  totalDisplay: string
  /** Periodo in formato leggibile (es. "ogni 6 mesi"). */
  periodDisplay: string
  /** Costo mensile effettivo (es. "€4,17"). "" per il mensile. */
  effectiveMonthly: string
  /** Etichetta risparmio (es. "Risparmi 17%"). "" per il mensile. */
  savingBadge: string
  /** Descrizione benefit (breve, mostrata sulla card). */
  pitch: string
  /** Ordine di visualizzazione (più alto = in fondo, "Consigliato" al centro). */
  sortOrder: number
  /** Se true, mostra il badge "Consigliato" verde. */
  isRecommended?: boolean
}

export const PLANS = [
  {
    key: 'monthly' as const,
    sortOrder: 1,
    isRecommended: false,
    totalDisplay: '4,99€',
    periodDisplay: '/mese',
    effectiveMonthly: null as string | null,
    savingBadge: null as string | null,
    pitch: 'Flessibile. Disdici quando vuoi.',
    // listino in centesimi se ti serve altrove
    listPriceEuro: 4.99,
  },
  {
    key: 'semestral' as const,
    sortOrder: 2,
    isRecommended: false,
    totalDisplay: '24,99€',
    periodDisplay: '/6 mesi',
    effectiveMonthly: '4,17€',
    savingBadge: 'Risparmi rispetto al mensile',
    pitch: 'Una sessione di esami intera, senza pensare al rinnovo ogni mese.',
    listPriceEuro: 24.99,
  },
  {
    key: 'annual' as const,
    sortOrder: 3,
    isRecommended: true,
    totalDisplay: '44,99€',
    periodDisplay: '/anno',
    effectiveMonthly: '3,75€',
    savingBadge: 'Miglior prezzo / mese',
    pitch: 'Un anno di Coach al costo minimo. Ideale se hai più esami davanti.',
    listPriceEuro: 44.99,
  },
]

/** Quota per i free user (singolo esame, singolo materiale, no AI Tutor). */
export const FREE_LIMITS = {
  maxActiveExams: 1,
  maxMaterialsPerExam: 1,
  aiTutorEnabled: false
} as const

export type PaywallReason = 'exam' | 'material' | 'ai_tutor'

export const PAYWALL_REASON_COPY: Record<PaywallReason, { title: string; subtitle: string }> = {
  exam: {
    title: 'Hai già un esame attivo',
    subtitle:
      'Nel piano Free puoi gestire 1 esame alla volta. Passa a Premium per averne illimitati.'
  },
  material: {
    title: 'Hai già un materiale per questo esame',
    subtitle:
      'Nel piano Free puoi caricare 1 materiale per esame. Passa a Premium per caricarne quanti ne vuoi.'
  },
  ai_tutor: {
    title: 'AI Tutor è una funzione Premium',
    subtitle:
      'Chiedi spiegazioni personalizzate con un click. Passa a Premium per sbloccare l\'AI Tutor.'
  }
}

export type PlanKey = 'monthly' | 'semestral' | 'annual'

export function launchPriceEuro(listPriceEuro: number): number {
  return Math.round(listPriceEuro * (1 - LAUNCH_DISCOUNT_PERCENT / 100) * 100) / 100
}

export function formatEuro(n: number): string {
  return n.toFixed(2).replace('.', ',') + '€'
}

export function isLaunchOfferActive(now = new Date()): boolean {
  return now <= new Date(LAUNCH_OFFER_END + 'T23:59:59')
}
