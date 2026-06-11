#!/usr/bin/env python3
"""
run_pipeline.py — Pipeline completa: genera batch → assembla → crea simulazione
================================================================================
Uso:
    python run_pipeline.py --config config_tematico.json          # tutto il pipeline
    python run_pipeline.py --config config_tematico.json --tema vaccini  # solo un tema
    python run_pipeline.py --config config_tematico.json --solo-assembla # assembla + sim

Config semplificato (vedi config_tematico.json per esempio):
    {
      "nome": "Test Tematico",
      "output_dir": "test-tematico",
      "temi": [
        { "notebook": "vaccini",   "n_domande": 7 },
        { "notebook": "diabete",   "n_domande": 8 }
      ]
    }

I notebook IDs sono in notebooks.yaml — modificalo per aggiungere nuovi notebook.
"""

import json
import os
import sys
import time
import argparse
import subprocess
from datetime import datetime
from pathlib import Path

# ── Import da genera_esame ──────────────────────────────
_BASE = Path(__file__).parent
sys.path.insert(0, str(_BASE))
from genera_esame import genera_batch, log, DAILY_LIMIT

NOTEBOOKS_FILE = _BASE / "notebooks.yaml"


# ─────────────────────────────────────────────
# CARICA NOTEBOOKS.YAML
# ─────────────────────────────────────────────

def load_notebooks():
    try:
        import yaml
    except ImportError:
        log("PyYAML non trovato. Installa con: pip install pyyaml", "ERROR")
        sys.exit(1)

    if not NOTEBOOKS_FILE.exists():
        log(f"File non trovato: {NOTEBOOKS_FILE}", "ERROR")
        sys.exit(1)

    with open(NOTEBOOKS_FILE, encoding='utf-8') as f:
        return yaml.safe_load(f)


# ─────────────────────────────────────────────
# RISOLVE CONFIG SEMPLIFICATO → FORMATO INTERNO
# ─────────────────────────────────────────────

def resolve_config(config_raw, notebooks):
    """Converte il config semplificato nel formato interno usato da genera_batch."""
    ruoli = []
    for i, tema in enumerate(config_raw["temi"], 1):
        nb_key = tema["notebook"]

        if nb_key not in notebooks:
            log(f"Notebook '{nb_key}' non trovato in notebooks.yaml. Chiavi disponibili: {', '.join(notebooks.keys())}", "ERROR")
            sys.exit(1)

        nb = notebooks[nb_key]
        argomento = tema.get("argomento") or nb.get("argomento", nb_key)

        ruoli.append({
            "ruolo": i,
            "nome": nb.get("nome", nb_key),
            "batches": [{
                "id": nb_key,
                "notebook": nb["id"],
                "n_domande": tema["n_domande"],
                "argomento": argomento
            }]
        })

    return ruoli


# ─────────────────────────────────────────────
# ASSEMBLA (adattato per config semplificato)
# ─────────────────────────────────────────────

def assembla(config_raw, ruoli, output_dir):
    from collections import Counter

    log("Assemblando il file finale...", "RUN")

    all_questions = []
    question_num = 1
    missing = []

    for ruolo_info in ruoli:
        for batch in ruolo_info["batches"]:
            path = output_dir / "roles" / f"{batch['id']}.json"
            if not path.exists():
                missing.append(batch["id"])
                log(f"File mancante: {path}", "WARN")
                continue
            with open(path, encoding='utf-8') as f:
                questions = json.load(f)
            for q in questions:
                q["numero"] = question_num
                all_questions.append(q)
                question_num += 1

    if missing:
        log(f"Batch mancanti: {missing}. Rigenera con --tema <id>", "WARN")

    ruoli_count = Counter(q['ruolo'] for q in all_questions)
    tipi_count = Counter(q['tipo'] for q in all_questions)

    final = {
        "esame": config_raw["nome"],
        "versione": config_raw.get("versione", "1.0"),
        "data_creazione": datetime.now().strftime("%Y-%m-%d"),
        "totale_domande": len(all_questions),
        "soglia_superamento": config_raw.get("soglia_superamento", 67),
        "distribuzione_ruoli": {f"ruolo_{r}": c for r, c in sorted(ruoli_count.items())},
        "distribuzione_tipi": dict(tipi_count),
        "domande": all_questions
    }

    exams_dir = output_dir / "exams"
    exams_dir.mkdir(parents=True, exist_ok=True)
    output_name = f"esame_fph_{datetime.now().strftime('%Y-%m-%d_%H%M')}.json"
    output_path = exams_dir / output_name

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(final, f, ensure_ascii=False, indent=2)

    log(f"File finale: {output_path}", "OK")
    log(f"Totale: {len(all_questions)} domande | multipla_scelta: {tipi_count.get('multipla_scelta', 0)} | kprim: {tipi_count.get('kprim', 0)}", "OK")

    # Elimina file intermedi
    roles_dir = output_dir / "roles"
    for ruolo_info in ruoli:
        for batch in ruolo_info["batches"]:
            p = roles_dir / f"{batch['id']}.json"
            if p.exists():
                p.unlink()
    try:
        roles_dir.rmdir()
    except OSError:
        pass

    return output_path


