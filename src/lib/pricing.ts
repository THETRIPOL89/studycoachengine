/**
 * Costanti per i 3 piani Premium (single source of truth per la UI).
 *
 * Il webhook Stripe legge i Price ID da env (vedi `getPriceIdForPlan` in
 * `src/lib/stripe.ts`), NON da qui. Questo file serve solo per display.
 *
 * Se cambi un prezzo in Stripe Dashboard, aggiorna anche qui.
 */

export type PlanKey = 'monthly' | 'semestral' | 'annual'

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

export const PLANS: PlanInfo[] = [
  {
    key: 'monthly',
    totalDisplay: '€4,99',
    periodDisplay: 'al mese',
    effectiveMonthly: '',
    savingBadge: '',
    pitch: 'Massima flessibilità, cancella quando vuoi.',
    sortOrder: 1
  },
  {
    key: 'semestral',
    totalDisplay: '€24,99',
    periodDisplay: 'ogni 6 mesi',
    effectiveMonthly: '€4,17',
    savingBadge: 'Risparmi 17%',
    pitch: 'Ideale per un semestre universitario.',
    sortOrder: 2,
    isRecommended: true
  },
  {
    key: 'annual',
    totalDisplay: '€44,99',
    periodDisplay: 'all\'anno',
    effectiveMonthly: '€3,75',
    savingBadge: 'Risparmi 25%',
    pitch: 'Per chi studia tutto l\'anno accademico.',
    sortOrder: 3
  }
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
