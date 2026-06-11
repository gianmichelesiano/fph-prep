#!/usr/bin/env python3
"""
genera_esame.py — Generatore automatico di esami FPH in JSON
============================================================
Uso:
    python genera_esame.py                          # usa config_esame.json nella stessa cartella
    python genera_esame.py --config altro.json      # usa un config diverso
    python genera_esame.py --ruolo 4a               # genera solo il batch ruolo4a
    python genera_esame.py --solo-assembla          # assembla i file esistenti senza rigenarare

Requisiti:
    - venv attivato con notebooklm installato
    - notebooklm accessibile nel PATH
"""

import json
import os
import re
import subprocess
import sys
import time
import argparse
from datetime import datetime
from pathlib import Path


# ─────────────────────────────────────────────
# TEMPLATE DEL PROMPT  (personalizzabile)
# ─────────────────────────────────────────────
PROMPT_TEMPLATE = """Sei un esaminatore FPH svizzero. Crea {n_domande} domande d'esame in {lingua} per farmacisti specialisti, sul tema: {argomento}.

Le domande devono testare competenze pratiche secondo gli obiettivi FPH: scenari reali al banco, anamnesi e triage, validazione prescrizioni, identificazione errori di dosaggio e interazioni, rapporto beneficio-rischio, counselling al paziente, riferimenti a linee guida svizzere.

Usa il formato JSON seguente:
[
  {{
    "ruolo": {ruolo},
    "tema": "{nome_ruolo} - {argomento_breve}",
    "tipo": "multipla_scelta",
    "domanda": "...",
    "opzioni": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
    "risposta_corretta": "A",
    "motivazione": "..."
  }}
]

Regole:
- Alterna tra "multipla_scelta" e "kprim" (circa 50/50)
- Per multipla_scelta: 4 opzioni A/B/C/D, una sola corretta
- Per kprim: usa opzioni 1/2/3/4 (non A/B/C/D), risposta_corretta come stringa di 4 caratteri V/F (es. "VVFV")
- Basa le domande su scenari REALI di farmacia: pazienti al banco, prescrizioni, consulenze
- Includi riferimenti a linee guida svizzere/europee quando pertinente
- Le motivazioni devono spiegare il perché della risposta corretta e perché le altre sono sbagliate

Rispondi SOLO con l'array JSON, senza testo prima o dopo."""


# ─────────────────────────────────────────────
# FUNZIONI UTILITARIE
# ─────────────────────────────────────────────

DAILY_LIMIT = 9999        # nessun limite (piano a pagamento)
_query_count = 0          # contatore globale query usate in questa sessione


def log(msg, level="INFO"):
    timestamp = datetime.now().strftime("%H:%M:%S")
    symbols = {"INFO": "ℹ️ ", "OK": "✅", "WARN": "⚠️ ", "ERROR": "❌", "RUN": "🔄"}
    print(f"[{timestamp}] {symbols.get(level, '')} {msg}")


def clean_control_chars_in_strings(json_str):
    """Sostituisce/rimuove caratteri di controllo che si trovano DENTRO le stringhe JSON.
    I newline/tab strutturali (fuori dalle stringhe) vengono preservati."""
    result = []
    in_string = False
    escape_next = False
    for char in json_str:
        if escape_next:
            result.append(char)
            escape_next = False
            continue
        if char == '\\' and in_string:
            result.append(char)
            escape_next = True
            continue
        if char == '"':
            in_string = not in_string
            result.append(char)
            continue
        if in_string:
            code = ord(char)
            if code < 0x20:  # carattere di controllo dentro una stringa → invalido in JSON
                if char == '\n':
                    result.append('\\n')
                elif char == '\r':
                    result.append('\\r')
                elif char == '\t':
                    result.append('\\t')
                # altri controlli (<0x20 esclusi \t\n\r) → rimossi
            else:
                result.append(char)
        else:
            result.append(char)
    return ''.join(result)


def extract_json_array(text):
    """Estrae un array JSON dal testo, ignorando testo extra prima/dopo."""
    start = text.find('[')
    end = text.rfind(']')
    if start == -1 or end == -1:
        return None
    json_str = text[start:end + 1]
    # Tentativo 1: parse diretto
    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        first_error = e
    # Tentativo 2: regex veloce per controlli C0 (esclude \t \n \r)
    json_str_clean = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', json_str)
    try:
        return json.loads(json_str_clean)
    except json.JSONDecodeError:
        pass
    # Tentativo 3: parser char-by-char — gestisce \n/\r DENTRO le stringhe
    try:
        json_str_clean2 = clean_control_chars_in_strings(json_str)
        return json.loads(json_str_clean2)
    except json.JSONDecodeError:
        pass
    raise ValueError(f"JSON non valido: {first_error}")


