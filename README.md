# 📚 Study Coach — MVP Completo

> AI personal study coach universitario. Lo studente non deve più decidere cosa studiare. Apre l'app e il Coach risponde.

---

## 🎯 Visione

Study Coach risolve il problema degli studenti universitari che falliscono non per mancanza di studio, ma perché:
- non sanno cosa studiare
- non sanno organizzarsi
- non sanno se sono abbastanza preparati
- non sanno quali argomenti sono davvero importanti

**La domanda dello studente:** *"Ho 2 ore. Apro l'app. Cosa devo fare?"*

**Il Coach risponde.**

---

## 🏗️ Architettura

| Livello | Tecnologia | Costo |
|---------|-----------|-------|
| **Frontend** | Next.js 15 (App Router) | €0 (Vercel Hobby) |
| **Backend** | Next.js Server Actions | €0 |
| **Database** | Supabase PostgreSQL | €0 (500MB, 50K MAU) |
| **Storage** | Supabase Storage | €0 (1GB) |
| **Auth** | Supabase Auth | €0 |
| **AI** | **NVIDIA NIM** (subtopics) + **Groq** (analisi, quiz, AI Tutor) | €0 |

**Costo totale MVP: €0/mese**

---

## 🤖 Provider AI: configurazione dual-provider (attiva)

Il progetto usa **due provider AI in parallelo**, ognuno scelto per il task in cui eccelle:

| | NVIDIA NIM | Groq |
|---|---|---|
| **Task** | `generateSubtopicsForTopic` (subtopics per il piano) | `analyzeMaterialWithAI`, `generateQuizFromMaterial`, `explainConcept` (analisi materiali, quiz, AI Tutor) |
| **Costo** | €0 (free tier) | €0 (free tier) |
| **Carta di credito** | ❌ Non richiesta | ❌ Non richiesta |
| **Latenza tipica** | 3–10s | <1s per modelli veloci |
| **Modello default** | `nvidia/nemotron-3-super-120b-a12b` | `openai/gpt-oss-120b` |
| **Endpoint** | `integrate.api.nvidia.com/v1` | `api.groq.com/openai/v1` |

**Perché questa divisione:**
- **NIM per le subtopics** — è il task più strutturato (JSON-shape, sequenza logica di 4-6 micro-argomenti per topic). NIM con Nemotron-3 Super ha la qualità più alta su questo task, e la sua lentezza è irrilevante perché la generazione avviene in background.
- **Groq per il resto** — bassa latenza per i task interattivi dove l'utente sta guardando uno spinner (analisi materiale, quiz, pannello AI Tutor). gpt-oss-120b è OpenAI-compatible e segue bene i prompt strutturati.

