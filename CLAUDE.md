# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

Study Coach is an Italian-language AI personal study coach for university students. It removes the student's decision of "what should I study today?" — the user logs in, the app proposes a daily plan, runs a study timer, and updates per-topic competence scores based on feedback.

Stack (all free-tier, total €0/month):
- **Next.js 15** App Router, React 19, TypeScript strict
- **Supabase** for Postgres, Auth, Storage, and Row-Level Security
- **AI providers** (dual-config, both free tier, no credit card required):
  - **NVIDIA NIM** (`integrate.api.nvidia.com/v1`) is used for `generateSubtopicsForTopic` (the most structure-sensitive task — NIM with `nvidia/nemotron-3-super-120b-a12b` is the most reliable for subtopic generation).
  - **Groq** (`api.groq.com/openai/v1`) is used for `analyzeMaterialWithAI`, `generateQuizFromMaterial`, and `explainConcept` (low-latency responses for the user's interactive flows). Default: `openai/gpt-oss-120b`.
  - `gemini.ts` and `openrouter.ts` exist in `src/actions/` as alternative providers but are not wired in.

## Commands

- `npm run dev` — start Next.js dev server on http://localhost:3000
- `npm run build` — production build
- `npm run start` — run production build
- `npm run lint` — `next lint` (ESLint via `eslint-config-next`)
- No test suite is configured.

There is no separate "run a single test" command — there are no tests.

## Environment setup

`.env.local` must define (see `.env.local.example`):
- `NVIDIA_API_KEY=nvapi-...` (active — subtopics), `GROQ_API_KEY=gsk_...` (active — analisi, quiz, spiegazioni); `GEMINI_API_KEY=<your-key>` and `OPENROUTER_API_KEY=sk-or-v1-...` are the commented-out alternatives
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

Database schema lives in `supabase/`. Apply in order in the Supabase SQL Editor:
1. `supabase/schema.sql` — core tables (`profiles`, `exams`, `topics`, `competences`, `study_sessions`, `materials`, `daily_plans`), RLS policies, competence-trigger.
2. `supabase/schema_updates_sprint3_5.sql` — `exam_feedbacks` table.
3. `supabase/schema_updates_sprint6.sql` — `subtopics` table and `study_sessions.subtopic_id` column.

Storage bucket `materials` must be created in the Supabase dashboard (private) with RLS policies that namespace files by `auth.uid()` as the first folder segment.

## Architecture

### Routing (App Router, all under `src/app/`)
- `/` — redirects to `/login`
- `/login` — single page handles sign-in and sign-up (calls Server Actions)
- `/dashboard` — list user's in-progress exams, daily reminder banner
- `/exam/new` — create-exam form
- `/exam/[id]` — single-exam workspace (tabs: daily plan, calendar, materials, post-exam)

Pages are `'use client'` and call Server Actions directly. There are no API route handlers.

### Server Actions (`src/actions/*`)
Each file starts with `'use server'` and returns plain `{ success, error, ... }` objects. The convention is that callers handle the result client-side. All Supabase work goes through `createServerSupabase()` from `src/lib/supabase.ts`, which uses `@supabase/ssr` cookie-based auth (Next 15 async `cookies()` API).

- `auth.ts` — `signUp`, `signIn`, `signOut`, `getUser`
- `exams.ts` — CRUD on exams + private `generateDefaultTopics()` which seeds topics/subtopics/competences from a category-specific template (`scientifica`/`mnemonica`/`applicativa`) when a new exam is created.
- `materials.ts` — signed-URL upload flow (`getUploadUrl` → client `PUT` to signed URL → `confirmUpload` → DB row). `deleteMaterial` clears `storage_path` to mark the file as "analyzed" instead of deleting the row.
- `sessions.ts` — `createSession`, `completeSession` (writes the session, updates the `subtopics.completato` flag, then bumps the relevant `competences` column by a fixed increment based on difficulty + quiz score, capped at 100).
- `coach.ts` — **the rules-based priority algorithm** (see below) and `markActivityComplete`.
- `nim.ts` — NVIDIA NIM client (`callNIM`) + AI features. **Active only for `generateSubtopicsForTopic`** (the task most sensitive to JSON-shape quality). `analyzeMaterialWithAI`, `generateQuizFromMaterial`, `explainConcept` are kept in this file but are no longer called by the live clients.
- `groq.ts` — Groq client (`callGroq`) + AI features: `analyzeMaterialWithAI`, `generateQuizFromMaterial`, `explainConcept` (3 levels: `guida`/`suggerimento`/`completo`), `discoverGroqModels` (diagnostic helper that lists available models). **Active for the 3 client-facing entrypoints above.** Does not export `generateSubtopicsForTopic` on purpose — see "AI integration notes" below.
- `gemini.ts` and `openrouter.ts` — alternative providers with the same surface; currently not wired in.
- `post-exam.ts` — submits post-exam feedback (writes a synthetic `study_sessions` row + updates exam `stato`).
- `rate-limit.ts` — per-user sliding-window rate limiter using the `ai_rate_limits` table. Wraps every AI call.
- `quiz-helpers.ts` — pure helpers (`extractFirstJson`, `repairTruncatedJson`) for parsing messy LLM output. Not `'use server'`.

### Coach engine (`src/actions/coach.ts`)

Daily-plan priority score per topic:

```
Priorita = peso * risk * urgency / sqrt(daysUntilExam)
risk     = max(1, 100 - avgCompetence) / 100   // avg of the 5 competence columns
urgency  = 1.5 if voto_obiettivo >= 27 else 1.0
```

Top 4 scored topics get up to 2 subtopics each, capped by `ore_giorno`. If a topic has no subtopics yet, `generateSubtopicsForTopic` is called inline (one Promise per topic, awaited). Any leftover ≥15 min is filled with a generic quiz activity. The resulting array is upserted into `daily_plans.piano_json` keyed on `(exam_id, data)`.

### Types (`src/types/database.ts`)
Hand-written `Database` interface mirroring the SQL schema. Don't rely on `supabase gen types` — the file is the source of truth. Row/Insert/Update shapes are exported as `Exam`, `Topic`, `Competence`, `StudySession`, `Profile`, `DailyPlan`.

### UI conventions
- Tailwind + custom `coach` palette (defined in `tailwind.config.js`).
- Shared utility classes (`btn-primary`, `card`, `label`, `input`) live in `src/app/globals.css`.
- Dark mode via `class` strategy + `ThemeProvider` reading `localStorage`.
- Lucide icons throughout.
- Italian copy in UI strings and AI prompts.

### AI integration notes
- The project uses **two providers in parallel** — `nim.ts` for subtopics, `groq.ts` for everything else. Both clients (`callNIM`, `callGroq`) have an in-memory `aiResponseCache` (1-hour TTL, capped at 150 entries) keyed on the request payload — important: this lives on the server instance, not shared across instances.
- `callNIM()` sends `chat_template_kwargs: { thinking: false }` by default to suppress Nemotron chain-of-thought; a `stripThinking()` regex cleaner (`nim.ts`) is a safety net. `callGroq()` doesn't need that flag (gpt-oss doesn't emit CoT the same way) but applies the same `stripThinking()` to user-facing text responses.
- `disable_thinking: false` opts back into thinking for NIM if needed.
- Requests have `AbortController` timeouts with one retry (longer on each retry) in both providers.
- Every AI entrypoint calls `checkRateLimit(action)` first — actions: `analyze_material`, `generate_subtopics`, `generate_quiz`, `explain_concept`.
- AI prompts demand strict JSON output. Parsing falls back to `extractFirstJson()` (bracket-balanced scanner in `quiz-helpers.ts`) → `repairTruncatedJson()` if `JSON.parse` fails. Both providers use the same `safeParseJSON` helper.
- NIM `DEFAULT_MODEL` comes from `NIM_DEFAULT_MODEL` env var (currently `nvidia/nemotron-3-super-120b-a12b`). Groq `DEFAULT_MODEL` comes from `GROQ_DEFAULT_MODEL` (currently `openai/gpt-oss-120b`). Both providers use `FAST_MODEL` for quiz/explanation endpoints.
- "Model unavailable" detection in NIM: body matching `has reached its end` or 404/"model not found"/"model field is required" → `AI_MODEL_RETIRED:` prefix → Italian banner ("scegline uno attivo da build.nvidia.com/models"). In Groq: body matching "model decommissioned"/"model not found"/"model unavailable" or 404 → same `AI_MODEL_RETIRED:` prefix → Italian banner ("scegline uno attivo da console.groq.com/docs/models"). The caller-side banners don't need to know which provider answered.
- **Subtopics stay on NIM.** `groq.ts` does not export `generateSubtopicsForTopic` — `coach.ts` and the internal subtopic-generation call inside `groq.ts:analyzeMaterialWithAI` both dynamically import from `@/actions/nim`. If a future change moves subtopics to Groq, add the export back to `groq.ts` and update both callers.