def fix_kprim_keys(questions):
    """Converte le opzioni kprim da A/B/C/D a 1/2/3/4 se necessario."""
    for q in questions:
        if q.get("tipo") == "kprim":
            opzioni = q.get("opzioni", {})
            if "A" in opzioni or "B" in opzioni:
                key_map = {"A": "1", "B": "2", "C": "3", "D": "4"}
                q["opzioni"] = {key_map.get(k, k): v for k, v in opzioni.items()}
    return questions


def validate_questions(questions, batch_id):
    """Valida la struttura delle domande. Restituisce (ok, errori)."""
    errors = []
    for i, q in enumerate(questions):
        n = q.get("numero", i + 1)
        label = f"[{batch_id} Q{n}]"

        for field in ["ruolo", "tema", "tipo", "domanda", "opzioni", "risposta_corretta", "motivazione"]:
            if field not in q:
                errors.append(f"{label}: campo mancante '{field}'")

        tipo = q.get("tipo")
        opzioni = q.get("opzioni", {})
        rc = q.get("risposta_corretta", "")

        if tipo == "multipla_scelta":
            if not all(k in opzioni for k in ["A", "B", "C", "D"]):
                errors.append(f"{label}: multipla_scelta deve avere opzioni A,B,C,D (trovato: {list(opzioni.keys())})")
            if rc not in ["A", "B", "C", "D"]:
                errors.append(f"{label}: risposta_corretta '{rc}' non valida per multipla_scelta")
        elif tipo == "kprim":
            if not all(k in opzioni for k in ["1", "2", "3", "4"]):
                errors.append(f"{label}: kprim deve avere opzioni 1,2,3,4 (trovato: {list(opzioni.keys())})")
            if len(rc) != 4 or not all(c in "VF" for c in rc):
                errors.append(f"{label}: risposta_corretta '{rc}' non valida per kprim (deve essere 4 caratteri V/F)")
        else:
            errors.append(f"{label}: tipo '{tipo}' non riconosciuto")

    return len(errors) == 0, errors


def call_notebooklm(prompt, notebook_id, max_retries=2):
    """Chiama notebooklm ask e restituisce la risposta testuale.
    max_retries=2 → max 2 query per batch (budget: 50/giorno, 13 batch = 26 query worst-case).
    """
    global _query_count
    cmd = ["notebooklm", "ask", prompt, "--notebook", notebook_id]

    # Pulisce la conversazione precedente per evitare che riprenda da una sessione appesa
    subprocess.run(["notebooklm", "clear"], capture_output=True)

    for attempt in range(1, max_retries + 1):
        _query_count += 1
        remaining = DAILY_LIMIT - _query_count
        log(f"Query #{_query_count}/{DAILY_LIMIT} (rimaste oggi: ~{remaining})", "INFO")

        if _query_count > DAILY_LIMIT:
            raise RuntimeError(f"Limite giornaliero di {DAILY_LIMIT} query raggiunto. Riprova domani.")

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=180  # 3 minuti max per query
            )
            output = result.stdout.strip()

            # Rileva rate limit nel testo di risposta (non è un'eccezione, è stdout)
            if "rate limit" in output.lower() or "rate limited" in output.lower():
                wait_time = 60 * attempt  # 60s, 120s
                log(f"Rate limit rilevato (tentativo {attempt}/{max_retries}). Attendo {wait_time}s...", "WARN")
                time.sleep(wait_time)
                if attempt < max_retries:
                    continue
                else:
                    raise RuntimeError(f"Rate limit persistente dopo {max_retries} tentativi")

            if result.returncode != 0 and not output:
                raise RuntimeError(f"notebooklm errore (exit {result.returncode}): {result.stderr[:200]}")
            return output
        except subprocess.TimeoutExpired:
            log(f"Timeout alla query (tentativo {attempt}/{max_retries})", "WARN")
            if attempt < max_retries:
                time.sleep(10)
        except Exception as e:
            log(f"Errore chiamata notebooklm (tentativo {attempt}/{max_retries}): {e}", "WARN")
            if attempt < max_retries:
                time.sleep(10)

    raise RuntimeError(f"Impossibile completare la query dopo {max_retries} tentativi")


