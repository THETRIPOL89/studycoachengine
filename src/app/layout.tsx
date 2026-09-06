import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { Analytics } from '@vercel/analytics/next'

const inter = Inter({ subsets: ['latin'] })

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://study-coach-kohl.vercel.app/'

export const metadata: Metadata = {
  title: {
    default: 'Study Coach - Il tuo tutor personale',
    template: '%s | Study Coach'
  },
  description: 'AI personal study coach per studenti universitari. Genera piani di studio giornalieri, tieni traccia delle competenze e studia con un tutor AI sempre disponibile.',
  keywords: ['studio', 'università', 'esami', 'AI tutor', 'piano di studio', 'produttività'],
  authors: [{ name: 'Study Coach' }],
  creator: 'Study Coach',
  metadataBase: new URL(APP_URL),

  // Open Graph (Facebook, LinkedIn, WhatsApp preview)
  openGraph: {
    type: 'website',
    locale: 'it_IT',
    url: APP_URL,
    siteName: 'Study Coach',
    title: 'Study Coach - Il tuo tutor personale',
    description: 'AI personal study coach per studenti universitari. Piani giornalieri, competenze, tutor AI.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Study Coach'
      }
    ]
  },

  // Twitter card
  twitter: {
    card: 'summary_large_image',
    title: 'Study Coach - Il tuo tutor personale',
    description: 'AI personal study coach per studenti universitari.',
    images: ['/og-image.png']
  },

  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true
    }
  },

  // Favicon: ICO multi-size (16/32/48) + SVG per browser moderni.
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48', type: 'image/x-icon' },
      { url: '/icon.svg', type: 'image/svg+xml' }
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }
    ]
  },

  // PWA-ready (opzionale, harmless)
  applicationName: 'Study Coach',
  appleWebApp: {
    capable: true,
    title: 'Study Coach',
    statusBarStyle: 'default'
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' }
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className={`${inter.className} bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors`} suppressHydrationWarning>
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
