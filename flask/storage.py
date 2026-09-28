"""
Speicher-Abstraktion für SmartFridge / KitchAI.

Ziele:
  * Primärspeicher ist eine echte SQL-Datenbank (MariaDB/MySQL via SQLAlchemy).
  * Keine Klartext-Geheimnisse mehr in JSON-Dateien (Passwörter werden gehasht
    gespeichert; API-Keys liegen NUR in der DB-Settings-Tabelle bzw. in der .env).
  * Robust gegen DB-Ausfälle, OHNE Datenverlust zu riskieren:
      - "auto"-Modus: DB primär; fällt die DB aus, wird auf JSON-Dateien
        ausgewichen (nur Nutzdaten, niemals Geheimnisse) und die in der
        Ausfallzeit geänderten Daten werden zurücksynchronisiert, sobald die DB
        wieder erreichbar ist.
      - Saves überschreiben NIE die ganze Tabelle: produkte/rezepte werden nur
        für die enthaltenen Benutzer ersetzt, users wird nur ge-upsertet
        (Löschen ausschließlich über delete_user()).
      - Beim Start wird ein Datenverlust-sicherer Check erzwungen
        (assert_safe_start): keine DB UND kein lokaler Spiegel -> Abbruch.

Die öffentliche Schnittstelle bildet die alte JSON-Struktur 1:1 ab
(dict pro Benutzername):

    load_produkte()/save_produkte(dict)
    load_users()/save_users(dict)        # dict-Werte: {"password_hash":..,"diet":..}
    delete_user(username)
    load_rezepte()/save_rezepte(dict)
    load_ai_config()/save_ai_config(dict)
    load_api_config()/save_api_config(dict)
"""
import json
import os
import threading
import time

from sqlalchemy import text
from sqlalchemy.exc import InterfaceError, OperationalError

import models
import settings as cfg

# Fehler, die wir als "DB ist gerade nicht erreichbar" interpretieren
_CONN_ERRORS = (OperationalError, InterfaceError)

# Nutzdaten -> als warmer JSON-Spiegel mitschreiben (enthalten KEINE Klartext-Geheimnisse)
_MIRROR_DATASETS = ("users", "produkte", "rezepte")
# Geheimnis-tragende Datensätze -> NIEMALS in eine Datei schreiben
_SECRET_DATASETS = ("ai_config", "api_config")
# Reihenfolge für Re-Sync (users zuerst, damit FK-Referenzen existieren)
_RESYNC_ORDER = ("users", "produkte", "rezepte", "ai_config", "api_config")