# ─────────────────────────────────────────────
# GENERA SIMULAZIONE
# ─────────────────────────────────────────────

def run_simulazione():
    script = _BASE / "genera_simulazione.py"
    log("Generando simulazione...", "RUN")
    result = subprocess.run([sys.executable, str(script)], capture_output=False)
    if result.returncode != 0:
        log("Errore nella generazione della simulazione", "ERROR")


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Pipeline FPH: genera → assembla → simulazione")
    parser.add_argument("--config", required=True, help="Path al config JSON semplificato")
    parser.add_argument("--tema", default=None, help="Genera solo un tema specifico (es: vaccini)")
    parser.add_argument("--solo-assembla", action="store_true", help="Assembla + simulazione senza rigenerare")
    args = parser.parse_args()

    config_path = Path(args.config)
    if not config_path.exists():
        log(f"Config non trovato: {config_path}", "ERROR")
        sys.exit(1)

    with open(config_path, encoding='utf-8') as f:
        config_raw = json.load(f)

    notebooks = load_notebooks()
    ruoli = resolve_config(config_raw, notebooks)
    lingua = config_raw.get("lingua", "italiano")
    output_dir = _BASE / config_raw.get("output_dir", "output")
    (output_dir / "roles").mkdir(parents=True, exist_ok=True)

    log(f"Esame: {config_raw['nome']}", "INFO")
    log(f"Output: {output_dir}", "INFO")

    # ── Solo assembla ──
    if args.solo_assembla:
        assembla(config_raw, ruoli, output_dir)
        run_simulazione()
        return

    # ── Raccoglie batch da generare ──
    batches_to_run = []
    for ruolo_info in ruoli:
        for batch in ruolo_info["batches"]:
            if args.tema is None or batch["id"] == args.tema:
                batches_to_run.append((batch, ruolo_info))

    if not batches_to_run:
        log(f"Tema '{args.tema}' non trovato nel config", "ERROR")
        sys.exit(1)

    log(f"Temi da generare: {len(batches_to_run)} | Domande totali: {sum(b['n_domande'] for b, _ in batches_to_run)}", "INFO")
    print()

    # ── Genera ogni batch ──
    failed = []
    for i, (batch, ruolo_info) in enumerate(batches_to_run, 1):
        batch_path = output_dir / "roles" / f"{batch['id']}.json"

        if batch_path.exists():
            log(f"Batch '{batch['id']}' già presente — salto (elimina il file per rigenerare)", "OK")
            continue

        log(f"── Tema {i}/{len(batches_to_run)}: {batch['id']} ──", "INFO")
        try:
            genera_batch(batch, ruolo_info, lingua, output_dir)
            if i < len(batches_to_run):
                log("Pausa 20s prima del prossimo tema...", "INFO")
                time.sleep(20)
        except Exception as e:
            log(f"ERRORE '{batch['id']}': {e}", "ERROR")
            failed.append(batch["id"])

    print()
    if failed:
        log(f"Temi falliti: {failed}. Rilancia con: python run_pipeline.py --config {args.config} --tema <id>", "WARN")

    # ── Assembla + simulazione (solo se generazione completa) ──
    if args.tema is None:
        assembla(config_raw, ruoli, output_dir)
        run_simulazione()

    print()
    log("═" * 50, "INFO")
    if failed:
        log(f"Completato con {len(failed)} errori.", "WARN")
    else:
        log("Completato con successo!", "OK")


if __name__ == "__main__":
    main()
