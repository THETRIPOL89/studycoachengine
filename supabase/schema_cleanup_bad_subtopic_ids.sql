-- ============================================================
-- CLEANUP: rimuove subtopic_id non-UUID da daily_plans.piano_json
-- ============================================================
-- Nelle versioni precedenti dell'app, quando la generazione AI dei
-- subtopics falliva o era in timeout, venivano inseriti in piano_json
-- dei subtopic "sintetici" con id del tipo `temp-<uuid>-<timestamp>`.
-- Questi non sono UUID validi e Postgres rifiuta l'inserimento in
-- study_sessions.subtopic_id (colonna uuid) quando l'utente cerca di
-- avviare una sessione su quelle attivita.
--
-- Questo script:
--  1. Sostituisce i subtopic_id non-UUID con NULL dentro piano_json
--  2. Non tocca le attivita vere (quelle con id UUID valido)
--
-- Eseguire UNA SOLA VOLTA nella SQL Editor di Supabase.
-- ============================================================

update public.daily_plans
set piano_json = (
  select jsonb_agg(
    case
      when (activity->>'subtopic_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        then activity
      else
        activity - 'subtopic_id'
    end
  )
  from jsonb_array_elements(piano_json) as activity
)
where piano_json @> '[{"subtopic_id": "temp-"}]'::jsonb
   or exists (
     select 1
     from jsonb_array_elements(piano_json) as a
     where (a->>'subtopic_id') like 'temp-%'
        or (a->>'subtopic_id') like 'fallback-%'
   );