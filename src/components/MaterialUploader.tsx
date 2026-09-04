'use client'

import { useState, useRef } from 'react'
import { deleteMaterial, getMaterialUrl, getUploadUrl, confirmUpload } from '@/actions/materials'
import { analyzeMaterialWithAI } from '@/actions/groq'
import { Upload, FileText, Trash2, Loader2, Sparkles, X, Download, CheckCircle2, BrainCircuit, AlertCircle, RefreshCw } from 'lucide-react'
import { PaywallModal } from '@/components/PaywallModal'
import type { PaywallReason } from '@/lib/pricing'

interface Material {
  id: string
  nome_file: string
  tipo: string
  storage_path: string
  dimensione_kb: number | null
  created_at: string
}

interface MaterialUploaderProps {
  examId: string
  initialMaterials: Material[]
}

export function MaterialUploader({ examId, initialMaterials }: MaterialUploaderProps) {
  const [materials, setMaterials] = useState<Material[]>(initialMaterials)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [aiResult, setAiResult] = useState<{topics: any[], sommario: string} | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteConfirmPath, setDeleteConfirmPath] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  // ID dell'ultimo materiale la cui analisi AI e fallita: serve per mostrare
  // un banner morbido + bottone "Riprova analisi" invece di un alert.
  const [lastFailedAnalysisId, setLastFailedAnalysisId] = useState<string | null>(null)
  const [paywallReason, setPaywallReason] = useState<PaywallReason | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset dell'input così lo stesso file può essere ricaricato dopo l'upgrade.
    e.target.value = ''

    setUploading(true)
    setError('')

    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      setError('File troppo grande (max 50MB)')
      setUploading(false)
      return
    }

    const isPdf = file.type === 'application/pdf'
    const isPptx = file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

    if (!isPdf && !isPptx) {
      setError('Formato non supportato. Usa PDF o PPTX.')
      setUploading(false)
      return
    }

    const tipo = isPdf ? 'pdf' : 'slide'

    const urlResult = await getUploadUrl(examId, file.name, file.type)
    if (urlResult.error || !urlResult.signedUrl) {
      setUploading(false)
      // Se il server ha bloccato per paywall, apri la modale invece di un
      // errore generico. Il file non è mai entrato in storage (no signed URL).
      if ('code' in urlResult && urlResult.code === 'quota_exceeded' && 'reason' in urlResult) {
        setPaywallReason(urlResult.reason as PaywallReason)
      } else {
        setError(urlResult.error || 'Errore nel generare URL upload')
      }
      return
    }

    const storagePath = urlResult.path

    const uploadRes = await fetch(urlResult.signedUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type }
    })

    if (!uploadRes.ok) {
      setError('Errore durante il caricamento su storage')
      setUploading(false)
      return
    }

    const confirmResult = await confirmUpload(
      urlResult.path,
      examId,
      file.name,
      tipo,
      file.size
    )

    if (confirmResult.error || !confirmResult.materialId) {
      setError(confirmResult.error || 'Errore nel salvare il materiale')
      setUploading(false)
      return
    }

    // === ANALISI AUTOMATICA POST-UPLOAD ===
    setUploading(false)
    setAnalyzing(confirmResult.materialId)

    const result = await analyzeMaterialWithAI(examId, confirmResult.materialId)

    if (result.error) {
      // Banner morbido: niente piu `File caricato, ma analisi fallita:` (che
      // sembrava un errore irreversibile). L'utente puo riprovare con il
      // bottone in fondo al banner, oppure ignorare (il file e stato
      // caricato, la prossima volta che l'utente clicca "Analizza" manualmente
      // funzionera).
      setLastFailedAnalysisId(confirmResult.materialId)
      setError(result.error)
      setAnalyzing(null)
      // Non ricaricare la pagina: l'utente perderebbe lo stato del banner.
      return
    }

    setAiResult({
      topics: result.topics || [],
      sommario: result.sommario || ''
    })
    // Delete the uploaded file from storage after successful AI analysis
    await deleteMaterial(confirmResult.materialId, storagePath, examId).catch(err => {
      console.warn('Failed to delete uploaded file after analysis:', err)
      // Non-blocking; we keep the file if deletion fails
    })

    setTimeout(() => window.location.reload(), 1500)
  }

  async function handleAnalyze(materialId: string) {
    setAnalyzing(materialId)
    setError('')
    setLastFailedAnalysisId(null)
    setAiResult(null)

    const result = await analyzeMaterialWithAI(examId, materialId)

    if (result.error) {
      setError(result.error)
      setLastFailedAnalysisId(materialId)
    } else if (result.success) {
      setAiResult({
        topics: result.topics || [],
        sommario: result.sommario || ''
      })
      setTimeout(() => window.location.reload(), 2000)
    }

    setAnalyzing(null)
  }

  async function handleDelete(material: Material) {
    setDeleteConfirmId(material.id)
    setDeleteConfirmPath(material.storage_path)
  }

  async function handleDeleteConfirm() {
    if (!deleteConfirmId) return
    setDeleting(true)
    const materialToDelete = materials.find(m => m.id === deleteConfirmId)
    const storagePath = deleteConfirmPath ?? ''
    const result = await deleteMaterial(deleteConfirmId, storagePath, examId)
    setDeleting(false)
    if (result.error) {
      setError(result.error)
    } else {
      setMaterials(materials.filter(m => m.id !== deleteConfirmId))
    }
    setDeleteConfirmId(null)
    setDeleteConfirmPath(null)
  }

  async function handleDownload(material: Material) {
    const url = await getMaterialUrl(material.storage_path)
    if (url) window.open(url, '_blank')
  }

  const formatSize = (kb: number | null) => {
    if (!kb) return ''
    if (kb < 1024) return `${kb} KB`
    return `${(kb / 1024).toFixed(1)} MB`
  }

  const isAnalyzed = (m: Material) => !m.storage_path || m.storage_path === ''

  return (
    <div>
      {error && (
        <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
          lastFailedAnalysisId
            ? 'bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-200'
            : 'bg-red-50 border border-red-200 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
        }`}>
          {lastFailedAnalysisId
            ? <AlertCircle className="w-4 h-4 flex-shrink-0" />
            : <X className="w-4 h-4 flex-shrink-0" />
          }
          <span className="flex-1">{error}</span>
          {lastFailedAnalysisId && (
            <button
              onClick={() => handleAnalyze(lastFailedAnalysisId)}
              disabled={analyzing === lastFailedAnalysisId}
              className="text-xs font-semibold underline hover:no-underline disabled:opacity-50 flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${analyzing === lastFailedAnalysisId ? 'animate-spin' : ''}`} />
              Riprova analisi
            </button>
          )}
        </div>
      )}

      {aiResult && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span className="font-semibold text-amber-800 text-sm">AI ha analizzato il materiale</span>
          </div>
          <p className="text-sm text-amber-700 mb-3">{aiResult.sommario}</p>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Argomenti estratti:</p>
            {aiResult.topics.map((t: any, i: number) => (
              <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                <span className="text-sm text-slate-700">{t.nome}</span>
                <div className="flex gap-1">
                  {Array.from({ length: t.peso }).map((_, j) => (
                    <div key={j} className="w-2 h-2 rounded-full bg-amber-500" />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-600 mt-3">Gli argomenti sono stati aggiornati automaticamente.</p>
        </div>
      )}

      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-300 hover:border-coach-400 rounded-xl p-8 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-coach-50"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.pptx"
          onChange={handleFileChange}
          className="hidden"
        />
        {uploading || analyzing ? (
          <Loader2 className="w-8 h-8 text-coach-500 animate-spin" />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-slate-400" />
            <span className="text-sm font-medium text-slate-600">Carica PDF o Slide</span>
            <span className="text-xs text-slate-400">Max 50MB • Analisi automatica</span>
          </div>
        )}
      </div>

      {materials.length > 0 && (
        <div className="mt-4 space-y-2">
          {materials.map((material) => {
            const analyzed = isAnalyzed(material)

            return (
              <div key={material.id} className={`flex items-center gap-3 p-3 border rounded-lg group ${
                analyzed
                  ? 'bg-green-50/50 border-green-200'
                  : 'bg-white border-slate-200'
              }`}>
                <FileText className={`w-5 h-5 flex-shrink-0 ${analyzed ? 'text-green-500' : 'text-slate-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium truncate ${analyzed ? 'text-green-800' : 'text-slate-700'}`}>
                      {material.nome_file}
                    </p>
                    {analyzed && (
                      <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        Analizzato
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {analyzed ? 'Analizzato' : `${formatSize(material.dimensione_kb)} • ${material.tipo.toUpperCase()}`}
                  </p>
                </div>

                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  {!analyzed && (
                    <>
                      <button
                        onClick={() => handleAnalyze(material.id)}
                        disabled={analyzing === material.id}
                        className="p-2 hover:bg-amber-50 rounded-lg text-amber-600 transition-colors"
                        title="Analizza con AI e genera argomenti"
                        aria-label="Analizza con AI"
                      >
                        {analyzing === material.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDownload(material)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"
                        title="Scarica"
                        aria-label="Scarica"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(material)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500 transition-colors"
                    title="Elimina"
                    aria-label="Elimina"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 gap-2">
              <h3 className="font-bold text-slate-900 dark:text-white">Conferma eliminazione</h3>
              <button onClick={() => {
                setDeleteConfirmId(null)
                setDeleteConfirmPath(null)
              }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 flex-shrink-0" aria-label="Chiudi">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-600 dark:text-slate-300 mb-6 break-words">
              Sei sicuro di voler eliminare "<span className="font-medium">{materials.find(m => m.id === deleteConfirmId)?.nome_file ?? ''}</span>"?
            </p>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
              <button onClick={() => {
                setDeleteConfirmId(null)
                setDeleteConfirmPath(null)
              }} className="px-4 py-2 text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                Annulla
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="btn-primary"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  'Elimina'
                )}
              </button>
            </div>
          </div>
        </div>
    )}

      {/* Paywall Modal (Premium upgrade) */}
      {paywallReason && (
        <PaywallModal
          reason={paywallReason}
          onClose={() => setPaywallReason(null)}
        />
      )}
</div>
)
}