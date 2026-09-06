-- ============================================================
-- STUDY COACH - Sprint 8: Streak feature
-- ============================================================
-- Aggiunge 3 colonne a profiles + una funzione trigger che aggiorna
-- lo streak quando una study_session viene marcata completata=true.
--
-- Regole della streak (modello "Duolingo moderno"):
--   1. Se l'utente completa una sessione oggi (date(NEW) == date(last))
--      -> no-op. Una sola sessione al giorno conta.
--   2. Se completa una sessione domani (last + 1 day) -> +1.
--   3. Se completa una sessione dopo uno "skip" di 1 giorno (gap = 2
--      giorni tra last e NEW) -> +1, consumando UNA freeze. Se la
--      freeze è già stata usata in questa settimana -> reset a 1.
--   4. Se completa una sessione dopo uno "skip" di 2+ giorni (gap >= 3
--      giorni) -> reset a 1. La freeze NON salva gap così grandi.
--   5. Il "freeze" viene consumato in modo SILENZIOSO: l'utente non
--      deve fare nulla, non c'è opt-in. Se la freeze è disponibile
--      e il gap lo richiede, viene bruciata automaticamente.
--
-- "Settimana" per il freeze = settimana ISO (date_trunc('week', ...))
-- a partire da lunedì. streak_freeze_used_on memorizza la data
-- (lunedì di quella settimana) in cui la freeze è stata usata l'ultima
-- volta. Se è NULL OPPURE se date_trunc('week', NOW()) è diverso,
-- una nuova freeze è disponibile.
--
-- La funzione è `security definer` per poter scrivere su profiles
-- anche se l'UPDATE viene originato da una RLS che non consente
-- all'utente di scrivere su profiles direttamente (l'utente NON
-- aggiorna profiles.streak_* dal client; lo fa solo il trigger).
-- ============================================================

-- 1) Colonne su profiles
alter table public.profiles
  add column if not exists streak_count integer not null default 0,
  add column if not exists streak_last_updated timestamptz,
  add column if not exists streak_freeze_used_on date;

-- Commenti di documentazione (visibili in Supabase Studio)
comment on column public.profiles.streak_count is
  'Numero di giorni consecutivi con almeno una study_session completata. Aggiornato dal trigger trg_update_user_streak.';

comment on column public.profiles.streak_last_updated is
  'Timestamp UTC dell''ultima sessione che ha contribuito allo streak. Usato per calcolare il gap orario rispetto a now().';

comment on column public.profiles.streak_freeze_used_on is
  'Lunedì della settimana ISO in cui è stata usata la freeze automatica. NULL = freeze disponibile. La "settimana" va da lunedì a domenica.';

-- 2) Funzione trigger
create or replace function public.update_user_streak()
returns trigger as $$
declare
  v_user_id        uuid;
  v_last_updated   timestamptz;
  v_count          integer;
  v_freeze_used_on date;
  v_now            timestamptz := timezone('utc'::text, now());
  v_today          date      := (timezone('utc'::text, now()))::date;
  v_last_day       date;
  v_gap_days       integer;
  v_current_week   date      := date_trunc('week', (timezone('utc'::text, now()))::date)::date;
