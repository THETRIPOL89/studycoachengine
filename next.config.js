/** @type {import('next').NextConfig} */
const nextConfig = {
  // Niente immagini remote: il progetto non usa <Image> con URL esterni.
  // Se in futuro servono (es. avatar utente da Supabase), aggiungi qui
  // il dominio Supabase Storage in `images.remotePatterns` (formato nuovo,
  // `domains` è deprecato da Next 15+).
  images: {
    remotePatterns: []
  },

  // Header di sicurezza base (CSP è lasciata a Vercel o gestita in middleware
  // per granularità). Strict-Transport-Security è impostato da Vercel di default.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
        ]
      }
    ]
  }
}

module.exports = nextConfig
