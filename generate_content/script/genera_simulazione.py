#!/usr/bin/env python3
"""
Genera un test di simulazione da esame_fph_100_domande.json
Uso: python3 genera_simulazione.py
"""

import json
import os
import glob
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TESTS_DIR = os.path.join(BASE_DIR, "src", "data", "tests")

# Cerca automaticamente il file esame più recente (ordina per nome file, non per path)
_all_candidates = (
    glob.glob(os.path.join(BASE_DIR, "esame_fph_*.json")) +
    glob.glob(os.path.join(BASE_DIR, "*/exams/esame_fph_*.json"))
)
_candidates = sorted(_all_candidates, key=os.path.basename, reverse=True)
SOURCE_FILE = _candidates[0] if _candidates else os.path.join(BASE_DIR, "esame_fph_100_domande.json")
TIMER_MINUTI = 210  # 3 ore e mezza


def main():
    if not os.path.exists(SOURCE_FILE):
        print(f"File non trovato: {SOURCE_FILE}")
        return

    with open(SOURCE_FILE, encoding="utf-8") as f:
        raw = json.load(f)

    domande = raw.get("domande", raw.get("questions", raw if isinstance(raw, list) else []))

    # Assegna ID progressivi
    for i, q in enumerate(domande):
        q["id"] = f"q{i + 1}"

    now = datetime.now()
    test_id = f"simulazione-{now.strftime('%Y%m%d-%H%M')}"
    title = f"Simulazione Esame – {now.strftime('%d/%m/%Y %H:%M')}"

    test = {
        "id": test_id,
        "title": title,
        "area": 4,
        "timer": TIMER_MINUTI,
        "questions": domande,
    }

    # Le vecchie simulazioni vengono mantenute

    os.makedirs(TESTS_DIR, exist_ok=True)
    out_path = os.path.join(TESTS_DIR, f"{test_id}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(test, f, ensure_ascii=False, indent=2)

    print(f"Test creato:  {os.path.basename(out_path)}")
    print(f"Titolo:       {title}")
    print(f"Domande:      {len(domande)}")
    print(f"Timer:        {TIMER_MINUTI} min ({TIMER_MINUTI // 60}h {TIMER_MINUTI % 60}min)")
    print("\nOra esegui:")
    print('  git add src/data/tests/ && git commit -m "feat: nuova simulazione" && git push')


if __name__ == "__main__":
    main()
