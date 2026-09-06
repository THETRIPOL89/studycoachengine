
-- ============================================================
-- AGGIORNAMENTI SPRINT 3 e 5
-- ============================================================

-- Tabella per feedback post-esame (database esami)
create table if not exists public.exam_feedbacks (
  id uuid default gen_random_uuid() primary key,
  exam_id uuid references public.exams(id) on delete cascade not null,
  superato boolean not null,
  voto integer check (voto between 18 and 30),
  argomenti_usciti text,
  domande_ricevute text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.exam_feedbacks enable row level security;
create policy "Users can view own feedbacks" on public.exam_feedbacks for select using (
  exam_id in (select id from public.exams where user_id = auth.uid())
);
create policy "Users can insert own feedbacks" on public.exam_feedbacks for insert with check (
  exam_id in (select id from public.exams where user_id = auth.uid())
);

-- Indice per ricerche sugli argomenti usciti
create index if not exists idx_feedbacks_exam on public.exam_feedbacks(exam_id);

-- Bucket storage per materiali (da creare anche nell'interfaccia Supabase)
-- insert into storage.buckets (id, name, public) values ('materials', 'materials', false);
