'use server'

import { createServerSupabase } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function signUp(formData: FormData) {
  const supabase = await createServerSupabase()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const nome = formData.get('nome') as string

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nome }
    }
  })

  if (error) return { error: error.message }

  revalidatePath('/')
  return { success: true }
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
