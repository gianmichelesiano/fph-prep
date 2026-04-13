# Piano: FPH Prep - Da progetto personale a prodotto commerciale

## Context
L'app FPH Prep è un simulatore d'esame React (Vite + Tailwind) completamente client-side. Vogliamo trasformarlo in un prodotto a pagamento con modello freemium per aiutare farmacisti a superare l'esame FPH Offizin in Svizzera.

**Nome prodotto:** FPH Prep
**Stack scelto:** Supabase (auth + DB) + Stripe (pagamenti) + React SPA esistente
**Modello business:** Freemium + pagamento singolo (~79-99 CHF). 1-2 simulazioni gratuite, pagamento per sbloccare tutto.
**Lingue:** Italiano, Tedesco, Francese, Inglese (i18n completo)

---

## Architettura Target

```
┌─────────────────────────────────┐
│  React SPA (Vite + Tailwind)    │
│  - Landing/marketing page       │
│  - Login/Register               │
│  - Quiz (free + premium)        │
│  - Dashboard/Stats              │
│  - Checkout (Stripe)            │
└──────────┬──────────────────────┘
           │
    ┌──────▼──────┐     ┌─────────────┐
    │  Supabase   │     │   Stripe    │
    │  - Auth     │     │  - Checkout │
    │  - PostgreSQL│    │  - Webhooks │
    │  - RLS      │     └──────┬──────┘
    │  - Edge Fn  │◄───────────┘
    └─────────────┘   (webhook conferma pagamento)
```

---

## Step 1: Setup Supabase + Database Schema

### Tabelle PostgreSQL

```sql
-- Profilo utente (estende auth.users)
create table profiles (
  id uuid references auth.users primary key,
  email text,
  full_name text,
  is_premium boolean default false,
  is_admin boolean default false,
  preferred_lang text default 'de',
  premium_since timestamptz,
  stripe_customer_id text,
  created_at timestamptz default now()
);

-- Domande (migrano da JSON statici a DB)
create table questions (
  id uuid default gen_random_uuid() primary key,
  text text not null,
  type text check (type in ('multiple_choice', 'kprim')),
  options jsonb not null,
  correct_answer text not null,
  explanation text,
  area integer not null,
  topic text,
  lang text default 'de',
  status text default 'active' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Simulazioni
create table simulations (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  area integer,
  timer integer default 210,
  lang text default 'de',
  is_free boolean default false,
  status text default 'active',
  created_at timestamptz default now()
);

-- Relazione simulazione-domande
create table simulation_questions (
  simulation_id uuid references simulations(id) on delete cascade,
  question_id uuid references questions(id),
  position integer not null,
  primary key (simulation_id, question_id)
);

-- Progresso quiz
create table quiz_progress (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  test_id text not null,
  status text check (status in ('in_progress', 'completed')),
  answers jsonb default '{}',
  current_index int default 0,
  score numeric,
  total numeric,
  completed_at timestamptz,
  saved_at timestamptz default now(),
  unique(user_id, test_id)
);

-- Pagamenti (log)
create table payments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id),
  stripe_session_id text,
  amount integer,
  currency text default 'chf',
  status text,
  created_at timestamptz default now()
);
```

### Row Level Security (RLS)
- `profiles`: users can read/update only their own row
- `quiz_progress`: users can CRUD only their own progress
- `payments`: users can read only their own payments
- `questions/simulations`: read per tutti gli utenti autenticati, write solo admin

---

## Step 2: Auth (Supabase Auth)

### Cosa fare
1. Installare `@supabase/supabase-js`
2. Creare `src/lib/supabase.js` con client Supabase
3. Creare `src/contexts/AuthContext.jsx` - provider React per auth state
4. Creare pagine:
   - `src/pages/Login.jsx` - email + password, Google login
   - `src/pages/Register.jsx` - registrazione
5. Modificare `src/App.jsx` - aggiungere routes protette
6. Creare `src/components/ProtectedRoute.jsx` - redirect a login se non autenticato

### Flusso
- Registrazione con email/password (+ conferma email opzionale)
- Login con email/password o Google OAuth
- Auto-create profile via Supabase trigger on auth.users insert

---

## Step 3: Migrazione Progresso da localStorage a Supabase

### Cosa fare
1. Refactorare `src/hooks/useProgress.js`:
   - Se utente loggato → salva/legge da Supabase
   - Se utente anonimo → mantieni localStorage (per demo gratuita)
   - Al primo login → migra localStorage esistente a Supabase
2. Il formato dati resta identico, cambia solo lo storage layer

---

## Step 4: Paywall / Accesso Premium

### Logica accesso
- **Gratuito:** primi 2 test (es. simulazione-1 e simulazione-2)
- **Premium:** tutti gli altri test + statistiche avanzate

