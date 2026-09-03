// Helper: estrae il primo blocco JSON { ... } bilanciato da una stringa
export function extractFirstJson(text: string): string | null {
  if (!text) return null
  // Rimuovi markdown code fences
  let t = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
  // Cerca il primo { che inizia un oggetto JSON top-level bilanciato
  let depth = 0
  let start = -1
  let inString = false
  let escape = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (escape) { escape = false; continue }
    if (ch === '\\') { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') {
      if (start === -1) start = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        return t.slice(start, i + 1)
      }
    }
  }
  // Non abbiamo trovato un JSON bilanciato - ritorna quello che abbiamo (verrà riparato)
  if (start !== -1) return t.slice(start)
  return null
}

// Helper: ripara un JSON troncato chiudendo stringhe/array/oggetti aperti
export function repairTruncatedJson(text: string): string {
  let result = text
  let inString = false
  let escape = false
  const openStack: string[] = []

  for (let i = 0; i < result.length; i++) {
    const ch = result[i]
    if (escape) { escape = false; continue }
    if (ch === '\\') { escape = true; continue }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === '{') openStack.push('}')
    else if (ch === '[') openStack.push(']')
    else if (ch === '}' || ch === ']') openStack.pop()
  }

  // Se siamo dentro una stringa aperta, chiudila
  if (inString) result += '"'

  // Chiudi tutti i bracket/brace aperti (in ordine inverso)
  for (let i = openStack.length - 1; i >= 0; i--) {
    result += openStack[i]
  }

  return result
}

