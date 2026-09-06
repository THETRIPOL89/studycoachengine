interface CompetenceBarProps {
  label: string
  value: number
  color?: string
}

export function CompetenceBar({ label, value, color = 'bg-coach-500' }: CompetenceBarProps) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-600 dark:text-slate-400">{label}</span>
        <span className="font-medium text-slate-900 dark:text-white">{value}%</span>
      </div>
      <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}
