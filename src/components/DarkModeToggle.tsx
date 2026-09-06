'use client'

import { useTheme } from './ThemeProvider'
import { Sun, Moon, Monitor } from 'lucide-react'

export function DarkModeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme()

  return (
    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
      <button
        onClick={() => setTheme('light')}
        className={`p-1.5 rounded-md transition-all ${
          theme === 'light' 
            ? 'bg-white dark:bg-slate-700 text-amber-500 shadow-sm' 
            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
        }`}
        title="Light"
      >
        <Sun className="w-4 h-4" />
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`p-1.5 rounded-md transition-all ${
          theme === 'system' 
            ? 'bg-white dark:bg-slate-700 text-coach-500 shadow-sm' 
            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
        }`}
        title="Sistema"
      >
        <Monitor className="w-4 h-4" />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`p-1.5 rounded-md transition-all ${
          theme === 'dark' 
            ? 'bg-white dark:bg-slate-700 text-indigo-400 shadow-sm' 
            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
        }`}
        title="Dark"
      >
        <Moon className="w-4 h-4" />
      </button>
    </div>
  )
}
