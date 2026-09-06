import katex from 'katex'
import 'katex/dist/katex.min.css'
import { Fragment } from 'react'

// Renders text with inline ($...$) and block ($$...$$) KaTeX math.
// Bold (**text**) and italic (*text*) are also handled.
// Other content is rendered as plain text (preserves newlines).
export function MarkdownText({ text }: { text: string }) {
  // Split text on $$...$$ (block math) first, then $...$ (inline math).
  const blocks = splitOnBlockMath(text)

  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === 'block-math') {
          return (
            <div
              key={i}
              className="my-3 overflow-x-auto"
              dangerouslySetInnerHTML={{
                __html: safeRender(block.value, true)
              }}
            />
          )
        }
        return (
          <Fragment key={i}>
            {renderInlineBlock(block.value)}
          </Fragment>
        )
      })}
    </>
  )
}

function renderInlineBlock(text: string) {
  // Split on inline math $...$ (but ignore $$ which would be a block delimiter).
  const parts: Array<{ type: 'text' | 'math'; value: string }> = []
  let i = 0
  while (i < text.length) {
    if (text[i] === '$' && text[i + 1] !== '$') {
      // Find closing $
      let j = i + 1
      while (j < text.length && text[j] !== '$') j++
      if (j < text.length) {
        parts.push({ type: 'math', value: text.slice(i + 1, j) })
        i = j + 1
        continue
      }
    }
    // Find next $ or end
    let j = i
    while (j < text.length && text[j] !== '$') j++
    parts.push({ type: 'text', value: text.slice(i, j) })
    i = j
  }

  return parts.map((part, idx) => {
    if (part.type === 'math') {
      return (
        <span
          key={idx}
          dangerouslySetInnerHTML={{ __html: safeRender(part.value, false) }}
        />
      )
    }
    return <span key={idx}>{renderBoldItalic(part.value)}</span>
  })
}

function renderBoldItalic(text: string) {
  // Convert **bold** and *italic* to spans.
  // Simple state machine: track whether we're inside ** or *.
  const out: Array<{ kind: 'text' | 'bold' | 'italic'; value: string }> = []
  let i = 0
  let buf = ''
  while (i < text.length) {
    if (text[i] === '*' && text[i + 1] === '*') {
      if (buf) out.push({ kind: 'text', value: buf })
      buf = ''
      // Find closing **
      const end = text.indexOf('**', i + 2)
      if (end === -1) {
        out.push({ kind: 'text', value: text.slice(i) })
        buf = ''
        i = text.length
        continue
      }
      out.push({ kind: 'bold', value: text.slice(i + 2, end) })
      i = end + 2
      continue
    }
    if (text[i] === '*') {
      if (buf) out.push({ kind: 'text', value: buf })
      buf = ''
      const end = text.indexOf('*', i + 1)
      if (end === -1) {
        out.push({ kind: 'text', value: text.slice(i) })
        buf = ''
        i = text.length
        continue
      }
      out.push({ kind: 'italic', value: text.slice(i + 1, end) })
      i = end + 1
      continue
    }
    buf += text[i]
    i++
  }
  if (buf) out.push({ kind: 'text', value: buf })

  return out.map((seg, idx) => {
    if (seg.kind === 'bold') {
      return <strong key={idx} className="font-semibold text-white">{seg.value}</strong>
    }
    if (seg.kind === 'italic') {
      return <em key={idx} className="italic text-slate-300">{seg.value}</em>
    }
    return <span key={idx}>{seg.value}</span>
  })
}

type Block =
  | { type: 'text'; value: string }
  | { type: 'block-math'; value: string }

function splitOnBlockMath(text: string): Block[] {
  const blocks: Block[] = []
  let i = 0
  while (i < text.length) {
    if (text[i] === '$' && text[i + 1] === '$') {
      const end = text.indexOf('$$', i + 2)
      if (end !== -1) {
        blocks.push({ type: 'block-math', value: text.slice(i + 2, end) })
        i = end + 2
        continue
      }
    }
    // Find next $$ or end
    let j = i
    while (j < text.length - 1 && !(text[j] === '$' && text[j + 1] === '$')) j++
    if (j >= text.length - 1) j = text.length
    blocks.push({ type: 'text', value: text.slice(i, j) })
    i = j
  }
  return blocks
}

function safeRender(math: string, displayMode: boolean): string {
  try {
    return katex.renderToString(math, {
      displayMode,
      throwOnError: false,
      output: 'html',
      strict: 'ignore',
      trust: false
    })
  } catch {
    // Fallback: show raw math text
    return `<code>${escapeHtml(math)}</code>`
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

