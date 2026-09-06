-- ============================================================
-- STUDY COACH - Sprint 7: ai_rate_limits table
-- ============================================================
-- Tabella usata da src/actions/rate-limit.ts per limitare le chiamate
-- AI per utente (sliding window 1 minuto, 10 chiamate max).
--
-- Senza questa tabella, rate-limit.ts degrada gracefully a "permetti
-- sempre" (catch nel try). Crearla abilita la protezione reale.
--
-- Applica nella Supabase SQL Editor DOPO schema.sql.
-- ============================================================

create table if not exists public.ai_rate_limits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  action text not null,
  count integer not null default 1 check (count > 0),
  window_start timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, action)
);

-- RLS: utenti possono leggere solo le proprie righe. Niente insert/update
-- dal client (lo fa il server action con il cookie-based auth client).
-- Aggiungiamo policy di select per ispezione/debug dal client.
alter table public.ai_rate_limits enable row level security;

create policy "Users can view own rate limits"
  on public.ai_rate_limits for select
  using (auth.uid() = user_id);

-- Indici per le query hot path (lookup by user_id + action)
create index if not exists idx_rate_limits_user_action
  on public.ai_rate_limits(user_id, action);

-- Trigger per mantenere updated_at coerente
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger trg_ai_rate_limits_updated_at
  before update on public.ai_rate_limits
  for each row execute procedure public.touch_updated_at();
