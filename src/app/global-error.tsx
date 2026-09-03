'use client'

// Questo file gestisce errori nel root layout (es. errore in ThemeProvider
// che impedisce il rendering della <html>). DEVE includere <html> e <body>
// perché sostituisce il root layout quando si attiva.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="it">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: '4rem 1rem', background: '#f8fafc', color: '#0f172a' }}>
        <div style={{ maxWidth: '28rem', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>
            Errore critico
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '2rem' }}>
            L'applicazione ha riscontrato un errore che impedisce il caricamento. Riprova.
          </p>
          {error.digest && (
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1.5rem', fontFamily: 'monospace' }}>
              ID errore: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: '0.5rem 1rem',
              background: '#0ea5e9',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Riprova
          </button>
        </div>
      </body>
    </html>
  )
}
