"""
Einmalige Migration der Legacy-JSON-Dateien in die SQL-Datenbank.

Liest die alten Dateien (produkte.json, users.json, rezepte.json,
ai_config.json, config.json) aus dem Projektverzeichnis und schreibt sie in
die in der .env konfigurierte Datenbank. Klartext-Passwörter werden dabei
gehasht (Werkzeug/PBKDF2 bzw. scrypt).

Aufruf (mit aktivierter venv, .env gesetzt):
    python migrate_json_to_db.py            # in DB schreiben
    python migrate_json_to_db.py --dry-run  # nur anzeigen, was passieren würde

Die Migration ist idempotent: bereits gehashte Passwörter werden nicht erneut
gehasht, und Datensätze werden vollständig ersetzt (kein doppeltes Anlegen).
"""
import json
import os
import sys

from werkzeug.security import generate_password_hash

import settings as cfg
from storage import Storage

BASE = os.path.dirname(os.path.abspath(__file__))
# Quelle der Legacy-JSON-Dateien (für Tests überschreibbar)
SRC = os.environ.get("MIGRATE_SOURCE_DIR", BASE)

_HASH_METHODS = ("pbkdf2", "scrypt", "argon2")


def _read_json(name, default):
    path = os.path.join(SRC, name)
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data
        except Exception as e:  # noqa: BLE001
            print(f"  ! {name} unlesbar ({e}), nutze Default")
    return default


def _looks_hashed(value):
    return (
        isinstance(value, str)
        and value
        and value.split("$")[0].split(":")[0] in _HASH_METHODS
    )


def _normalize_users(raw):
    """Bringt beliebige Legacy-User-Strukturen auf {"password_hash", "diet"}."""
    users = {}
    for uname, udata in (raw or {}).items():
        if isinstance(udata, str):
            pw_plain = udata
            diet = ""
            already = _looks_hashed(udata)
            pw_hash = udata if already else generate_password_hash(pw_plain)
        elif isinstance(udata, dict):
            diet = udata.get("diet", "")
            if "password_hash" in udata and udata["password_hash"]:
                pw_hash = udata["password_hash"]
            else:
                pw = udata.get("password", "")
                pw_hash = pw if _looks_hashed(pw) else generate_password_hash(pw)
        else:
            continue
        users[uname] = {"password_hash": pw_hash, "diet": diet}
    return users


def main():
    dry_run = "--dry-run" in sys.argv

    print("=== SmartFridge JSON -> SQL Migration ===")
    print(f"Backend     : {cfg.STORAGE_BACKEND}")
    print(f"DATABASE_URL: {cfg.DATABASE_URL.split('@')[-1]}")  # ohne Zugangsdaten
    print(f"Modus       : {'DRY-RUN (keine Schreibvorgänge)' if dry_run else 'SCHREIBEN'}")
    print()

    # 1) Legacy-Daten einlesen
    raw_users = _read_json("users.json", {})
    users = _normalize_users(raw_users)
    if not users:
        # Kein users.json -> Standard-Admin (gehasht)
        users = {"admin": {"password_hash": generate_password_hash("admin"), "diet": ""}}
        print("  i Kein users.json gefunden -> Standard-Admin (admin/admin) angelegt")

    produkte = _read_json("produkte.json", {})
    rezepte = _read_json("rezepte.json", {})

    # Benutzer, die nur in produkte/rezepte vorkommen, als gesperrte Konten anlegen
    # (leerer Hash = Login gesperrt, bis ein Passwort gesetzt wird) - so gehen keine
    # Produkte/Rezepte verloren, weil die Storage-Schicht unbekannte Benutzer überspringt.
    derived = set(produkte.keys()) | set(rezepte.keys())
    for uname in derived:
        if uname not in users:
            users[uname] = {"password_hash": "", "diet": ""}
            print(f"  i Benutzer '{uname}' aus Daten abgeleitet (gesperrt, Passwort-Reset nötig)")

    ai_config = _read_json("ai_config.json", {})
    if not isinstance(ai_config, dict):
        ai_config = {}
    # Falls Gemini-Key fehlt, aus .env/config nachziehen
    if not ai_config.get("gemini_api_key") and cfg.GEMINI_API_KEY and cfg.GEMINI_API_KEY not in (
        "HIER_DEINEN_API_KEY_EINTRAGEN", "Dein_API_Key"
    ):
        ai_config["gemini_api_key"] = cfg.GEMINI_API_KEY

    api_config = _read_json("config.json", {})
    if not isinstance(api_config, dict):
        api_config = {}
    if not api_config.get("api_key") and cfg.EXTERNAL_API_KEY:
        api_config["api_key"] = cfg.EXTERNAL_API_KEY

    # 2) Übersicht
    print("Gefundene Daten:")
    print(f"  users     : {len(users)} ({', '.join(users.keys())})")
    print(f"  produkte  : {sum(len(v) for v in produkte.values())} Produkte / {len(produkte)} Benutzer")
    print(f"  rezepte   : {sum(len(v) for v in rezepte.values())} Rezepte / {len(rezepte)} Benutzer")
    print(f"  ai_config : {'vorhanden' if ai_config else 'leer'} (provider={ai_config.get('provider', '-')})")
    print(f"  api_config: {'api_key gesetzt' if api_config.get('api_key') else 'leer'}")
    print()

    if dry_run:
        print("DRY-RUN beendet - es wurde nichts geschrieben.")
        return 0

    # 3) In DB schreiben (Backend hart auf mariadb -> Fehler, falls DB weg)
    store = Storage(backend="mariadb")

    # Sicherheits-Check: nicht über bereits vorhandene (evtl. neuere) DB-Daten bügeln.
    # Ein versehentlicher zweiter Lauf würde sonst nach der Migration hinzugefügte
    # Produkte/Rezepte mit dem alten JSON-Stand überschreiben.
    force = "--force" in sys.argv
    if not force:
        existing_u = store.load_users()
        existing_p = store.load_produkte()
        existing_r = store.load_rezepte()
        if existing_u or existing_p or existing_r:
            print("[ABBRUCH] Die Datenbank enthält bereits Daten "
                  f"({len(existing_u)} Benutzer, "
                  f"{sum(len(v) for v in existing_p.values())} Produkte, "
                  f"{sum(len(v) for v in existing_r.values())} Rezepte).")
            print("          Migration übersprungen, um Datenverlust zu vermeiden.")
            print("          Mit '--force' kann das Überschreiben erzwungen werden.")
            return 2

    store.save_users(users)        # upsert-only, löscht nie -> idempotent
    store.save_produkte(produkte)
    store.save_rezepte(rezepte)
    if ai_config:
        store.save_ai_config(ai_config)
    if api_config.get("api_key"):
        store.save_api_config(api_config)

    # 4) JSON-Spiegel der Nutzdaten anlegen, damit ein degradierter Start
    #    (DB kurz nicht erreichbar) echte Daten kennt statt leer zu starten.
    store.write_mirror("users", users)
    store.write_mirror("produkte", produkte)
    store.write_mirror("rezepte", rezepte)

    print("[OK] Migration abgeschlossen. Daten liegen jetzt in der SQL-Datenbank.")
    print("     Passwoerter sind gehasht; Klartext-JSON wird nicht mehr benoetigt.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
