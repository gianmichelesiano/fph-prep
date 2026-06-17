# Task Implementativi UX Studio FPH Prep

**Stato: COMPLETATO — 2026-06-17**

---

## ✅ Task 1 — Aggiungere "Simulazione d'esame" alla navigazione

- Aggiunta voce `nav.examSimulation` dopo "Studia" in `UserLayout.jsx` sidebar (icona `assignment`)
- Aggiunta anche nella bottom navigation mobile (sostituisce Settings che è accessibile dalla sidebar)
- Traduzioni aggiunte: IT "Simulazione d'esame", EN "Exam Simulation", FR "Simulation d'examen", DE "Prüfungssimulation"

---

## ✅ Task 2 — Rinominare semanticamente Dashboard / simulazioni

- Aggiunto badge "Simulazione d'esame" nell'header di `Home.jsx` per utenti loggati
- Aggiornato `dashboard.subtitle` a testo più descrittivo
- Rinominato `dashboard.simulationModules` da "Moduli di Simulazione" a "Simulazioni d'esame"

---

## ✅ Task 3 — Migliorare la pagina `/study` come hub dei ruoli

- Aggiunto conteggio contenuti teoria per area (`fetchAreaCounts` da notebookContentsApi)
- Card ruoli ora mostrano: numero domande, accuratezza, indicatore contenuti teoria (conteggio)
- Aggiunta CTA "Continua studio" / "Apri ruolo" con hover sulle card
- Overview card estesa con 4 colonne: domande totali, completate, accuratezza, aree con teoria

---

## ✅ Task 4 — Riorganizzare i tab del singolo ruolo

Nuovi tab in `StudyArea.jsx`:
- **Teoria** — contenuti notebook ordinati, obiettivi apprendimento, topics
- **Ripasso attivo** — mini-quiz configurabile con player e risultati
- **Domande d'esame** — modalità esercizio + banca domande filtrabile
- **Errori** — statistiche errori, CTA ripeti errori, argomenti collegati
- **Progresso** — metriche domande, progresso contenuti, suggerimenti

---

## ✅ Task 5 — Migliorare la sezione teoria del ruolo

Implementato nel tab Teoria:
- Lista ordinata con numerazione
- Badge: "Da leggere" (amber), "Letto" (primary), "Premium" (tertiary), "Free" (green), "In preparazione"
- CTA per ogni contenuto: "Studia", "Ripassa"
- Obiettivi di apprendimento e argomenti del ruolo in sezioni separate

---

## ✅ Task 6 — Migliorare la pagina contenuto teorico `/study/topic/:key`

- Aggiunto componente `ReadStatusBadge` con toggle "Letto" / "Da leggere"
- Badge Free/Premium nell'header
- Sezione CTA post-contenuto con 3 azioni: prossimo argomento, domande sul ruolo, torna al ruolo
- Mantenuto sommario sticky e navigazione precedente/successivo

---

## ✅ Task 7 — Separare "banca domande" da "preparazione guidata"

Nel tab Domande d'esame:
- Blocco "Modalità di esercizio" con 4 pulsanti:
  - Domande mai viste (10 domande casuali)
  - Solo errori (10 domande con errori pregressi)
  - Mix del ruolo (20 domande casuali miste)
  - Mini-esame del ruolo (20 domande, risultato solo alla fine)
- Separatore visivo "Banca domande"
- Filtri esistenti mantenuti sotto

---

## ✅ Task 8 — Creare "Mini-esame del ruolo"

- Pulsante "Mini-esame del ruolo" con badge "Consigliato" nelle modalità di esercizio
- 20 domande, formato misto, nessun feedback immediato (result-only at end)
- Riusa `startAreaQuiz` e `submitAreaQuiz`
- Flag `isMiniExam: true` per distinguere dal quiz normale

---

## ✅ Task 9 — Migliorare la sezione errori e lacune

Nuovo tab Errori:
- Statistiche: affrontate, corrette, errori, accuratezza
- CTA "Ripeti errori" quando ci sono errori
- Stato vuoto positivo ("Nessun errore!") quando tutto corretto
- Stato incoraggiante quando nessuna domanda ancora affrontata
- Collegamento argomenti con link alle domande filtrate

---

## ✅ Task 10 — Aggiungere call-to-action post teoria

In `StudyTopic.jsx` dopo il contenuto markdown:
- "Prossimo argomento" con titolo del notebook successivo
- "Domande sul ruolo" con link all'area
- "Torna al ruolo" con navigazione indietro
- Design coerente con card e icone

---

## ✅ Task 11 — Aggiornare testi e traduzioni UX studio

Tutte le nuove chiavi aggiunte a tutti e 4 i locale file:
- `study.*`: ~40 nuove chiavi (exerciseModes, unseenQuestions, errorsAndGaps, ecc.)
- `nav.examSimulation`: aggiunto
- `common.*`: chiavi esistenti riutilizzate (free, premium)
- File JSON validati con `JSON.parse`
- Rimosso duplicato `accuracy` in it.json e de.json

---

## File modificati

| File | Modifiche |
|------|-----------|
| `src/components/UserLayout.jsx` | Aggiunta voce nav simulazione esame (sidebar + mobile) |
| `src/pages/Home.jsx` | Badge "Simulazione d'esame" nell'header |
| `src/pages/Study.jsx` | Card ruoli migliorate, conteggio teoria, CTA |
| `src/pages/StudyArea.jsx` | 5 nuovi tab, teoria migliorata, modalità esercizio, errori |
| `src/pages/StudyTopic.jsx` | ReadStatusBadge, CTA post-contenuto |
| `src/locales/it.json` | ~50 nuove chiavi, rimosso duplicato |
| `src/locales/en.json` | ~50 nuove chiavi |
| `src/locales/fr.json` | ~50 nuove chiavi |
| `src/locales/de.json` | ~50 nuove chiavi, rimosso duplicato |
