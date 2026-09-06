-- ============================================================
-- STUDY COACH - Sprint 9: Esami passati / post-exam feedback
-- ============================================================
-- Estende exams con i campi per registrare l'esito finale di un
-- esame sostenuto, in modo da:
--   1. Mostrare in dashboard una sezione "Esami passati" con il voto
--      e una faccina di soddisfazione (1-5).
--   2. Far apparire automaticamente la PostExamModal al primo login
--      successivo a data_esame, per raccogliere il feedback.
--   3. Poter visualizzare la scheda di riepilogo (statistiche aggregate)
--      di un esame passato, senza pero' permettere nuove sessioni.
--
-- Lo stato esistente ('in_corso' / 'completato' / 'sospeso') resta
-- valido. La dashboard distingue "passati" in base a:
--   stato = 'completato' OR data_esame < CURRENT_DATE
-- ============================================================

alter table public.exams
  add column if not exists voto_finale integer
    check (voto_finale is null or (voto_finale between 18 and 30)),
  add column if not exists soddisfazione integer
    check (soddisfazione is null or (soddisfazione between 1 and 5)),
  add column if not exists data_completamento timestamptz,
  add column if not exists argomenti_usciti text,
  add column if not exists domande_ricevute text;

-- Commenti di documentazione
comment on column public.exams.voto_finale is
  'Voto finale ottenuto all''esame (18-30, oppure 30 con lode che
  viene persistito come 30 + flag separate). NULL finche'' l''utente
  non compila la PostExamModal.';

comment on column public.exams.soddisfazione is
  'Faccina di soddisfazione 1-5 scelta dall''utente dopo l''esame:
  1=triste, 2=annoiato, 3=neutro, 4=contento, 5=euforico. NULL = non
  ancora espressa.';

comment on column public.exams.data_completamento is
  'Timestamp UTC in cui l''utente ha confermato l''esito. Coincide
  tipicamente con il giorno dopo data_esame, ma puo'' essere anche
  molto dopo (se l''utente ha ignorato il pop-up).';

comment on column public.exams.argomenti_usciti is
  'Testo libero: quali argomenti sono usciti all''esame.';

comment on column public.exams.domande_ricevute is
  'Testo libero: domande/trappole/consigli per chi viene dopo.';

-- ============================================================
-- Indice utile per la query "esami passati" (data_esame < oggi
-- oppure stato != in_corso). Postgres puo'' usare l'indice su
-- data_esame per il primo predicato.
-- ============================================================
create index if not exists idx_exams_stato_data
  on public.exams (user_id, stato, data_esame);
