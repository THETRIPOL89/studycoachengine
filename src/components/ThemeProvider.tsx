'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system')
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const saved = localStorage.getItem('study-coach-theme') as Theme | null
    if (saved) {
      setThemeState(saved)
      applyTheme(saved)
    } else {
      applyTheme('system')
    }
  }, [])

  function applyTheme(t: Theme) {
    const root = document.documentElement
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = t === 'dark' || (t === 'system' && systemDark)

    if (isDark) {
      root.classList.add('dark')
      setResolvedTheme('dark')
    } else {
      root.classList.remove('dark')
      setResolvedTheme('light')
    }
  }

  function setTheme(t: Theme) {
    setThemeState(t)
    localStorage.setItem('study-coach-theme', t)
    applyTheme(t)
  }

  // Ascolta cambiamenti di preferenza di sistema
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}