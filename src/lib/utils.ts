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