### Cosa fare
1. Creare `src/utils/access.js` con logica canAccessTest
2. Modificare `src/pages/Home.jsx` - mostrare lucchetto sui test premium
3. Modificare `src/pages/Quiz.jsx` - redirect a upgrade se test locked
4. Creare `src/pages/Upgrade.jsx` - pagina pricing con CTA Stripe

---

## Step 5: Stripe Payments

### Flusso pagamento
1. Utente clicca "Sblocca accesso completo" → redirect a Stripe Checkout
2. Stripe Checkout hosted (non serve gestire carte)
3. Dopo pagamento → webhook Stripe chiama Supabase Edge Function
4. Edge Function: verifica webhook → setta `is_premium = true` su profiles

### File da creare
- `supabase/functions/create-checkout/index.ts` - crea Stripe Checkout session
- `supabase/functions/stripe-webhook/index.ts` - gestisce payment.completed
- `src/pages/Upgrade.jsx` - UI pricing + bottone checkout
- `src/pages/PaymentSuccess.jsx` - conferma pagamento

---

## Step 6: Landing Page / Marketing

### Contenuto landing (utente non loggato)
- Hero: "Supera l'esame FPH al primo tentativo"
- Features: simulazioni realistiche, tracking progressi, spiegazioni dettagliate
- Social proof (se disponibile)
- Pricing chiaro
- CTA: "Prova gratis" → register

---

## Step 7: Pannello Admin

### Accesso
- Solo 1 admin → campo `is_admin boolean default false` nella tabella `profiles`
- Route `/admin/*` protette: redirect se `!is_admin`
- RLS Supabase: le query admin richiedono `is_admin = true`

### 7a. Gestione Domande (CRUD)
- **Lista domande** con filtri per area, tema, tipo, lingua
- **Editor domanda** - form per creare/modificare
- **Import JSON** - upload di file JSON esistenti
- **Export JSON** - esportare set di domande come JSON
- **Gestione simulazioni** - comporre simulazioni selezionando domande

### 7b. Generazione AI Domande
- Integrare il pipeline Python esistente (`genera_esame.py`)
- UI: seleziona area/ruolo → genera domande → review → approva/modifica → salva nel DB
- Le domande generate vanno in stato "draft" finché non approvate

### 7c. Dashboard Analytics
- **Utenti:** totale registrati, premium, nuovi oggi/settimana/mese
- **Revenue:** totale pagamenti, conversione free→premium
- **Utilizzo:** test completati, tasso di superamento, aree più difficili

### Pagine Admin
- `src/pages/admin/Dashboard.jsx` - analytics overview
- `src/pages/admin/Questions.jsx` - lista + filtri domande
- `src/pages/admin/QuestionEditor.jsx` - crea/modifica domanda
- `src/pages/admin/Simulations.jsx` - gestione simulazioni
- `src/pages/admin/SimulationEditor.jsx` - componi simulazione
- `src/pages/admin/Users.jsx` - lista utenti + stato premium
- `src/pages/admin/Generate.jsx` - UI generazione AI
- `src/components/admin/AdminLayout.jsx` - layout con sidebar nav

---

## Step 8: Internazionalizzazione (i18n)

### Approccio: `react-i18next`

### Struttura traduzioni
```
src/locales/
  it.json   # Italiano
  de.json   # Tedesco
  fr.json   # Francese
  en.json   # Inglese
```

### Cosa tradurre
- **UI statica:** bottoni, labels, messaggi, titoli pagine, landing page
- **Domande esame:** restano nella lingua originale, filtrate per campo `lang`
- **Email Supabase:** template auth multilingua

### Implementazione
1. Installare `react-i18next` + `i18next`
2. Creare `src/lib/i18n.js` - configurazione con detection lingua browser
3. Creare file JSON per ogni lingua
4. Wrap App con `I18nextProvider`
5. Usare `useTranslation()` hook in tutti i componenti
6. Language switcher nel header/nav
7. Salvare preferenza lingua nel profilo utente

---

## Step 9: Miglioramenti UX

1. **Progress sync indicator** - mostrare che i dati sono salvati nel cloud
2. **Exam passed badge** - tracciare se l'utente ha superato (≥67%) ogni simulazione
3. **Overall readiness indicator** - "Sei pronto per l'esame?" basato su stats aggregate
4. **Language switcher** - nel header, persistente

---

## Ordine di implementazione

| # | Task |
|---|------|
| 1 | Setup Supabase + DB schema completo + RLS |
| 2 | Migrazione dati: importare i 13 JSON esistenti nel DB |
| 3 | Auth (login/register/context) |
| 4 | Refactor frontend: leggere domande/simulazioni da Supabase |
| 5 | Migrare useProgress a Supabase |
| 6 | Pannello Admin: CRUD domande + simulazioni |
| 7 | Pannello Admin: dashboard analytics + gestione utenti |
| 8 | Pannello Admin: generazione AI domande |
| 9 | Paywall logic + access control |
| 10 | Stripe integration (checkout + webhook) |
| 11 | i18n setup + traduzioni IT/DE/FR/EN |
| 12 | Landing page (multilingua) |
| 13 | UX polish |

