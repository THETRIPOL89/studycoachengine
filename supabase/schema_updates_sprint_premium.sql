-- ============================================================
-- STUDY COACH - Premium Tier Migration
-- ============================================================
-- Esegui DOPO schema.sql, schema_updates_sprint3_5.sql e
-- schema_updates_sprint6.sql.
--
-- Aggiunge:
--   - 4 colonne billing su profiles (plan, premium_until, stripe_customer_id,
--     stripe_subscription_id)
--   - tabella subscriptions (audit insert-only via service_role)
--   - replacement della policy "Users can update own profile" con una versione
--     che impedisce all'utente di scrivere le colonne billing (con `is not distinct from`)
--   - check constraint su profiles.plan per garantire solo 'free' o 'premium'
-- ============================================================

-- ============================================================
-- 1. Colonne billing su profiles
-- ============================================================
alter table public.profiles
  add column if not exists plan text default 'free' check (plan in ('free', 'premium')),
  add column if not exists premium_until timestamp with time zone,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

-- Indice per query veloci su plan (utile per analytics future).
create index if not exists idx_profiles_plan on public.profiles(plan);

-- ============================================================
-- 2. Replacement policy update profiles (colonna-level security)
-- ============================================================
-- La policy originale "Users can update own profile" permetteva update di
-- tutte le colonne. La sostituiamo con una versione che esclude le 4 colonne
-- billing: l'unico writer autorizzato per quelle è il webhook Stripe via
-- service_role. Usiamo `is not distinct from` per accettare sia `null = null`
-- (mantieni null) sia scritture di `null` quando la colonna è null.
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can update own non-billing profile" on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and plan is not distinct from (
      (select p.plan from public.profiles p where p.id = auth.uid())
    )
    and premium_until is not distinct from (
      (select p.premium_until from public.profiles p where p.id = auth.uid())
    )
    and stripe_customer_id is not distinct from (
      (select p.stripe_customer_id from public.profiles p where p.id = auth.uid())
    )
    and stripe_subscription_id is not distinct from (
      (select p.stripe_subscription_id from public.profiles p where p.id = auth.uid())
    )
  );

-- Trigger di sicurezza che blocca la modifica delle 4 colonne billing da
-- parte di un utente autenticato. Postgres RLS non può escludere colonne da
-- un UPDATE, quindi usiamo un BEFORE UPDATE trigger che confronta OLD vs NEW
-- e solleva un'eccezione se uno dei campi billing cambia.
--
-- service_role ha auth.uid() = NULL, quindi bypassa sia RLS sia questo trigger.
-- Solo l'utente normale (auth.uid() valorizzato) viene bloccato.
create or replace function public.block_billing_columns_update()
returns trigger as $$
begin
  if auth.uid() is not null then
    if new.plan is distinct from old.plan
      or new.premium_until is distinct from old.premium_until
      or new.stripe_customer_id is distinct from old.stripe_customer_id
      or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    then
      raise exception 'Non autorizzato a modificare le colonne billing (plan, premium_until, stripe_customer_id, stripe_subscription_id)'
        using errcode = '42501'; -- insufficient_privilege
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_block_billing_columns on public.profiles;
create trigger trg_profiles_block_billing_columns
  before update on public.profiles
  for each row execute procedure public.block_billing_columns_update();

-- ============================================================
-- 3. Tabella subscriptions (audit insert-only)
-- ============================================================
create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  stripe_subscription_id text not null unique,
  stripe_customer_id text,
  status text not null,  -- 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'unpaid'
  current_period_end timestamp with time zone not null,
  plan text not null,  -- 'premium' (per ora solo premium; campo forward-compatible)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.subscriptions enable row level security;

-- L'utente può SOLO leggere le proprie subscriptions (transparency).
-- Insert/Update/Delete: SOLO service_role (webhook handler).
create policy "Users can view own subscriptions" on public.subscriptions
  for select using (auth.uid() = user_id);

-- Indici per query frequenti dal webhook (lookup per stripe_subscription_id è
-- già coperto dall'unique constraint, ma aggiungiamo user_id per listing).
create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);
create index if not exists idx_subscriptions_status on public.subscriptions(status);

-- ============================================================
-- 4. Trigger: aggiorna updated_at su subscriptions
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_subscriptions_touch on public.subscriptions;
create trigger trg_subscriptions_touch
  before update on public.subscriptions
  for each row execute procedure public.touch_updated_at();

-- ============================================================
-- 5. Backfill: tutti i profile esistenti sono 'free' di default.
-- (La colonna ha gia' default 'free' ma essere espliciti non guasta.)
-- ============================================================
update public.profiles
  set plan = 'free'
  where plan is null;