# ─────────────────────────────────────────────
# CORE: genera un singolo batch
# ─────────────────────────────────────────────

def genera_batch(batch, ruolo_info, lingua, output_dir):
    """Genera e salva le domande per un singolo batch."""
    batch_id = batch["id"]
    notebook_id = batch["notebook"]
    n_domande = batch["n_domande"]
    argomento = batch["argomento"]
    ruolo_num = ruolo_info["ruolo"]
    nome_ruolo = ruolo_info["nome"]

    # Argomento breve per il campo "tema" (prime 3 parole)
    argomento_breve = " ".join(argomento.split(",")[0].split()[:5])

    output_path = os.path.join(output_dir, "roles", f"{batch_id}.json")

    log(f"Generando '{batch_id}' ({n_domande} domande) → notebook {notebook_id[:8]}...", "RUN")

    # Costruisce il prompt
    prompt = PROMPT_TEMPLATE.format(
        n_domande=n_domande,
        lingua=lingua,
        argomento=argomento,
        ruolo=ruolo_num,
        nome_ruolo=nome_ruolo,
        argomento_breve=argomento_breve
    )

    # Chiama NotebookLM (con retry se il JSON è malformato)
    questions = None
    for json_attempt in range(1, 4):  # max 3 tentativi per JSON invalido
        raw_output = call_notebooklm(prompt, notebook_id)
        try:
            questions = extract_json_array(raw_output)
            if questions:
                break
            log(f"Risposta vuota (tentativo JSON {json_attempt}/3)", "WARN")
        except ValueError as e:
            log(f"JSON non valido (tentativo JSON {json_attempt}/3): {e}", "WARN")
            if json_attempt < 3:
                log("Ritento la query...", "INFO")
                time.sleep(10)

    if not questions:
        preview = raw_output[:400].replace('\n', ' ') if raw_output else "(risposta vuota)"
        log(f"Risposta raw ricevuta: {preview}", "WARN")
        raise ValueError(f"JSON non valido dopo 3 tentativi per {batch_id}")

    # Corregge chiavi kprim se necessario
    questions = fix_kprim_keys(questions)

    # Valida
    ok, errors = validate_questions(questions, batch_id)
    if not ok:
        log(f"{len(errors)} problemi di validazione in '{batch_id}':", "WARN")
        for e in errors[:5]:
            log(f"  → {e}", "WARN")

    # Salva il batch
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)

    log(f"Salvato: {output_path} ({len(questions)} domande)", "OK")
    return questions


# ─────────────────────────────────────────────
# CORE: assembla il file finale
# ─────────────────────────────────────────────

