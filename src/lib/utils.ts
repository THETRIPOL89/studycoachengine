import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

export function daysUntil(date: string | Date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const diff = target.getTime() - today.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/** Media ponderata sui CFU (scala 0–30). Null se non ci sono voti validi. */
export function mediaPonderata(
  exams: Array<{ voto_finale: number | null; cfu: number | null }>
): number | null {
  let num = 0
  let den = 0
  for (const e of exams) {
    if (e.voto_finale == null || e.cfu == null || e.cfu <= 0) continue
    num += e.voto_finale * e.cfu
    den += e.cfu
  }
  if (den === 0) return null
  return Math.round((num / den) * 100) / 100
}

export function getPreparationColor(percent: number) {
  if (percent >= 80) return 'text-success'
  if (percent >= 50) return 'text-warning'
  return 'text-danger'
}

export function getPreparationBg(percent: number) {
  if (percent >= 80) return 'bg-success'
  if (percent >= 50) return 'bg-warning'
  return 'bg-danger'
}
