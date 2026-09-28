"""
Zentrale Konfiguration für SmartFridge / KitchAI.

Alle Werte werden aus Umgebungsvariablen bzw. einer (nicht eingecheckten)
.env-Datei gelesen. So liegen keine Geheimnisse mehr im Code oder in Git.
Siehe .env.example für die verfügbaren Variablen.
"""
import os
from urllib.parse import quote_plus

# .env laden, falls python-dotenv installiert ist (optional, schadet sonst nicht)
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass


def _bool(value, default=False):
    if value is None:
        return default
    return str(value).strip().lower() in ("1", "true", "yes", "on")


# ----- Flask -----
# In Produktion MUSS FLASK_SECRET_KEY gesetzt sein (sonst unsicherer Default).
SECRET_KEY = os.environ.get("FLASK_SECRET_KEY") or "dev-only-insecure-change-me"
SECRET_KEY_IS_DEFAULT = not os.environ.get("FLASK_SECRET_KEY")
PORT = int(os.environ.get("PORT", "8080"))
DEBUG = _bool(os.environ.get("FLASK_DEBUG"), False)

# ----- Speicher-Backend -----
# "mariadb" | "json" | "auto"
STORAGE_BACKEND = (os.environ.get("STORAGE_BACKEND") or "auto").strip().lower()

# Verzeichnis für JSON-Fallback-/Spiegeldateien
DATA_DIR = os.environ.get("DATA_DIR") or "data"


def _build_database_url():
    """Liefert die SQLAlchemy-Verbindungs-URL.

    Entweder direkt aus DATABASE_URL, oder zusammengesetzt aus DB_*-Teilen
    (Standard: MariaDB/MySQL via PyMySQL).
    """
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
    host = os.environ.get("DB_HOST", "127.0.0.1")
    port = os.environ.get("DB_PORT", "3306")
    user = os.environ.get("DB_USER", "kitchai")
    password = os.environ.get("DB_PASSWORD", "")
    name = os.environ.get("DB_NAME", "kitchai")
    return (
        f"mysql+pymysql://{user}:{quote_plus(password)}@{host}:{port}/{name}"
        "?charset=utf8mb4"
    )


DATABASE_URL = _build_database_url()

# ----- Start-Werte für KI-/API-Keys -----
# Diese dienen nur als Erst-Befüllung der Settings-Tabelle in der DB.
# Danach werden sie über das Admin-Panel verwaltet (und in der DB gespeichert).
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
EXTERNAL_API_KEY = os.environ.get("EXTERNAL_API_KEY", "")