**Come ottenere le API key:**
- **NIM**: vai su [build.nvidia.com](https://build.nvidia.com), crea account NVIDIA Developer, clicca **"Get API Key"** → key inizia con `nvapi-`. Incolla in `.env.local`: `NVIDIA_API_KEY=nvapi-...`
- **Groq**: vai su [console.groq.com/keys](https://console.groq.com/keys), crea account Groq (sign-in con Google), clicca **"Create API Key"** → key inizia con `gsk_`. Incolla in `.env.local`: `GROQ_API_KEY=gsk_...`

### Provider alternativi (NON attivi, ma disponibili)

`gemini.ts` e `openrouter.ts` esistono già nel progetto come file alternativi completi. Se vuoi sostituire uno dei due provider attivi con Gemini o OpenRouter:

- **Gemini**: decommenta le righe `GEMINI_*` in `.env.local` e cambia l'import in `src/components/MaterialUploader.tsx`, `StudyTimer.tsx`, `DailyPlan.tsx` da `@/actions/groq` a `@/actions/gemini`. Per le subtopics (rimaste su NIM) non cambia nulla.
- **OpenRouter**: idem, ma punta a `@/actions/openrouter`.

---

## 🚀 Setup Passo-Passo

### 1. Crea progetto Next.js

```bash
npx create-next-app@latest study-coach --typescript --tailwind --eslint --app --src-dir
cd study-coach
```

### 2. Installa dipendenze

```bash
npm install @supabase/supabase-js @supabase/ssr lucide-react clsx tailwind-merge date-fns class-variance-authority
```

### 3. Configura Supabase

1. Vai su [supabase.com](https://supabase.com) → **New Project**
2. Copia **Project URL** e **Anon Key** da Settings → API
3. Vai in **SQL Editor** → New query → applica i file in ordine:
   - `supabase/schema.sql`
   - `supabase/schema_updates_sprint3_5.sql`
   - `supabase/schema_updates_sprint6.sql`
   - `supabase/schema_updates_sprint_premium.sql`
   - `supabase/schema_updates_sprint7_rate_limit.sql`
4. Vai in **Storage** → **New bucket** → nome: `materials` → Public: **NO**
5. Vai in **Authentication** → **URL Configuration**:
   - Site URL: `http://localhost:3000` (dev) / `https://your-domain.vercel.app` (prod)
   - Redirect URLs: `http://localhost:3000/**`, `https://your-domain.vercel.app/**`
6. **Consigliato**: vai in **Authentication** → **Providers** → **Email** e **disabilita "Confirm email" OFF** (oppure configuralo con un template SMTP se vuoi la conferma). Per MVP è accettabile lasciare la conferma disabilitata; per produzione con utenti reali è raccomandata la conferma email + un template Recovery.

### 3b. Configura Stripe (solo se vuoi abilitare Premium)

1. Vai su [dashboard.stripe.com](https://dashboard.stripe.com) (test mode in dev)
2. **Products** → **+ Add product** → nome "Study Coach Premium" → aggiungi 3 prezzi ricorrenti (recurring):
   - **Mensile**: €4.99 / mese → copia il `price_xxx` in `STRIPE_PRICE_MONTHLY`
   - **Semestrale**: €24.99 / 6 mesi → copia in `STRIPE_PRICE_SEMESTRAL`
   - **Annuale**: €49.99 / anno → copia in `STRIPE_PRICE_ANNUAL`
3. **Developers** → **API keys**: copia `sk_test_xxx` in `STRIPE_SECRET_KEY`
4. **Developers** → **Webhooks** → **Add endpoint**:
   - URL: `http://localhost:3000/api/stripe/webhook` (dev, via Stripe CLI) o `https://your-domain.vercel.app/api/stripe/webhook` (prod)
   - Eventi da ascoltare: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`
   - Copia il `whsec_xxx` in `STRIPE_WEBHOOK_SECRET`
5. Per testare in locale: `stripe listen --forward-to localhost:3000/api/stripe/webhook` (richiede [Stripe CLI](https://stripe.com/docs/stripe-cli))
6. In produzione: ri-crea il webhook endpoint con l'URL Vercel e copia il nuovo `whsec_xxx` nelle env Vercel.

### 4. Configura i due provider AI (NIM + Groq)

**a) NVIDIA NIM** (per le subtopics):
1. Vai su [build.nvidia.com](https://build.nvidia.com)
2. Crea account gratuito NVIDIA Developer Program
3. Scegli un modello (es. **nvidia/nemotron-3-super-120b-a12b**) → **Get API Key**
4. Copia la key (inizia con `nvapi-`)

**b) Groq** (per analisi materiali, quiz, AI Tutor):
1. Vai su [console.groq.com/keys](https://console.groq.com/keys)
2. Crea account Groq (sign-in con Google)
3. Clicca **"Create API Key"** → key inizia con `gsk_`

### 5. Environment Variables

Crea `.env.local`:

```env
# --- NVIDIA NIM (subtopics, attivo) ---
NVIDIA_API_KEY=nvapi-tua-api-key
NIM_DEFAULT_MODEL=nvidia/nemotron-3-super-120b-a12b

# --- Groq (analisi, quiz, AI Tutor, attivo) ---
GROQ_API_KEY=gsk_tua-groq-api-key
GROQ_DEFAULT_MODEL=openai/gpt-oss-120b
GROQ_FAST_MODEL=openai/gpt-oss-120b

# --- Provider alternativi (NON attivi) ---
# GEMINI_API_KEY=AIzaSy-tua-api-key
# OPENROUTER_API_KEY=sk-or-v1-tua-api-key

# --- Supabase (obbligatorio) ---
NEXT_PUBLIC_SUPABASE_URL=https://TUO-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TUO-ANON-KEY
SUPABASE_SERVICE_ROLE_KEY=TUO-SERVICE-ROLE-KEY
```

### 6. Copia i file

Copia tutti i file generati nella struttura del progetto.

### 7. Avvia

```bash
npm run dev
```

---

## 📊 User Flow Completo

```
Login/Register → Dashboard (con reminder esami urgenti)
                    ↓
            Nuovo Esame (form completo)
                    ↓
            Carica Materiali (PDF/Slide)
                    ↓
            AI Groq analizza → Estrae argomenti auto (NIM genera le subtopics)
                    ↓
            Coach genera piano giornaliero
                    ↓
            Clicca "Inizia" su un'attività
                    ↓
            Timer sessione con conto alla rovescia
                    ↓
            Completa → Feedback (difficoltà, risultato, note)
                    ↓
            Competenze si aggiornano automaticamente
                    ↓
            Piano domani si adatta
                    ↓
            Giorno esame → Messaggio motivazionale Coach
                    ↓
            Post-esame → Database esami condiviso
```

---

## 🤖 Coach Engine

### Algoritmo Priorita (rules-based)

```
Priorita = Peso Argomento × Debolezza × Urgenza / √(Giorni rimanenti)
```

- **Debolezza** = 100 - media competenze
- **Urgenza** = 1.5 se voto obiettivo ≥ 27, altrimenti 1.0
- Seleziona sempre la competenza più debole per ogni argomento

### Aggiornamento Competenze (Sprint 4)

Dopo ogni sessione, il Coach aggiorna le competenze in base al feedback:

```
Incremento = base_difficolta + bonus_quiz

Difficolta 1 (molto facile) → +15 punti
Difficolta 2 (facile)       → +10 punti
Difficolta 3 (normale)      → +5 punti
Difficolta 4 (difficile)    → +2 punti
Difficolta 5 (molto difficile) → +0 punti

Bonus quiz = risultato / 10 (max +10)

Max per competenza: 100
```

### Livelli AI Coach

| Livello | Tipo | Descrizione |
|---------|------|-------------|
| **1** | Domande guida | "Che criterio potrebbe essere utile qui?" |
| **2** | Suggerimenti | "Prova a confrontare con una serie nota" |
| **3** | Spiegazione completa | Soluzione passo dopo passo |

---

## ✅ Sprint Completati

| Sprint | Feature | Stato |
|--------|---------|-------|
| **0** | Setup progetto + Schema DB | ✅ |
| **1** | Auth + Dashboard + Creazione Esame | ✅ |
| **2** | Pagina Esame + Coach Engine rules-based | ✅ |
| **3** | Upload materiali + AI analysis + Quiz + Spiegazioni | ✅ |
| **4** | Timer sessione + Feedback post-studio + Aggiornamento competenze | ✅ |
| **5** | Notifiche giorno esame + Reminder + Post-esame | ✅ |
| **6** | Subtopics table + Sprint 6 migration | ✅ |
| **Premium** | Stripe Checkout + Webhook + Paywall modal | ✅ |
| **7** | ai_rate_limits table (protezione DDoS AI) | ✅ |

---

## 📁 Struttura File (27 file)

```
study-coach/
├── src/
│   ├── app/
│   │   ├── login/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── exam/new/page.tsx
│   │   ├── exam/[id]/page.tsx
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── page.tsx
│   ├── components/
│   │   ├── ExamCard.tsx
│   │   ├── EmptyState.tsx
│   │   ├── CompetenceBar.tsx
│   │   ├── DailyPlan.tsx
│   │   ├── MaterialUploader.tsx
│   │   ├── ExamDayBanner.tsx
│   │   ├── DailyReminder.tsx
│   │   ├── PostExamModal.tsx
│   │   ├── StudyTimer.tsx
│   │   └── SessionFeedback.tsx
│   ├── actions/
│   │   ├── auth.ts
│   │   ├── exams.ts
│   │   ├── coach.ts
│   │   ├── materials.ts
│   │   ├── nim.ts                 # NVIDIA NIM (attivo, subtopics)
│   │   ├── groq.ts                # Groq (attivo, analisi/quiz/AI Tutor)
│   │   ├── gemini.ts              # Google AI Studio (alternativa)
│   │   ├── openrouter.ts          # OpenRouter (alternativa)
│   │   ├── post-exam.ts
│   │   └── sessions.ts
│   ├── lib/
│   │   ├── supabase.ts
│   │   └── utils.ts
│   └── types/
│       └── database.ts
├── supabase/
│   ├── schema.sql
│   └── schema_updates_sprint3_5.sql
├── package.json
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── .env.local.example
└── README.md
```

---

## 🚀 Deploy su Vercel (passo-passo)

Vedi la guida completa nel file separato o chiedi a Claude di accompagnarti. Quick start:

```bash
npm i -g vercel
vercel link   # collega a un progetto Vercel nuovo
vercel --prod
```

Aggiungi le **Environment Variables** nel dashboard Vercel (Settings → Environment Variables):

| Variabile | Dove la trovi |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API |
| `NVIDIA_API_KEY` | build.nvidia.com |
| `GROQ_API_KEY` | console.groq.com/keys |
| `NIM_DEFAULT_MODEL`, `GROQ_DEFAULT_MODEL`, `GROQ_FAST_MODEL` | Vedi sezione "Provider AI" sopra |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → API keys (test in dev, live in prod) |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks (whsec_xxx del tuo endpoint) |
| `STRIPE_PRICE_MONTHLY` / `_SEMESTRAL` / `_ANNUAL` | Stripe Dashboard → Products |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain.vercel.app` (NO localhost in prod!) |

⚠️ **Webhook Stripe in prod**: dopo il deploy, crea un nuovo webhook endpoint in Stripe Dashboard puntato a `https://your-domain.vercel.app/api/stripe/webhook` e aggiorna `STRIPE_WEBHOOK_SECRET` con il nuovo `whsec_xxx`.

⚠️ **Supabase Auth URLs**: aggiorna Site URL e Redirect URLs in Supabase Auth con il dominio Vercel.

---

## 🔮 Roadmap Futura

- [ ] **Sprint 6**: Spaced Repetition (algoritmo SM-2)
- [ ] **Sprint 7**: Notifiche push browser + email (Resend)
- [ ] **Sprint 8**: Analytics ML su pattern di studio
- [ ] **Sprint 9**: Community database esami condiviso
- [ ] **Sprint 10**: App mobile PWA

---

## 💡 Note Tecniche

### Switch tra NIM, Groq, Gemini e OpenRouter

Il progetto usa **NIM (subtopics) + Groq (analisi/quiz/AI Tutor)** di default. Per cambiare la divisione:

- **Sostituire Groq con un altro provider** (per analisi/quiz/AI Tutor): modifica le 3 righe di import in `src/components/MaterialUploader.tsx`, `StudyTimer.tsx`, `DailyPlan.tsx` da `@/actions/groq` a:
  - `@/actions/nim` (se vuoi NIM anche per questi task)
  - `@/actions/gemini` (Google AI Studio)
  - `@/actions/openrouter` (OpenRouter)

- **Spostare le subtopics da NIM a un altro provider**: aggiungi `export async function generateSubtopicsForTopic(...)` al file del provider scelto, poi cambia `import { generateSubtopicsForTopic } from '@/actions/nim'` in `src/actions/coach.ts:6` e in `src/actions/groq.ts` (nella chiamata interna di `analyzeMaterialWithAI`).

Aggiorna `.env.local` con le key corrette (`NVIDIA_API_KEY=nvapi-...`, `GROQ_API_KEY=gsk-...`, `GEMINI_API_KEY=...`, oppure `OPENROUTER_API_KEY=sk-or-v1-...`).

### Modelli consigliati

**NIM** (subtopics) — modifica `DEFAULT_MODEL` in `src/actions/nim.ts`:

| Modello | Quando usarlo |
|---------|--------------|
| `nvidia/nemotron-3-super-120b-a12b` | **Default** — qualità top su parsing JSON strutturato, ottimo per subtopics |
| `nvidia_nim/openai/gpt-oss-20b` | Alternativa, bilanciamento qualità/velocità, ottimo italiano |
| `meta/llama-3.3-70b-instruct` | Qualità top su reasoning e spiegazioni |
| `nvidia/llama-3.1-nemotron-70b-instruct` | Ragionamento avanzato, spiegazioni complesse |

**Groq** (analisi/quiz/AI Tutor) — modifica `DEFAULT_MODEL` / `FAST_MODEL` in `src/actions/groq.ts`:

| Modello | Quando usarlo |
|---------|--------------|
| `openai/gpt-oss-120b` | **Default** — bassa latenza, JSON-shape affidabile |
| `llama-3.3-70b-versatile` | Alternativa versatile su Groq |
| `llama-3.1-8b-instant` | Velocissimo, ideale per spiegazioni brevi |

### Storage Bucket Permissions

In Supabase Dashboard → Storage → `materials` → Policies:

```sql
CREATE POLICY "Users can upload own materials"
ON storage.objects FOR INSERT
WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read own materials"
ON storage.objects FOR SELECT
USING (auth.uid()::text = (storage.foldername(name))[1]);
```

---

## 📄 Licenza

MIT — Progetto MVP open source.
