-- ============================================================
-- AGGIORNAMENTI SPRINT 6: Aggiunta subtopics e subtopic_id in study_sessions
-- ============================================================

-- TABELLA: subtopics (sottotopics per ogni argomento)
create table if not exists public.subtopics (
  id uuid default gen_random_uuid() primary key,
  topic_id uuid references public.topics(id) on delete cascade not null,
  titolo text not null,
  descrizione text,
  tipo text check (tipo in ('teoria', 'esercizio', 'ripasso', 'simulazione')),
  durata_stimata integer not null default 25 check (durata_stimata > 0),
  ordine integer default 0,
  completato boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS per subtopics
alter table public.subtopics enable row level security;
create policy "Users can CRUD own subtopics" on public.subtopics for all using (
  topic_id in (select t.id from public.topics t join public.exams e on t.exam_id = e.id where e.user_id = auth.uid())
);

-- Indici per subtopics
create index if not exists idx_subtopics_topic_id on public.subtopics(topic_id);
create index if not exists idx_subtopics_completato on public.subtopics(completato);

-- AGGIORNAMENTO TABELLA: study_sessions
-- Aggiunta colonna subtopic_id (nullable, foreign key a subtopics)
alter table public.study_sessions
  add column if not exists subtopic_id uuid references public.subtopics(id) on delete set null;

-- Indice per la nuova colonna
create index if not exists idx_sessions_subtopic_id on public.study_sessions(subtopic_id);