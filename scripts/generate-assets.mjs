// Genera public/og-image.png (1200x630) e public/favicon.ico (multi-size)
// Esegui con: node scripts/generate-assets.mjs
// Usa sharp (già installato come dep transitiva di Next).

import sharp from 'sharp'
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(__dirname, '..', 'public')

if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true })
}

// ============================================================
// 1. og-image.png (1200 x 630) — social card
// ============================================================
// Design: gradiente blu, monogramma "S" a sinistra, titolo + tagline
// a destra, barra inferiore con "studio-coach.app".

const ogWidth = 1200
const ogHeight = 630

// SVG inline: tutto il rendering è vettoriale, sharp rasterizza a 2x per retina.
const ogSvg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${ogWidth}" height="${ogHeight}" viewBox="0 0 ${ogWidth} ${ogHeight}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0c4a6e"/>
      <stop offset="50%" stop-color="#0ea5e9"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.05"/>
    </linearGradient>
    <linearGradient id="mark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0ea5e9"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="100%" height="100%" fill="url(#bg)"/>

  <!-- Decorative circles (top-right) -->
  <circle cx="1100" cy="80" r="180" fill="#ffffff" fill-opacity="0.06"/>
  <circle cx="1200" cy="250" r="100" fill="#ffffff" fill-opacity="0.08"/>

  <!-- Decorative dots grid (bottom-left) -->
  <g fill="#ffffff" fill-opacity="0.1">
    <circle cx="60"  cy="540" r="3"/>
    <circle cx="100" cy="540" r="3"/>
    <circle cx="140" cy="540" r="3"/>
    <circle cx="60"  cy="580" r="3"/>
    <circle cx="100" cy="580" r="3"/>
    <circle cx="60"  cy="620" r="3"/>
  </g>

  <!-- Logo mark (rounded square + "S") -->
  <g transform="translate(80, 195)">
    <rect width="240" height="240" rx="56" fill="url(#card)" stroke="#ffffff" stroke-opacity="0.25" stroke-width="2"/>
    <text x="120" y="180" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="180" font-weight="800" fill="#ffffff" letter-spacing="-8">S</text>
  </g>

  <!-- Title -->
  <text x="380" y="280" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="84" font-weight="800" fill="#ffffff" letter-spacing="-2">Study Coach</text>

  <!-- Tagline -->
  <text x="380" y="350" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="32" font-weight="500" fill="#bae6fd">Il tuo tutor AI per l'università</text>

  <!-- Sub tagline -->
  <text x="380" y="400" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="24" font-weight="400" fill="#ffffff" fill-opacity="0.75">Piani giornalieri • Timer studio • Tutor AI</text>

  <!-- Bottom badge -->
  <g transform="translate(380, 470)">
    <rect width="280" height="56" rx="28" fill="#ffffff" fill-opacity="0.15" stroke="#ffffff" stroke-opacity="0.3" stroke-width="1"/>
    <text x="140" y="37" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="20" font-weight="600" fill="#ffffff">100% gratis per iniziare</text>
  </g>
</svg>
`)

await sharp(ogSvg)
  .png({ compressionLevel: 9 })
  .toFile(resolve(publicDir, 'og-image.png'))

console.log('✓ public/og-image.png (1200x630) generata')

// ============================================================
// 2. favicon.ico (16, 32, 48) — multi-size ICO
// ============================================================
// Design: monogramma "S" su gradiente blu, stesso identità del logo.

const sizes = [16, 32, 48]

// Genera 3 PNG a risoluzioni diverse
const pngs = await Promise.all(
  sizes.map(async (size) => {
    const svg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0ea5e9"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#g)"/>
  <text x="32" y="46" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="44" font-weight="800" fill="#ffffff" letter-spacing="-2">S</text>
</svg>
`)
    return sharp(svg).png().toBuffer()
  })
)

// Scrivi i PNG intermedi (utile anche per src/app/icon diretto)
for (let i = 0; i < sizes.length; i++) {
  const size = sizes[i]
  writeFileSync(resolve(publicDir, `favicon-${size}.png`), pngs[i])
}
console.log('✓ public/favicon-16.png, favicon-32.png, favicon-48.png generati')

// Costruisci un file .ico multi-size.
// Formato ICO: header (6B) + dir entries (16B ciascuno) + PNG data concatenated.
function buildIco(pngs, sizes) {
  const numImages = pngs.length
  const headerSize = 6
  const dirEntrySize = 16
  const offset = headerSize + dirEntrySize * numImages

  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0)              // reserved
  header.writeUInt16LE(1, 2)              // type: 1 = ICO
  header.writeUInt16LE(numImages, 4)      // number of images

  const dirEntries = Buffer.alloc(dirEntrySize * numImages)
  let dataOffset = offset
  const imageBuffers = []

  for (let i = 0; i < numImages; i++) {
    const size = sizes[i]
    const png = pngs[i]
    const entryOffset = i * dirEntrySize

    // Width / height: 0 means 256 (per spec). I nostri sono <= 48 quindi size esplicito.
    dirEntries.writeUInt8(size === 256 ? 0 : size, entryOffset + 0)     // width
    dirEntries.writeUInt8(size === 256 ? 0 : size, entryOffset + 1)     // height
    dirEntries.writeUInt8(0, entryOffset + 2)                          // color palette
    dirEntries.writeUInt8(0, entryOffset + 3)                          // reserved
    dirEntries.writeUInt16LE(1, entryOffset + 4)                        // color planes
    dirEntries.writeUInt16LE(32, entryOffset + 6)                       // bits per pixel
    dirEntries.writeUInt32LE(png.length, entryOffset + 8)              // image size
    dirEntries.writeUInt32LE(dataOffset, entryOffset + 12)             // image offset

    imageBuffers.push(png)
    dataOffset += png.length
  }

  return Buffer.concat([header, dirEntries, ...imageBuffers])
}

const icoBuffer = buildIco(pngs, sizes)
writeFileSync(resolve(publicDir, 'favicon.ico'), icoBuffer)
console.log(`✓ public/favicon.ico (multi-size 16/32/48) generato, ${icoBuffer.length} bytes`)

console.log('\nTutte le immagini pronte. Fai commit e push.')
