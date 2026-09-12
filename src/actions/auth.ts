'use server'

import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function signUp(formData: FormData): Promise<{
  error?: string
  success?: boolean
  needsEmailConfirmation?: boolean
}> {
  const supabase = await createServerSupabase()

  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')
  const nome = String(formData.get('nome') || '').trim()

  if (!email || !password) {
    return { error: 'Email e password obbligatori' }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nome },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  // Nessuna session → serve conferma email
  if (!data.session) {
    return { success: true, needsEmailConfirmation: true }
  }

  return { success: true, needsEmailConfirmation: false }
}

export async function signIn(formData: FormData) {
  const supabase = await createServerSupabase()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) return { error: error.message }

  revalidatePath('/')
  return { success: true }
}

export async function signOut() {
  const supabase = await createServerSupabase()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function getUser() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('email') || '').trim()
  if (!email) return { error: 'Inserisci la tua email' }

  const supabase = await createServerSupabase()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/reset-password`,
  })

  if (error) return { error: error.message }

  // Stesso messaggio anche se l'email non esiste (non rivelare se è registrata)
  return {
    success: true,
    message: 'Se l’email è registrata, riceverai un link per reimpostare la password.',
  }
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get('password') || '')
  const confirm = String(formData.get('confirm') || '')

  if (password.length < 6) {
    return { error: 'La password deve avere almeno 6 caratteri' }
  }
  if (password !== confirm) {
    return { error: 'Le password non coincidono' }
  }

  const supabase = await createServerSupabase()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) return { error: error.message }
  return { success: true }
}
