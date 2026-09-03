'use client'

import { useState, useEffect } from 'react'
import { getMonthlySessions } from '@/actions/sessions'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

interface StudyCalendarProps {
  examId: string
}

interface DayData {
  date: string
  sessions: number
  totalMinutes: number
}

const MONTH_NAMES = [
  'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'
]

const WEEKDAYS = ['L','M','M','G','V','S','D']

export function StudyCalendar({ examId }: StudyCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [dayData, setDayData] = useState<Map<string, DayData>>(new Map())
  const [loading, setLoading] = useState(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  useEffect(() => {
    async function load() {
      setLoading(true)
      const result = await getMonthlySessions(examId, year, month)
      const map = new Map<string, DayData>()

      // Cast perché il tipo di result.sessions puo collassare a `never[]`
      // (vedi workaround in src/actions/sessions.ts:createSession/completeSession).
      const sessions = (result.sessions ?? []) as Array<{ data: string; durata_minuti: number }>
      for (const s of sessions) {
        const key = s.data
        const existing = map.get(key)
        if (existing) {
          existing.sessions += 1
          existing.totalMinutes += s.durata_minuti || 0
        } else {
          map.set(key, {
            date: key,
            sessions: 1,
            totalMinutes: s.durata_minuti || 0
          })
        }
      }

      setDayData(map)
      setLoading(false)
    }
    load()
  }, [examId, year, month])

  const firstDayOfMonth = new Date(year, month - 1, 1)
  const lastDayOfMonth = new Date(year, month, 0)
  const daysInMonth = lastDayOfMonth.getDate()
  const startWeekday = (firstDayOfMonth.getDay() + 6) % 7 // Lunedio=0

  const prevMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))

  const getDayColor = (data: DayData | undefined) => {
    if (!data) return 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
    if (data.totalMinutes >= 120) return 'bg-green-500 text-white shadow-sm'
    if (data.totalMinutes >= 60) return 'bg-green-400 text-white'
    if (data.totalMinutes >= 30) return 'bg-amber-400 text-white'
    return 'bg-amber-200 text-amber-800'
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-coach-500" />
          <h3 className="font-bold text-slate-900 dark:text-white">Calendario studio</h3>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 min-w-[120px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button onClick={nextMonth} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading && (
        <div className="h-48 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-coach-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && (
        <>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map((d, index) => (
              <div key={index} className="text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startWeekday }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const data = dayData.get(dateStr)
              const isToday = dateStr === today

              return (
                <div
                  key={day}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium transition-all cursor-default ${
                    getDayColor(data)
                  } ${isToday ? 'ring-2 ring-coach-500 ring-offset-2 dark:ring-offset-slate-900' : ''}`}
                  title={data ? `${data.sessions} sessioni, ${data.totalMinutes} min` : 'Nessuna sessione'}
                >
                  <span>{day}</span>
                  {data && (
                    <span className="text-[9px] opacity-80 font-semibold">{data.totalMinutes}m</span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-green-500" />
              <span>≥2h</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-green-400" />
              <span>1-2h</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-400" />
              <span>30-60m</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-200" />
              <span>&lt;30m</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
