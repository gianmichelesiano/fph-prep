# FPH Prep - Piano di Implementazione

> **Stato aggiornato:** 2026-04-13 (sessione 3)
> Legenda: ✅ completato · 🔲 da fare · 🔧 parziale

## Fase 0: Preparazione Ambiente ✅

- [x] **0.1** Creare progetto Supabase su supabase.com
- [x] **0.2** Creare account Stripe (modalità test) su stripe.com
- [x] **0.3** Creare file `.env` nel progetto con credenziali reali
- [x] **0.4** Installare dipendenze: `npm install @supabase/supabase-js react-i18next i18next i18next-browser-languagedetector`
- [ ] **0.5** Installare Supabase CLI: `npm install -g supabase` *(opzionale, usato solo per deploy edge functions)*
- [x] **0.6** Aggiungere `.env` al `.gitignore`

---

## Fase 1: Database Schema + RLS ✅

### 1.1 Schema iniziale ✅
- [x] Creare `supabase/migrations/001_initial_schema.sql`
- [x] Tabella `profiles` (id, email, full_name, is_premium, is_admin, preferred_lang, premium_since, stripe_customer_id, created_at)
- [x] Tabella `questions` (id, text, type, options, correct_answer, explanation, area, topic, lang, status, created_at, updated_at)
- [x] Tabella `simulations` (id, title, area, timer, lang, is_free, status, created_at)
- [x] Tabella `simulation_questions` (simulation_id, question_id, position)
- [x] Tabella `quiz_progress` (id, user_id, test_id, status, answers, current_index, score, total, completed_at, saved_at)
- [x] Tabella `payments` (id, user_id, stripe_session_id, amount, currency, status, created_at)

### 1.2 Row Level Security ✅
- [x] RLS su `profiles`: SELECT/UPDATE solo propria riga; admin può SELECT tutte
- [x] RLS su `questions`: SELECT per tutti gli utenti autenticati; INSERT/UPDATE/DELETE solo admin
- [x] RLS su `simulations`: SELECT per tutti gli utenti autenticati; INSERT/UPDATE/DELETE solo admin
- [x] RLS su `simulation_questions`: SELECT per tutti; INSERT/UPDATE/DELETE solo admin
- [x] RLS su `quiz_progress`: CRUD solo proprie righe; admin può SELECT tutte
- [x] RLS su `payments`: SELECT solo proprie righe; admin può SELECT tutte

### 1.3 Trigger e funzioni ✅
- [x] Trigger `on_auth_user_created` → crea riga in `profiles` automaticamente
- [x] Funzione `is_admin()` helper per RLS policies

### 1.4 Eseguire migrazione
- [ ] Applicare migrazione su Supabase (via dashboard SQL editor o CLI) ← **DA FARE: esegui il file SQL nel dashboard**
- [ ] Verificare tabelle create correttamente
- [ ] Inserire il proprio utente come admin (`is_admin = true`)

---

## Fase 2: Migrazione dati JSON → Database 🔧

### 2.1 Script di importazione ✅
- [x] Creare `scripts/import-questions.js` (script Node.js)
- [x] Legge tutti i file JSON da `src/data/tests/`
- [x] Crea simulazioni, domande e simulation_questions
- [x] Marcare le prime 2 simulazioni come `is_free = true`

### 2.2 Eseguire importazione
- [ ] Eseguire script: `node scripts/import-questions.js` ← **DA FARE dopo aver eseguito la migrazione SQL**
- [ ] Verificare conteggio: domande importate, simulazioni create
- [ ] Test query: `SELECT * FROM simulations` e `SELECT count(*) FROM questions`

---

## Fase 3: Auth ✅

### 3.1 Client Supabase ✅
- [x] Creare `src/lib/supabase.js`

### 3.2 Auth Context ✅
- [x] Creare `src/contexts/AuthContext.jsx`
  - [x] State: user, profile (con is_premium, is_admin), loading
  - [x] `onAuthStateChange` listener per login/logout
  - [x] Fetch profile da tabella `profiles` dopo login
  - [x] Funzioni: signIn, signUp, signOut, refreshProfile, user, profile, loading

### 3.3 Pagina Login ✅
- [x] Creare `src/pages/Login.jsx` (email + password + Google OAuth)

### 3.4 Pagina Registrazione ✅
- [x] Creare `src/pages/Register.jsx` (nome, email, password, conferma)

### 3.5 Route protette ✅
- [x] Creare `src/components/ProtectedRoute.jsx`
- [x] Creare `src/components/AdminRoute.jsx`

### 3.6 App.jsx aggiornato ✅
- [x] `<AuthProvider>` wrappa tutto
- [x] Tutte le route configurate (pubbliche, protette, admin)