---

## File principali da modificare/creare

### Nuovi file
- `src/lib/supabase.js` - Supabase client
- `src/lib/i18n.js` - Configurazione i18next
- `src/locales/{it,de,fr,en}.json` - Traduzioni
- `src/contexts/AuthContext.jsx` - Auth state provider
- `src/pages/Login.jsx` - Login page
- `src/pages/Register.jsx` - Register page
- `src/pages/Upgrade.jsx` - Pricing/checkout page
- `src/pages/PaymentSuccess.jsx` - Post-payment confirmation
- `src/components/ProtectedRoute.jsx` - Route guard
- `src/components/LanguageSwitcher.jsx` - Selettore lingua
- `src/utils/access.js` - Access control logic
- `src/pages/admin/*.jsx` - Tutte le pagine admin
- `src/components/admin/AdminLayout.jsx` - Layout admin
- `supabase/migrations/001_initial_schema.sql` - DB schema
- `supabase/functions/create-checkout/index.ts` - Stripe checkout
- `supabase/functions/stripe-webhook/index.ts` - Stripe webhook

### File da modificare
- `src/App.jsx` - nuove routes + AuthProvider
- `src/hooks/useProgress.js` - Supabase sync
- `src/pages/Home.jsx` - landing page + lucchetti premium
- `src/pages/Quiz.jsx` - access check + lettura da Supabase
- `src/pages/Stats.jsx` - premium gate opzionale
- `package.json` - nuove dipendenze
- `.env` - variabili Supabase + Stripe

---

## Verifica / Test

1. **Auth:** Registrazione → conferma email → login → logout → login di nuovo
2. **Free access:** Utente nuovo può accedere solo ai 2 test gratuiti
3. **Paywall:** Click su test premium → redirect a Upgrade page
4. **Pagamento:** Stripe Checkout → webhook → user diventa premium → accesso sbloccato
5. **Progress sync:** Fare quiz → chiudere browser → riaprire → progresso mantenuto
6. **Admin:** Login admin → CRUD domande → crea simulazione → verifica nel frontend
7. **i18n:** Cambiare lingua → tutta la UI si aggiorna → preferenza salvata

---

## Design Brief per UI Designer

### Cos'è
Piattaforma web per la preparazione all'esame FPH Offizin (Fachapotheker Offizinpharmazie), la certificazione per farmacisti specializzati in Svizzera. L'esame copre 9 aree tematiche.

### Target utente
Farmacisti svizzeri (25-45 anni) che si preparano all'esame FPH. Professionisti occupati, usano l'app da desktop e mobile. Parlano DE, FR, IT o EN.

### Modello business
Freemium: 1-2 simulazioni gratuite, pagamento singolo (~89 CHF) per sbloccare tutto.

### Pagine da progettare

#### Utente finale
1. **Landing Page** (non loggato) - hero, features, pricing, CTA
2. **Login / Registrazione** - email+password, Google, form minimalista
3. **Dashboard** (loggato) - lista simulazioni con stato, lucchetti premium, progresso globale
4. **Quiz** - timer, domande (multipla scelta + V/F K-PRIM), navigazione, auto-save
5. **Risultati** - score, breakdown per area, review domande con spiegazioni, punti deboli
6. **Statistiche globali** - radar/barre per area, temi deboli, trend
7. **Pagina Upgrade** - pricing card, features premium, CTA checkout
8. **Conferma pagamento** - successo + CTA inizia

#### Pannello Admin
9. **Admin Dashboard** - KPI, grafici registrazioni/conversioni/superamento
10. **Admin Domande** - tabella filtri, bottone nuova/importa
11. **Admin Editor Domanda** - form completo + preview
12. **Admin Simulazioni** - lista + editor composizione
13. **Admin Utenti** - tabella utenti con stato
14. **Admin Generazione AI** - seleziona area → genera → review → approva

### 9 Aree tematiche (con colori distinti)
1. Validazione ricette
2. Fitoterapia
3. Medicina complementare
4. Farmacia clinica
5. Polimedicazione
6. Prevenzione
7. Farmacologia
8. Galenica
9. Legislazione

### Tipi di domanda
- **Scelta multipla:** domanda + 4 opzioni (A/B/C/D), seleziona una
- **K-PRIM (Vero/Falso):** domanda + 4 affermazioni, per ognuna scegli V o F

### Linee guida
- Professionale ma accessibile (utenti stressati per l'esame)
- 9 colori distinti per le aree tematiche
- Responsive: desktop-first ma mobile-friendly
- Accessibilità: contrasti adeguati, font leggibili
- Feedback visivi: superato=verde, non superato=rosso, in corso=blu
- Minimalismo: concentrazione sulle domande
- 4 lingue: IT, DE, FR, EN con language switcher nel header