class Storage:
    def __init__(self, backend=None, database_url=None, data_dir=None, retry_interval=15):
        self.backend = (backend or cfg.STORAGE_BACKEND or "auto").lower()
        self.database_url = database_url or cfg.DATABASE_URL
        self.data_dir = data_dir or cfg.DATA_DIR
        self.retry_interval = retry_interval

        self.engine = None
        self.Session = None
        self.db_ok = False
        self._last_db_check = 0.0
        self._lock = threading.RLock()

        os.makedirs(self.data_dir, exist_ok=True)
        self._state_path = os.path.join(self.data_dir, ".storage_state.json")
        self.dirty = self._load_state()

        if self.backend != "json":
            self._init_engine()

    # ---------------- Engine / Health ----------------
    def _init_engine(self):
        try:
            self.engine = models.build_engine(self.database_url)
            self.Session = models.make_session_factory(self.engine)
            self._probe()
            if self.db_ok:
                models.create_all(self.engine)
                self._resync_if_needed()
        except Exception as e:  # noqa: BLE001 - Engine darf den Start nie hart verhindern
            self.db_ok = False
            self._log(f"DB-Init fehlgeschlagen: {e}")

    def _probe(self):
        """Prüft, ob die DB erreichbar ist (ohne zu werfen)."""
        if self.engine is None:
            self.db_ok = False
            return False
        try:
            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            self.db_ok = True
            return True
        except Exception:  # noqa: BLE001
            self.db_ok = False
            return False

    def _ensure_db(self):
        """True, wenn die DB jetzt nutzbar ist. Versucht (gedrosselt) Reconnect."""
        if self.backend == "json" or self.engine is None:
            return False
        with self._lock:
            if self.db_ok:
                return True
            now = time.time()
            if now - self._last_db_check < self.retry_interval:
                return False
            self._last_db_check = now
            if self._probe():
                models.create_all(self.engine)
                self._resync_if_needed()
                return True
        return False

    def is_degraded(self):
        """True, wenn auto-Modus aktiv ist, aber gerade auf JSON ausweicht."""
        return self.backend == "auto" and not self.db_ok

    def has_local_mirror(self):
        """True, wenn lokale Spiegel-Dateien existieren (Nutzdaten)."""
        return any(os.path.exists(self._json_path(n)) for n in _MIRROR_DATASETS)

    def assert_safe_start(self):
        """Verhindert einen Start, der zu Datenverlust führen könnte.

        Wenn ein DB-Backend gewünscht ist, die DB aber nicht erreichbar ist UND
        kein lokaler Spiegel existiert, kennt die App den echten Datenstand nicht
        und dürfte ihn beim ersten Save überschreiben -> lieber abbrechen.
        """
        if self.backend == "json":
            return
        if not self.db_ok and not self.has_local_mirror():
            raise SystemExit(
                "[storage] Start abgebrochen: Datenbank nicht erreichbar und kein "
                "lokaler Datenspiegel vorhanden. Bitte MariaDB starten "
                "(docker start kitchai-mariadb) und erneut versuchen, um "
                "Datenverlust zu vermeiden."
            )

    # ---------------- State (dirty flags) ----------------
    def _load_state(self):
        try:
            with open(self._state_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return set(data.get("dirty", []))
        except Exception:  # noqa: BLE001
            return set()

    def _save_state(self):
        try:
            with open(self._state_path, "w", encoding="utf-8") as f:
                json.dump({"dirty": sorted(self.dirty)}, f)
        except Exception as e:  # noqa: BLE001
            self._log(f"State konnte nicht gespeichert werden: {e}")

    def _mark_dirty(self, name):
        with self._lock:
            self.dirty.add(name)
            self._save_state()

    # ---------------- JSON-Dateien ----------------
    def _json_path(self, name):
        return os.path.join(self.data_dir, f"{name}.json")

    def _read_json(self, name, default):
        path = self._json_path(name)
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:  # noqa: BLE001
                self._log(f"JSON {name} unlesbar: {e}")
        return default

    def write_mirror(self, name, data):
        """Öffentlich: Spiegeldatei schreiben (z.B. nach der Migration)."""
        self._write_json(name, data)

    def _write_json(self, name, data):
        path = self._json_path(name)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, path)  # atomar

    # ---------------- generische load/save ----------------
    def _load(self, name, db_loader, default):
        if self._ensure_db():
            try:
                data = db_loader()
                if self.backend == "auto" and name in _MIRROR_DATASETS:
                    self._write_json(name, data)
                return data
            except _CONN_ERRORS as e:
                with self._lock:
                    self.db_ok = False
                self._log(f"DB-Lesefehler ({name}), Fallback auf JSON: {e}")
                if self.backend == "mariadb":
                    raise
        if self.backend == "mariadb":
            raise RuntimeError(f"MariaDB nicht erreichbar (Backend=mariadb), {name}")
        if name in _SECRET_DATASETS:
            # Geheimnisse werden nie aus Dateien gelesen
            return default
        return self._read_json(name, default)

    def _save(self, name, data, db_saver):
        if self._ensure_db():
            try:
                db_saver(data)
                if self.backend == "auto" and name in _MIRROR_DATASETS:
                    self._write_json(name, data)
                return
            except _CONN_ERRORS as e:
                with self._lock:
                    self.db_ok = False
                self._log(f"DB-Schreibfehler ({name}), Fallback: {e}")
                if self.backend == "mariadb":
                    raise
        if self.backend == "mariadb":
            raise RuntimeError(f"MariaDB nicht erreichbar (Backend=mariadb), {name}")
        if name in _SECRET_DATASETS:
            # Geheimnisse NIEMALS in eine Datei schreiben -> laut scheitern
            raise RuntimeError(
                f"Datenbank nicht erreichbar - '{name}' kann nicht gespeichert werden "
                "(Geheimnisse werden nicht in Dateien abgelegt)."
            )
        # Nutzdaten-Fallback (auto-Modus, DB down)
        with self._lock:
            self._write_json(name, data)
            self.dirty.add(name)
            self._save_state()

    # ---------------- Re-Sync JSON -> DB ----------------
    def _resync_if_needed(self):
        """Schreibt während eines DB-Ausfalls geänderte JSON-Daten zurück in die DB.

        Läuft immer unter self._lock (Aufrufer halten den Lock).
        """
        if not self.dirty:
            return
        pending = [n for n in _RESYNC_ORDER if n in self.dirty]
        pending += sorted(self.dirty - set(_RESYNC_ORDER))
        self._log(f"Re-Sync JSON -> DB für: {pending}")
        savers = {
            "users": self._db_save_users,
            "produkte": self._db_save_produkte,
            "rezepte": self._db_save_rezepte,
        }
        for name in pending:
            saver = savers.get(name)
            # Geheimnisse/unbekannte: kein Datei-Sync (nur DB)
            if saver is None:
                self.dirty.discard(name)
                continue
            path = self._json_path(name)
            if not os.path.exists(path):
                # Keine Datei -> nichts zu syncen (NICHT mit leerem dict überschreiben)
                self._log(f"Re-Sync übersprungen, Datei fehlt: {name}")
                self.dirty.discard(name)
                continue
            try:
                data = self._read_json(name, None)
                if data is None:
                    # Unlesbar -> NICHT überschreiben, dirty behalten, später erneut
                    self._log(f"Re-Sync {name}: Datei unlesbar, behalte dirty")
                    continue
                saver(data)
                self.dirty.discard(name)
            except _CONN_ERRORS as e:
                self._log(f"Re-Sync {name}: DB-Verbindung verloren: {e}")
                self.db_ok = False
                break
            except Exception as e:  # noqa: BLE001 - "poison" Datensatz nicht ewig wiederholen
                self._log(f"Re-Sync {name} fehlgeschlagen (übersprungen): {e}")
                self.dirty.discard(name)
        self._save_state()

    # ================= DB-Implementierungen =================
    def _db_load_users(self):
        with self.Session() as s:
            rows = s.query(models.User).all()
            return {
                u.username: {"password_hash": u.password_hash or "", "diet": u.diet or ""}
                for u in rows
            }

    def _db_save_users(self, data):
        """Upsert-only: legt an/aktualisiert, löscht aber NIE (siehe delete_user)."""
        with self.Session() as s:
            existing = {u.username: u for u in s.query(models.User).all()}
            for uname, udata in data.items():
                if isinstance(udata, dict):
                    pw = udata.get("password_hash", udata.get("password", ""))
                    diet = udata.get("diet", "")
                else:
                    pw, diet = str(udata), ""
                row = existing.get(uname)
                if row is None:
                    row = models.User(username=uname)
                    s.add(row)
                row.password_hash = pw or ""
                row.diet = diet or ""
            s.commit()

    def _known_usernames(self, s):
        return {u.username for u in s.query(models.User.username).all()}

    def _db_load_produkte(self):
        with self.Session() as s:
            rows = s.query(models.Product).order_by(
                models.Product.username, models.Product.position, models.Product.id
            ).all()
            out = {}
            for p in rows:
                out.setdefault(p.username, []).append({"name": p.name, "ablauf": p.ablauf})
            return out

    def _db_load_rezepte(self):
        with self.Session() as s:
            rows = s.query(models.Recipe).order_by(
                models.Recipe.username, models.Recipe.position, models.Recipe.id
            ).all()
            out = {}
            for r in rows:
                try:
                    recipe = json.loads(r.recipe_json) if r.recipe_json else {}
                except Exception:  # noqa: BLE001
                    recipe = {}
                out.setdefault(r.username, []).append({
                    "id": r.recipe_key,
                    "created_at": r.created_at,
                    "is_favorite": bool(r.is_favorite),
                    "recipe": recipe,
                })
            return out

    def _db_save_produkte(self, data):
        """Ersetzt Produkte NUR für die enthaltenen, existierenden Benutzer."""
        with self.Session() as s:
            known = self._known_usernames(s)
            usernames = [u for u in data.keys() if u in known]
            skipped = [u for u in data.keys() if u not in known]
            if skipped:
                self._log(f"save_produkte: unbekannte Benutzer übersprungen: {skipped}")
            if usernames:
                s.query(models.Product).filter(
                    models.Product.username.in_(usernames)
                ).delete(synchronize_session=False)
                for uname in usernames:
                    for idx, item in enumerate(data.get(uname) or []):
                        item = item or {}
                        s.add(models.Product(
                            username=uname,
                            name=item.get("name", ""),
                            ablauf=item.get("ablauf", "") or "",
                            position=idx,
                        ))
            s.commit()

    def _db_save_rezepte(self, data):
        """Ersetzt Rezepte NUR für die enthaltenen, existierenden Benutzer."""
        with self.Session() as s:
            known = self._known_usernames(s)
            usernames = [u for u in data.keys() if u in known]
            skipped = [u for u in data.keys() if u not in known]
            if skipped:
                self._log(f"save_rezepte: unbekannte Benutzer übersprungen: {skipped}")
            if usernames:
                s.query(models.Recipe).filter(
                    models.Recipe.username.in_(usernames)
                ).delete(synchronize_session=False)
                for uname in usernames:
                    for idx, item in enumerate(data.get(uname) or []):
                        item = item or {}
                        s.add(models.Recipe(
                            username=uname,
                            recipe_key=str(item.get("id", "")),
                            created_at=str(item.get("created_at", "")),
                            is_favorite=bool(item.get("is_favorite", False)),
                            recipe_json=json.dumps(item.get("recipe", {}), ensure_ascii=False),
                            position=idx,
                        ))
            s.commit()

    def _db_delete_user(self, username):
        with self.Session() as s:
            row = s.get(models.User, username)
            if row:
                s.delete(row)  # Cascade entfernt Produkte/Rezepte
                s.commit()

    def _db_load_ai_config(self):
        with self.Session() as s:
            row = s.get(models.Setting, "ai_config")
            if row and row.svalue:
                try:
                    return json.loads(row.svalue)
                except Exception:  # noqa: BLE001
                    return {}
            return {}

    def _db_save_ai_config(self, data):
        with self.Session() as s:
            row = s.get(models.Setting, "ai_config")
            if row is None:
                row = models.Setting(skey="ai_config")
                s.add(row)
            row.svalue = json.dumps(data, ensure_ascii=False)
            s.commit()

    def _db_load_api_config(self):
        with self.Session() as s:
            row = s.get(models.Setting, "external_api_key")
            return {"api_key": row.svalue if row else ""}

    def _db_save_api_config(self, data):
        with self.Session() as s:
            row = s.get(models.Setting, "external_api_key")
            if row is None:
                row = models.Setting(skey="external_api_key")
                s.add(row)
            row.svalue = data.get("api_key", "") or ""
            s.commit()

    # ================= Öffentliche API =================
    def load_produkte(self):
        return self._load("produkte", self._db_load_produkte, {})

    def save_produkte(self, data):
        self._save("produkte", data, self._db_save_produkte)

    def load_users(self):
        return self._load("users", self._db_load_users, {})

    def save_users(self, data):
        self._save("users", data, self._db_save_users)

    def delete_user(self, username):
        """Löscht einen Benutzer (inkl. Produkte/Rezepte via Cascade).

        Erfordert eine erreichbare DB (im auto/mariadb-Modus). Während eines
        DB-Ausfalls wird bewusst ein Fehler geworfen, statt die Löschung in einer
        Datei zu vermerken (verhindert Inkonsistenzen beim Re-Sync).
        """
        if self.backend == "json":
            for ds in _MIRROR_DATASETS:
                d = self._read_json(ds, {})
                if isinstance(d, dict) and username in d:
                    d.pop(username, None)
                    self._write_json(ds, d)
            return True
        if self._ensure_db():
            try:
                self._db_delete_user(username)
                if self.backend == "auto":
                    for ds in _MIRROR_DATASETS:
                        d = self._read_json(ds, {})
                        if isinstance(d, dict) and username in d:
                            d.pop(username, None)
                            self._write_json(ds, d)
                return True
            except _CONN_ERRORS as e:
                with self._lock:
                    self.db_ok = False
                raise RuntimeError(f"Löschen fehlgeschlagen, DB-Verbindung verloren: {e}")
        raise RuntimeError(
            "Benutzer kann derzeit nicht gelöscht werden - Datenbank nicht erreichbar."
        )

    def load_rezepte(self):
        return self._load("rezepte", self._db_load_rezepte, {})

    def save_rezepte(self, data):
        self._save("rezepte", data, self._db_save_rezepte)

    def load_ai_config(self):
        return self._load("ai_config", self._db_load_ai_config, {})

    def save_ai_config(self, data):
        self._save("ai_config", data, self._db_save_ai_config)

    def load_api_config(self):
        return self._load("api_config", self._db_load_api_config, {"api_key": ""})

    def save_api_config(self, data):
        self._save("api_config", data, self._db_save_api_config)

    # ---------------- Logging ----------------
    def _log(self, msg):
        print(f"[storage] {msg}")