### 3.7 Configurare OAuth Google
- [ ] Creare progetto Google Cloud Console
- [ ] Configurare OAuth consent screen
- [ ] Aggiungere provider Google su Supabase Dashboard → Auth → Providers
  *(opzionale — login email/password funziona senza)*

---

## Fase 4: Refactor Frontend → Supabase ✅

### 4.1 Nuovo data layer ✅
- [x] Creare `src/lib/api.js` con `fetchSimulations()`, `fetchSimulation(id)`

### 4.2 Home.jsx ✅
- [x] Landing page (utente non loggato) + Dashboard (utente loggato)
- [x] Carica simulazioni da Supabase
- [x] Loading/error states

### 4.3 Quiz.jsx ✅
- [x] Carica test da Supabase via `fetchSimulation(id)`
- [x] Access check con `canAccessSimulation()`

### 4.4 Results.jsx ✅
- [x] Carica test da Supabase
- [x] Mostra score + revisione domande + motivazioni

### 4.5 Stats.jsx ✅
- [x] Carica simulazioni da Supabase
- [x] Carica full question data per completed tests
- [x] Global stats + per-area + weak topics

---

## Fase 5: Progresso su Supabase ✅

### 5.1 useProgress.js ✅
- [x] Hybrid: Supabase se loggato, localStorage se anonimo
- [x] `saveResult()`, `savePartial()`, `clearResult()`
- [x] `syncStatus` state ('idle'/'saving'/'saved'/'error')

### 5.2 Migrazione localStorage → Supabase ✅
- [x] `migrateAndLoad()` al primo login

### 5.3 Auto-save ✅
- [x] Debounce 5 secondi
- [x] Indicatore "Salvato ✓" / "Salvataggio..." in Quiz.jsx

---

## Fase 6: Pannello Admin ✅

### 6.1 Layout Admin ✅
- [x] Creare `src/components/admin/AdminLayout.jsx` (sidebar + navigazione)

### 6.2 Lista Domande ✅
- [x] Creare `src/pages/admin/Questions.jsx` (tabella + filtri + ricerca)

### 6.3 Editor Domanda ✅
- [x] Creare `src/pages/admin/QuestionEditor.jsx` (crea/modifica, multipla + K-PRIM)

### 6.4 Lista Simulazioni ✅
- [x] Creare `src/pages/admin/Simulations.jsx`

### 6.5 Editor Simulazione ✅
- [x] Creare `src/pages/admin/SimulationEditor.jsx` (gestione domande con picker)

---

## Fase 7: Pannello Admin - Analytics e Utenti ✅

### 7.1 Dashboard Analytics ✅
- [x] Creare `src/pages/admin/Dashboard.jsx` (KPI cards + trend registrazioni)

### 7.2 Gestione Utenti ✅
- [x] Creare `src/pages/admin/Users.jsx` (tabella + filtri + toggle premium)

### 7.3 adminApi.js ✅
- [x] Creare `src/lib/adminApi.js` con tutte le funzioni CRUD + analytics

---

## Fase 8: Pannello Admin - Generazione AI ✅

### 8.1 API per generazione ✅
- [x] Creare `supabase/functions/generate-questions/index.ts` (Edge Function Claude haiku)

### 8.2 UI Generazione ✅
- [x] Creare `src/pages/admin/Generate.jsx` (form + preview + approva/scarta)

### 8.3 Stato draft ✅
- [x] Domande generate salvate con status `active` (approvate) o scartate

---

## Fase 9: Paywall / Accesso Premium ✅

### 9.1 Logica accesso ✅
- [x] Creare `src/utils/access.js` con `canAccessSimulation()`, `getFreeSimulations()`, `getPremiumSimulations()`

### 9.2 UI Paywall ✅
- [x] Home.jsx: icona lucchetto + badge GRATIS + banner upgrade + redirect a /upgrade

### 9.3 Guard Quiz ✅
- [x] Quiz.jsx: check accesso prima di caricare → redirect /upgrade

---

## Fase 10: Stripe Payments ✅

### 10.1 Configurazione Stripe
- [ ] Creare prodotto "FPH Prep - Accesso Completo" su Stripe Dashboard ← **DA FARE**
- [ ] Annotare Price ID (price_xxx) — *attualmente il checkout usa price_data inline, nessun Price ID necessario*

### 10.2 Edge Function: Create Checkout ✅
- [x] Creare `supabase/functions/create-checkout/index.ts`

### 10.3 Edge Function: Stripe Webhook ✅
- [x] Creare `supabase/functions/stripe-webhook/index.ts`

### 10.4 Pagina Upgrade ✅
- [x] Creare `src/pages/Upgrade.jsx` (pricing card + FAQ + checkout button)

### 10.5 Pagina Payment Success ✅
- [x] Creare `src/pages/PaymentSuccess.jsx`