def assembla_esame(config, output_dir):
    """Assembla tutti i batch in un unico file JSON."""
    log("Assemblando il file finale...", "RUN")

    all_questions = []
    question_num = 1
    missing = []

    for ruolo_info in config["ruoli"]:
        for batch in ruolo_info["batches"]:
            batch_id = batch["id"]
            path = os.path.join(output_dir, "roles", f"{batch_id}.json")

            if not os.path.exists(path):
                missing.append(batch_id)
                log(f"File mancante: {path}", "WARN")
                continue

            with open(path, encoding='utf-8') as f:
                questions = json.load(f)

            for q in questions:
                q["numero"] = question_num
                all_questions.append(q)
                question_num += 1

    if missing:
        log(f"Batch mancanti: {missing}. Il file finale sarà incompleto.", "WARN")

    # Distribuzione per ruolo
    from collections import Counter
    ruoli_count = Counter(q['ruolo'] for q in all_questions)
    tipi_count = Counter(q['tipo'] for q in all_questions)

    # Struttura finale
    esame_config = config["esame"]
    final = {
        "esame": esame_config["nome"],
        "versione": esame_config["versione"],
        "data_creazione": datetime.now().strftime("%Y-%m-%d"),
        "totale_domande": len(all_questions),
        "soglia_superamento": esame_config["soglia_superamento"],
        "distribuzione_ruoli": {f"ruolo_{r}": c for r, c in sorted(ruoli_count.items())},
        "distribuzione_tipi": dict(tipi_count),
        "aree_tematiche": {
            f"ruolo_{r['ruolo']}": f"{r['nome']} ({sum(b['n_domande'] for b in r['batches'])} domande)"
            for r in config["ruoli"]
        },
        "domande": all_questions
    }

    # Salva nella cartella exams/
    exams_dir = os.path.join(output_dir, "exams")
    os.makedirs(exams_dir, exist_ok=True)
    output_name = f"esame_fph_{datetime.now().strftime('%Y-%m-%d_%H%M')}.json"
    output_path = os.path.join(exams_dir, output_name)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(final, f, ensure_ascii=False, indent=2)

    log(f"File finale: {output_path}", "OK")
    log(f"Totale domande: {len(all_questions)} | multipla_scelta: {tipi_count.get('multipla_scelta',0)} | kprim: {tipi_count.get('kprim',0)}", "OK")

    # Elimina i file intermedi della cartella roles/
    roles_dir = os.path.join(output_dir, "roles")
    deleted = []
    for ruolo_info in config["ruoli"]:
        for batch in ruolo_info["batches"]:
            path = os.path.join(roles_dir, f"{batch['id']}.json")
            if os.path.exists(path):
                os.remove(path)
                deleted.append(batch["id"])
    if deleted:
        log(f"File intermedi eliminati ({len(deleted)}): {', '.join(deleted)}", "OK")
    # Rimuove la cartella roles/ se è rimasta vuota
    try:
        os.rmdir(roles_dir)
        log(f"Cartella roles/ rimossa (vuota)", "OK")
    except OSError:
        pass  # non vuota, nessun problema

    return output_path


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Genera un esame FPH in JSON da NotebookLM")
    parser.add_argument("--config", default=None, help="Path al file config JSON (default: config_esame.json nella stessa cartella)")
    parser.add_argument("--ruolo", default=None, help="Genera solo un batch specifico (es: ruolo4a, ruolo1)")
    parser.add_argument("--solo-assembla", action="store_true", help="Non genera, assembla solo i file esistenti")
    args = parser.parse_args()

    # ── Trova il config ──
    script_dir = Path(__file__).parent
    config_path = args.config or script_dir / "config_esame.json"

    if not os.path.exists(config_path):
        log(f"Config non trovato: {config_path}", "ERROR")
        sys.exit(1)

    with open(config_path, encoding='utf-8') as f:
        config = json.load(f)

    esame_cfg = config["esame"]
    lingua = esame_cfg.get("lingua", "italiano")
    output_dir = script_dir / esame_cfg.get("output_dir", "fph-exam-nuovo")
    os.makedirs(output_dir / "roles", exist_ok=True)

    log(f"Esame: {esame_cfg['nome']}", "INFO")
    log(f"Output: {output_dir}", "INFO")

    # ── Solo assembla ──
    if args.solo_assembla:
        assembla_esame(config, output_dir)
        return

    # ── Raccoglie i batch da generare ──
    batches_to_run = []
    for ruolo_info in config["ruoli"]:
        for batch in ruolo_info["batches"]:
            if args.ruolo is None or batch["id"] == args.ruolo:
                batches_to_run.append((batch, ruolo_info))

    if not batches_to_run:
        log(f"Nessun batch trovato per --ruolo '{args.ruolo}'", "ERROR")
        sys.exit(1)

    total_batches = len(batches_to_run)
    total_domande = sum(b["n_domande"] for b, _ in batches_to_run)
    log(f"Batch da generare: {total_batches} | Domande totali: {total_domande}", "INFO")
    log("Tempo stimato: ~40-60 secondi per batch", "INFO")
    print()

    # ── Genera ogni batch ──
    failed = []
    for i, (batch, ruolo_info) in enumerate(batches_to_run, 1):
        log(f"── Batch {i}/{total_batches}: {batch['id']} ──", "INFO")
        try:
            genera_batch(batch, ruolo_info, lingua, output_dir)
            if i < total_batches:
                log(f"Pausa 90s prima del prossimo batch...", "INFO")
                time.sleep(30)  # pausa anti-rate-limit tra batch
        except Exception as e:
            log(f"ERRORE nel batch '{batch['id']}': {e}", "ERROR")
            failed.append(batch["id"])

    print()
    if failed:
        log(f"Batch falliti ({len(failed)}): {failed}", "WARN")
        log("Puoi ritentarli con: python genera_esame.py --ruolo <id>", "INFO")

    # ── Assembla ──
    if not args.ruolo:  # assembla solo se era una generazione completa
        assembla_esame(config, output_dir)

    # ── Riepilogo finale ──
    print()
    log("═" * 50, "INFO")
    if failed:
        log(f"Completato con {len(failed)} errori. Vedi sopra.", "WARN")
    else:
        log("Completato con successo! ✨", "OK")


if __name__ == "__main__":
    main()
