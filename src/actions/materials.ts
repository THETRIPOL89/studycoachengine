'use server'

import { createServerSupabase } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { checkPaywallMaterial } from '@/actions/subscription'

export async function uploadMaterial(examId: string, file: File) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Non autenticato' }

  // Paywall: blocca i free user oltre il primo materiale.
  const paywall = await checkPaywallMaterial(examId)
  if (!paywall.allowed) {
    if ('code' in paywall) {
      return { error: 'Hai già un materiale per questo esame. Passa a Premium per caricarne altri.', code: paywall.code, reason: paywall.reason }
    }
    return { error: paywall.error }
  }

  const maxSize = 50 * 1024 * 1024
  if (file.size > maxSize) return { error: 'File troppo grande (max 50MB)' }

  const isPdf = file.type === 'application/pdf'
  const isPptx = file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

  if (!isPdf && !isPptx) {
    return { error: 'Formato non supportato. Usa PDF o PPTX.' }
  }

  const tipo = isPdf ? 'pdf' : 'slide'
  const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
  const storagePath = `${user.id}/${examId}/${fileName}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await supabase.storage
    .from('materials')
    .upload(storagePath, buffer, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type
    })

  if (uploadError) return { error: uploadError.message }

  // Workaround: l'inferenza supabase-js v2 su `from('materials').insert(...)`
  // collassa il parametro a `never[]` per via del vincolo GenericTable
  // sul Database type (vedi src/types/database.ts). Validato runtime da RLS
  // e check constraints del DB.
  const { data, error: dbError } = await supabase
    .from('materials')
    .insert({
      exam_id: examId,
      nome_file: file.name,
      tipo: tipo as any,
      storage_path: storagePath,
      dimensione_kb: Math.round(file.size / 1024)
    } as never)
    .select()
    .single()

  if (dbError) return { error: dbError.message }

  // Cast perché il tipo di `data` collassa a `never` (vedi workaround sul
  // `.insert()` sopra). Validato runtime da RLS.
  const inserted = data as { id: string } | null

  revalidatePath(`/exam/${examId}`)
  return { success: true, materialId: inserted?.id }
}

export async function getMaterials(examId: string) {
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from('materials')
    .select('id, nome_file, tipo, storage_path, dimensione_kb')
    .eq('exam_id', examId)
    .order('created_at', { ascending: false })

  if (error) return { materials: [] }
  return { materials: data || [] }
}

export async function deleteMaterial(materialId: string, storagePath: string, examId: string) {
  const supabase = await createServerSupabase()

  if (storagePath && storagePath.trim() !== '') {
    await supabase.storage.from('materials').remove([storagePath])
  }

  // Instead of deleting the record, clear the storage_path to indicate file processed
  // Workaround: stessa inferenza collassata di sopra (vedi commento in uploadMaterial).
  const { error } = await supabase
    .from('materials')
    .update({ storage_path: '' } as never)
    .eq('id', materialId)

  if (error) return { error: error.message }

  revalidatePath(`/exam/${examId}`)
  return { success: true }
}

export async function getMaterialUrl(storagePath: string) {
  if (!storagePath || storagePath.trim() === '') {
    return null
  }

  const supabase = await createServerSupabase()
  const { data } = await supabase.storage.from('materials').createSignedUrl(storagePath, 3600)
  return data?.signedUrl || null
}

export async function getUploadUrl(examId: string, fileName: string, fileType: string) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  // Paywall: i free user possono caricare 1 solo materiale per esame.
  // Se ne hanno già uno, blocchiamo l'emissione del signed URL (così il
  // file non entra mai in storage).
  const paywall = await checkPaywallMaterial(examId)
  if (!paywall.allowed) {
    if ('code' in paywall) {
      return { error: 'Hai già un materiale per questo esame. Passa a Premium per caricarne altri.', code: paywall.code, reason: paywall.reason }
    }
    return { error: paywall.error }
  }

  const fileExt = fileType === 'application/pdf' ? 'pdf' : 'pptx'
  const cleanName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.]/g, '_')}`
  const storagePath = `${user.id}/${examId}/${cleanName}`

  const { data, error } = await supabase.storage
    .from('materials')
    .createSignedUploadUrl(storagePath)

  if (error) return { error: error.message }
  return { signedUrl: data.signedUrl, path: storagePath, cleanName }
}

export async function confirmUpload(
  storagePath: string,
  examId: string,
  nomeFile: string,
  tipo: string,
  size: number
) {
  const supabase = await createServerSupabase()

  // Safety net: anche se qualcuno riuscisse a chiamare confirmUpload
  // senza passare per getUploadUrl, ricontrolliamo la quota qui. (Il
  // check vero è in getUploadUrl, questo impedisce un eventuale bypass.)
  const paywall = await checkPaywallMaterial(examId)
  if (!paywall.allowed) {
    if ('code' in paywall) {
      return { error: 'Hai già un materiale per questo esame. Passa a Premium per caricarne altri.', code: paywall.code, reason: paywall.reason }
    }
    return { error: paywall.error }
  }

  // Workaround: stessa inferenza collassata di sopra (vedi commento in uploadMaterial).
  const { data, error } = await supabase.from('materials').insert({
    exam_id: examId,
    nome_file: nomeFile,
    tipo: tipo as any,
    storage_path: storagePath,
    dimensione_kb: Math.round(size / 1024)
  } as never).select().single()

  if (error) return { error: error.message }
  // Cast perché il tipo di `data` collassa a `never` (vedi workaround sul
  // `.insert()` sopra). Validato runtime da RLS.
  const inserted = data as { id: string } | null
  revalidatePath(`/exam/${examId}`)
  return { success: true, materialId: inserted?.id }
}