### 10.6 Registrare Webhook su Stripe
- [ ] Stripe Dashboard → Webhooks → aggiungi endpoint ← **DA FARE dopo deploy edge functions**
- [ ] URL: `https://xxx.supabase.co/functions/v1/stripe-webhook`
- [ ] Copiare webhook secret nel `.env` come `STRIPE_WEBHOOK_SECRET`

### 10.7 Deploy Edge Functions
- [ ] `supabase functions deploy create-checkout` ← **DA FARE**
- [ ] `supabase functions deploy stripe-webhook`
- [ ] `supabase functions deploy generate-questions`
- [ ] Aggiungere secrets: `supabase secrets set STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=... ANTHROPIC_API_KEY=...`

---

## Fase 11: Internazionalizzazione (i18n) ✅

### 11.1 Setup i18next ✅
- [x] Creare `src/lib/i18n.js` con LanguageDetector, fallback 'de'

### 11.2 File traduzioni ✅
- [x] Creare `src/locales/it.json`
- [x] Creare `src/locales/de.json`
- [x] Creare `src/locales/fr.json`
- [x] Creare `src/locales/en.json`

### 11.3 Language Switcher ✅
- [x] Creare `src/components/LanguageSwitcher.jsx` (IT/DE/FR/EN + salva in profilo Supabase)

### 11.4 Integrazione nei componenti 🔧
- [x] i18n inizializzato in main.jsx
- [ ] Sostituire stringhe hardcoded con `t('key')` nelle pagine ← *opzionale, UI funziona in italiano*

---

## Fase 12: Landing Page ✅

- [x] Home.jsx mostra LandingPage per utenti non loggati (hero + features + pricing + footer)
- [x] Dashboard per utenti loggati

---

## Fase 13: Design System "The Clinical Atelier" ✅

- [x] `tailwind.config.js` — palette MD3 completa (primary #005f6a, surface hierarchy, ecc.)
- [x] `index.html` — Google Fonts (Manrope + Inter + Material Symbols)
- [x] `src/index.css` — componenti: .btn-primary, .btn-secondary, .card, .input, .label-caps, .area-tag
- [x] `UserLayout.jsx` — sidebar fissa con brand, avatar, nav icons Material Symbols
- [x] `Home.jsx` — Landing + Dashboard con SVG ring, SimCard grid, progress bar
- [x] `Login.jsx` / `Register.jsx` — split layout editoriale
- [x] `Quiz.jsx` — EXAM MODE header, navigator domande, timer
- [x] `Results.jsx` — hero score ring, performance breakdown, question review
- [x] `Stats.jsx` — Performance Analytics con readiness ring, knowledge map, weak points
- [x] `Upgrade.jsx` — bento grid: comparison table + pricing card sticky
- [x] `PaymentSuccess.jsx` — success card con icon Material Symbols
- [x] `AdminLayout.jsx` — sidebar teal con Material Symbols icons
- [x] `AdminDashboard.jsx` — KPI cards + trend registrazioni
- [x] `admin/Questions.jsx`, `admin/Users.jsx` — design token colors (no più gray)
- [x] `data/areas.js` — colori aggiornati con token design system

## Fase 14: UX Polish 🔧

- [x] Indicatore sync "Salvato ✓" / "Salvataggio..." nel Quiz
- [x] Badge stato simulazioni (completato/in corso/non iniziato)
- [x] Skeleton loader nella dashboard
- [ ] Mobile bottom nav / hamburger menu ← opzionale
- [ ] Dark mode ← opzionale

---

## Fase 15: Deploy e Go-Live 🔲

- [ ] Eseguire migrazione SQL su Supabase ← **PROSSIMO PASSO**
- [ ] Impostare `is_admin = true` per email admin
- [ ] Eseguire `node scripts/import-questions.js`
- [ ] `npm install` nella cartella del progetto
- [ ] `npm run dev` per testare localmente
- [ ] Deploy Edge Functions su Supabase
- [ ] Registrare webhook Stripe
- [ ] Deploy frontend su Vercel o Netlify
- [ ] Configurare dominio custom

---

## Prossimi passi immediati (in ordine)

1. **Esegui la migrazione SQL**: apri il Supabase Dashboard → SQL Editor → incolla `supabase/migrations/001_initial_schema.sql` → Run
2. **Imposta admin**: `UPDATE profiles SET is_admin = true WHERE email = 'tua@email.com'`
3. **Esegui import dati**: `node scripts/import-questions.js`
4. **Testa localmente**: `npm install && npm run dev`
5. **Deploy Edge Functions**: `supabase functions deploy create-checkout && supabase functions deploy stripe-webhook && supabase functions deploy generate-questions`
6. **Configura webhook Stripe** (URL: `https://xxx.supabase.co/functions/v1/stripe-webhook`)
7. **Deploy su Vercel**: `vercel --prod`
