'use server'

import { createServerSupabase } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function signUp(formData: FormData) {
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
      // dove atterrare DOPO il click sul link nella mail
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  // Nessuna session → l'utente deve confermare la mail
  if (!data.session) {
    return {
      success: true,
      needsEmailConfirmation: true,
      email,
    }
  }

  // (caso raro: conferma disattivata in Supabase)
  return {
    success: true,
    needsEmailConfirmation: false,
  }
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