### Components of note
- `MaterialUploader.tsx` — file upload + post-upload AI analysis; after `analyzeMaterialWithAI` succeeds it calls `deleteMaterial()` to clear the storage path (so the file is "consumed"). Imports `analyzeMaterialWithAI` from `@/actions/groq` (Groq). Internally `groq.ts` then dynamic-imports `generateSubtopicsForTopic` from `@/actions/nim` to keep subtopic generation on NIM.
- `StudyTimer.tsx` — fullscreen timer UI with SVG progress ring, completion beep (Web Audio), and a slide-out AI Tutor panel that calls `explainConcept` at 3 help levels.
- `DailyPlan.tsx` — renders the `piano_json` activities, runs the timer on demand, opens `SessionFeedback` on completion.
- `SessionFeedback.tsx` — captures `difficolta` (1–5) + optional `risultato_quiz` + notes, then calls `completeSession()`.

## Things to know before changing things

- `daysUntil()` is duplicated in `src/lib/utils.ts` and `src/actions/coach.ts` (slightly different floor behaviour — the action floors at 1, the util does not). When changing one, check the other.
- The AI cache is process-local. In serverless/edge deployments this means cold-start cache misses only — fine for this app, but don't expect cross-user or cross-instance deduplication.
- `competences` triggers an `exams.preparazione_percentuale` recompute via `aggiorna_preparazione_esame` on every insert/update. Don't compute this in app code.
- RLS is the authorization layer; Server Actions assume the user is who they say they are. Don't add raw SQL that bypasses RLS for end-user flows.
- The schema is hand-written and `src/types/database.ts` is not auto-generated. If you add a column, update both the SQL migration and the `Database` interface.