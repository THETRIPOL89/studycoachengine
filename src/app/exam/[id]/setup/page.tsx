import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { ExamSetup } from '@/components/ExamSetup'

export default async function ExamSetupPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, nome_esame, categoria, user_id')
    .eq('id', id)
    .single()

  if (examError || !exam) redirect('/dashboard')

  // Verifica ownership (RLS già protegge, ma controllo difensivo)
  if ((exam as any).user_id !== user.id) redirect('/dashboard')

  const { count: topicCount } = await supabase
    .from('topics')
    .select('id', { count: 'exact', head: true })
    .eq('exam_id', id)

  const ex = exam as { id: string; nome_esame: string; categoria: string }

  return (
    <ExamSetup
      examId={ex.id}
      examTitle={ex.nome_esame}
      categoria={ex.categoria as 'scientifica' | 'mnemonica' | 'applicativa'}
      currentTopicCount={topicCount ?? 0}
    />
  )
}