begin
  -- Guard: il trigger può scattare su INSERT OR UPDATE. Se NEW.completata
  -- è false, non facciamo nulla. Se OLD.completata era già true su un
  -- UPDATE (cioè stiamo solo aggiornando difficolta/risultato_quiz/note
  -- di una sessione già completata) non conteggiamo due volte.
  if NEW.completata is distinct from true then
    return NEW;
  end if;
  if (TG_OP = 'UPDATE') and (OLD.completata is not distinct from true) then
    return NEW;
  end if;

  -- Risali all'utente passando per exams (study_sessions.exam_id -> exams.user_id).
  -- Se l'esame è stato cancellato, NEW.exam_id punta a NULL e l'utente
  -- non è più raggiungibile: in quel caso non facciamo nulla.
  select e.user_id into v_user_id
    from public.exams e
    where e.id = NEW.exam_id;
  if v_user_id is null then
    return NEW;
  end if;

  -- Lock pessimistico sulla riga profiles: due trigger che scattano in
  -- concorrenza sullo stesso utente non possono leggere/aggiornare lo
  -- stesso valore di streak_count. (For update nowait non serve: lo
  -- streak non è un hot path.)
  select
    p.streak_count,
    p.streak_last_updated,
    p.streak_freeze_used_on
    into v_count, v_last_updated, v_freeze_used_on
    from public.profiles p
    where p.id = v_user_id
    for update;

  -- Caso 1: primo completamento in assoluto (mai studiato prima).
  if v_last_updated is null then
    update public.profiles
      set streak_count        = 1,
          streak_last_updated = v_now,
          streak_freeze_used_on = null
      where id = v_user_id;
    return NEW;
  end if;

  v_last_day  := v_last_updated::date;
  v_gap_days  := (v_today - v_last_day);

  -- Caso 2: stessa giornata -> no-op. (L'utente può aver completato
  -- più sessioni oggi, ma la streak non incrementa più di una volta
  -- al giorno.)
  if v_gap_days = 0 then
    return NEW;
  end if;

  -- Caso 3: streak continua (ieri -> oggi). +1, niente freeze.
  if v_gap_days = 1 then
    update public.profiles
      set streak_count        = v_count + 1,
          streak_last_updated = v_now
      where id = v_user_id;
    return NEW;
  end if;

  -- Caso 4: gap di 2 giorni (ieri l'altro -> oggi). Si può "salvare"
  -- con la freeze SE la freeze settimanale non è già stata usata in
  -- questa settimana ISO. Altrimenti reset a 1.
  --
  -- Nota: 36-hour grace rule = "se sono passate <= 36h dall'ultima
  -- sessione, lo streak è ancora vivo". Ma qui guardiamo gap_days per
  -- decidere se serve la freeze: con gap_days = 2 (cioè ieri l'altro)
  -- la finestra di 36h potrebbe essere scaduta ma la regola settimanale
  -- permette ancora di salvare UN giorno a settimana. Implementiamo:
  --   - gap_days == 2: prova a consumare la freeze (se disponibile)
  --   - gap_days >= 3: reset, niente freeze (anche se disponibile)
  --
  -- La regola "36h grace" si applica SOLO per il calcolo di isAtRisk
  -- lato client (vedi getStreak in src/actions/streak.ts). Per il
  -- conteggio vero, ci basiamo sui giorni solari.
  if v_gap_days = 2 then
    if v_freeze_used_on is null or v_freeze_used_on < v_current_week then
      -- Freeze disponibile: consumala e continua la streak.
      update public.profiles
        set streak_count          = v_count + 1,
            streak_last_updated   = v_now,
            streak_freeze_used_on = v_current_week
        where id = v_user_id;
    else
      -- Freeze già usata questa settimana: reset.
      update public.profiles
        set streak_count        = 1,
            streak_last_updated = v_now,
            streak_freeze_used_on = v_freeze_used_on  -- invariata
        where id = v_user_id;
    end if;
    return NEW;
  end if;

  -- Caso 5: gap >= 3 giorni. Lo streak è rotto, niente freeze.
  -- (Ricomincia da 1, ma con tono non giudicante lato UI.)
  update public.profiles
    set streak_count        = 1,
        streak_last_updated = v_now,
        streak_freeze_used_on = null   -- nuova settimana, freeze resettata
    where id = v_user_id;

  return NEW;
end;
$$ language plpgsql security definer;

-- 3) Trigger. AFTER INSERT OR UPDATE: copre sia il flusso normale
-- (createSession con completata=false poi UPDATE) sia un eventuale
-- futuro INSERT diretto con completata=true. La guard nella funzione
-- evita il doppio conteggio.
drop trigger if exists trg_update_user_streak on public.study_sessions;

create trigger trg_update_user_streak
  after insert or update of completata on public.study_sessions
  for each row execute procedure public.update_user_streak();

-- ============================================================
-- Query di test manuale
-- ============================================================
-- Per verificare il trigger:
--   1. Sostituisci 'USER_ID' con il tuo profiles.id (lo vedi in
--      Supabase Studio -> Authentication -> Users).
--   2. Crea un esame per quell'utente (se non ne ha).
--   3. UPDATE study_sessions SET completata = true WHERE id = '<sid>';
--   4. SELECT streak_count, streak_last_updated, streak_freeze_used_on
--        FROM profiles WHERE id = 'USER_ID';
--
-- Comportamento atteso al primo update: streak_count = 1,
-- streak_last_updated = NOW() UTC.
--
-- Per testare la freeze in isolamento (opzionale):
--   UPDATE profiles SET streak_count = 5,
--                       streak_last_updated = now() - interval '2 days',
--                       streak_freeze_used_on = null
--     WHERE id = 'USER_ID';
--   -- poi completa una sessione: dovrebbe andare a 6 e
--   -- streak_freeze_used_on = date_trunc('week', now()).
-- ============================================================
