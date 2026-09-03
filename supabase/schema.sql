-- ============================================================
-- STUDY COACH - Database Schema (Supabase PostgreSQL)
-- ============================================================
-- Esegui questo script nella SQL Editor di Supabase
-- ============================================================

-- Estensione per vettori (per futuro RAG sui materiali)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- TABELLA: users (gestita da Supabase Auth, ma aggiungiamo metadati)
-- ============================================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  nome text not null,
  email text not null unique,
  universita text,
  corso text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS per profiles
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Trigger per creare profilo automatico alla registrazione
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nome, email, universita, corso)
  values (new.id, new.raw_user_meta_data->>'nome', new.email, '', '');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- TABELLA: exams
-- ============================================================
create table if not exists public.exams (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  nome_esame text not null,
  universita text not null,
  corso text not null,
  professore text,
  data_esame date not null,
  voto_obiettivo integer not null check (voto_obiettivo between 18 and 30),
  modalita text check (modalita in ('scritto', 'orale', 'misto')),
  ore_giorno integer not null default 2 check (ore_giorno between 1 and 12),
  stato text default 'in_corso' check (stato in ('in_corso', 'completato', 'sospeso')),
  categoria text default 'scientifica' check (categoria in ('scientifica', 'mnemonica', 'applicativa')),
  preparazione_percentuale integer default 0 check (preparazione_percentuale between 0 and 100),
  -- giorni_mancanti calcolato lato app (daysUntil() in Next.js)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.exams enable row level security;
create policy "Users can CRUD own exams" on public.exams for all using (auth.uid() = user_id);

-- ============================================================
-- TABELLA: topics (argomenti dell'esame)
-- ============================================================
create table if not exists public.topics (
  id uuid default gen_random_uuid() primary key,
  exam_id uuid references public.exams(id) on delete cascade not null,
  nome_argomento text not null,
  peso integer default 1 check (peso between 1 and 5),
  ordine integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.topics enable row level security;
create policy "Users can CRUD own topics" on public.topics for all using (
  exam_id in (select id from public.exams where user_id = auth.uid())
);

-- ============================================================
-- TABELLA: competences (livelli dello studente per argomento)
-- ============================================================
create table if not exists public.competences (
  id uuid default gen_random_uuid() primary key,
  topic_id uuid references public.topics(id) on delete cascade not null,
  teoria integer default 0 check (teoria between 0 and 100),
  memoria integer default 0 check (memoria between 0 and 100),
  esercizi integer default 0 check (esercizi between 0 and 100),
  problemi_complessi integer default 0 check (problemi_complessi between 0 and 100),
  orale integer default 0 check (orale between 0 and 100),
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.competences enable row level security;
create policy "Users can CRUD own competences" on public.competences for all using (
  topic_id in (select t.id from public.topics t join public.exams e on t.exam_id = e.id where e.user_id = auth.uid())
);

-- ============================================================
-- TABELLA: study_sessions
-- ============================================================
create table if not exists public.study_sessions (
  id uuid default gen_random_uuid() primary key,
  exam_id uuid references public.exams(id) on delete cascade not null,
  topic_id uuid references public.topics(id) on delete set null,
  data date not null default current_date,
  attivita text not null,
  durata_minuti integer not null,
  completata boolean default false,
  difficolta integer check (difficolta between 1 and 5),
  risultato_quiz integer check (risultato_quiz between 0 and 100),
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.study_sessions enable row level security;
create policy "Users can CRUD own sessions" on public.study_sessions for all using (
  exam_id in (select id from public.exams where user_id = auth.uid())
);

-- ============================================================
-- TABELLA: materials (file caricati)
-- ============================================================
create table if not exists public.materials (
  id uuid default gen_random_uuid() primary key,
  exam_id uuid references public.exams(id) on delete cascade not null,
  nome_file text not null,
  tipo text not null check (tipo in ('pdf', 'slide', 'appunti', 'prova_passata', 'altro')),
  storage_path text not null,
  dimensione_kb integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.materials enable row level security;
create policy "Users can CRUD own materials" on public.materials for all using (
  exam_id in (select id from public.exams where user_id = auth.uid())
);

-- ============================================================
-- TABELLA: daily_plans (piani generati dal Coach)
-- ============================================================
create table if not exists public.daily_plans (
  id uuid default gen_random_uuid() primary key,
  exam_id uuid references public.exams(id) on delete cascade not null,
  data date not null default current_date,
  piano_json jsonb not null default '[]'::jsonb,
  generato_ai boolean default false,
  completato boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.daily_plans enable row level security;
create policy "Users can CRUD own plans" on public.daily_plans for all using (
  exam_id in (select id from public.exams where user_id = auth.uid())
);

-- ============================================================
-- INDICI
-- ============================================================
create index if not exists idx_exams_user_id on public.exams(user_id);
create index if not exists idx_exams_data on public.exams(data_esame);
create index if not exists idx_topics_exam_id on public.topics(exam_id);
create index if not exists idx_sessions_exam_id on public.study_sessions(exam_id);
create index if not exists idx_sessions_data on public.study_sessions(data);
create index if not exists idx_materials_exam_id on public.materials(exam_id);
create index if not exists idx_plans_exam_data on public.daily_plans(exam_id, data);

-- ============================================================
-- FUNZIONE: Calcola preparazione media esame
-- ============================================================
create or replace function public.calcola_preparazione_esame(exam_uuid uuid)
returns integer as $$
declare
  media_competenze numeric;
begin
  select avg((c.teoria + c.memoria + c.esercizi + c.problemi_complessi + c.orale) / 5.0)
  into media_competenze
  from public.competences c
  join public.topics t on c.topic_id = t.id
  where t.exam_id = exam_uuid;

  return coalesce(round(media_competenze), 0);
end;
$$ language plpgsql security definer;

-- ============================================================
-- FUNZIONE: Aggiorna percentuale preparazione esame
-- ============================================================
create or replace function public.aggiorna_preparazione_esame()
returns trigger as $$
begin
  update public.exams
  set preparazione_percentuale = public.calcola_preparazione_esame(new.exam_id)
  where id = new.exam_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_aggiorna_preparazione
  after insert or update on public.competences
  for each row execute procedure public.aggiorna_preparazione_esame();
