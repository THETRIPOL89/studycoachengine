import type { MetadataRoute } from 'next'

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
  'https://study-coach-kohl.vercel.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: [
        '/',
        '/privacy',
        '/terms',
        '/login',
        '/pricing'
      ],
      disallow: [
        '/dashboard',
        '/exam/',
        '/profile',
        '/confirm-email',
        '/api/',
      ],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  }
}
