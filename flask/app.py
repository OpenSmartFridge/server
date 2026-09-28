from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import requests
import json
import os
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash

import settings as cfg
from storage import Storage

app = Flask(__name__)
app.jinja_env.globals.update(enumerate=enumerate)

# Geheimer Session-Key: in Produktion MUSS er gesetzt sein, sonst Abbruch
# (ein bekannter Default-Key erlaubt Session-Fälschung -> Admin-Übernahme).
if cfg.SECRET_KEY_IS_DEFAULT:
    if cfg.DEBUG:
        print("[WARN] FLASK_SECRET_KEY nicht gesetzt - unsicherer Dev-Key (nur Debug!)")
    else:
        raise SystemExit(
            "FLASK_SECRET_KEY ist nicht gesetzt. In Produktion zwingend in .env "
            'eintragen, z.B.: python -c "import secrets;print(secrets.token_hex(32))"'
        )
app.secret_key = cfg.SECRET_KEY  # für Sessions (aus .env / Umgebung)

# Zentraler Speicher: MariaDB (primär) mit JSON-Fallback + Auto-Sync
store = Storage()
# Datenverlust-Schutz: nicht starten, wenn DB weg UND kein lokaler Spiegel da ist.
store.assert_safe_start()



# ------------------ PRODUKTE LADEN ------------------
def lade_produkte():
    return store.load_produkte()


def speichere_produkte(produkte):
    store.save_produkte(produkte)


produkte = lade_produkte()


# ------------------ BENUTZER LADEN ------------------
def lade_users():
    """Lädt Benutzer aus dem Speicher. Werte: {"password_hash": ..., "diet": ...}.

    Migriert dabei evtl. noch vorhandene Klartext-Passwörter (Legacy-Struktur
    mit "password") transparent zu Hashes.
    """
    data = store.load_users()
    if not isinstance(data, dict):
        data = {}
    if not data:
        if store.is_degraded():
            # DB nicht erreichbar -> KEINEN Default-Admin anlegen/persistieren,
            # sonst würde dieser Default bei DB-Rückkehr echte Daten überschreiben.
            return {}
        # Frischer Start (DB erreichbar & leer): Standard-Admin (gehasht) anlegen
        data = {"admin": {"password_hash": generate_password_hash("admin"), "diet": ""}}
        store.save_users(data)
        return data

    migriert = False
    for uname, udata in list(data.items()):
        if isinstance(udata, str):
            # ganz alte Struktur: Wert war direkt das (Klartext-)Passwort
            data[uname] = {"password_hash": generate_password_hash(udata), "diet": ""}
            migriert = True
        elif isinstance(udata, dict) and "password" in udata and "password_hash" not in udata:
            # Legacy-Klartextpasswort -> Hash
            data[uname] = {
                "password_hash": generate_password_hash(udata.get("password", "")),
                "diet": udata.get("diet", ""),
            }
            migriert = True
    if migriert:
        speichere_users(data)
    return data


def speichere_users(users):
    store.save_users(users)


users = lade_users()


# ------------------ REZEPTE LADEN UND SPEICHERN ------------------
def lade_rezepte():
    return store.load_rezepte()


def speichere_rezepte(rezepte):
    store.save_rezepte(rezepte)


def bereinige_alte_rezepte(user_rezepte):
    """Entfernt Rezepte, die älter als 7 Tage sind und nicht favorisiert sind"""
    heute = datetime.now()
    gefilterte_rezepte = []

    for rezept in user_rezepte:
        raw_created = rezept.get("created_at") or heute.isoformat()
        try:
            erstellt_am = datetime.fromisoformat(raw_created)
        except (ValueError, TypeError):
            erstellt_am = heute  # unlesbares Datum -> als "neu" behandeln (behalten)
        tage_alt = (heute - erstellt_am).days
        ist_favorit = rezept.get("is_favorite", False)

        # Behalte Rezept, wenn es favorisiert ist oder jünger als 7 Tage
        if ist_favorit or tage_alt < 7:
            gefilterte_rezepte.append(rezept)

    return gefilterte_rezepte


rezepte = lade_rezepte()


# ------------------ AI CONFIG LADEN UND SPEICHERN ------------------
def _default_ai_config():
    """Standard-AI-Konfiguration; Keys werden ggf. aus der .env vorbefüllt."""
    gemini_seed = cfg.GEMINI_API_KEY if cfg.GEMINI_API_KEY and cfg.GEMINI_API_KEY not in (
        "HIER_DEINEN_API_KEY_EINTRAGEN", "Dein_API_Key"
    ) else ""
    return {
        "provider": "gemini",
        "gemini_api_key": gemini_seed,
        "gemini_model": "gemini-2.5-flash",
        "openai_api_key": cfg.OPENAI_API_KEY or "",
        "openai_model": "gpt-4o-mini",
        "ollama_url": "http://localhost:11434/api/generate",
        "ollama_model": "llama3.2",
    }


def lade_ai_config():
    data = store.load_ai_config()
    if not isinstance(data, dict) or not data:
        # Erst-Befüllung aus Defaults/.env und in der DB ablegen.
        # Im degradierten Modus NICHT speichern (Geheimnisse nie in Dateien).
        data = _default_ai_config()
        if not store.is_degraded():
            store.save_ai_config(data)
    return data


def speichere_ai_config(config):
    store.save_ai_config(config)


ai_config = lade_ai_config()


# ------------------ API CONFIG LADEN UND SPEICHERN ------------------
def lade_api_config():
    data = store.load_api_config()
    if not isinstance(data, dict):
        data = {"api_key": ""}
    if not data.get("api_key") and cfg.EXTERNAL_API_KEY and not store.is_degraded():
        data["api_key"] = cfg.EXTERNAL_API_KEY
        store.save_api_config(data)
    return data


def speichere_api_config(config):
    store.save_api_config(config)


api_config_data = lade_api_config()


# ------------------ KI REZEPT GENERATOR ------------------

def generiere_rezept(produkte_liste):
    """
    Generiert ein intelligentes Rezept basierend auf verfügbaren Produkten.
    Verwendet Google Gemini AI für realistische, sinnvolle Rezepte.
    """
    if not produkte_liste or len(produkte_liste) == 0:
        return None

    # Extrahiere nur die Produktnamen
    produkt_namen = [p["name"] for p in produkte_liste]
    zutaten_text = ", ".join(produkt_namen)

    # Lade aktuelle AI Config
    global ai_config
    provider = ai_config.get("provider", "gemini")

    # Ermittle Ernährungseinstellungen des Benutzers (falls verfügbar)
    user_diet = ""
    if "user" in session:
        user = session["user"]
        if user in users:
            user_diet = users[user].get("diet", "")

    diet_instruction = ""
    if user_diet:
        diet_instruction = f"WICHTIG: Berücksichtige folgende Ernährungseinstellungen und Allergien des Benutzers: {user_diet}. Achte darauf, dass KEINE unverträglichen Zutaten im Rezept vorkommen! und wenn der user eine bestimmte Portionenanzahl haben möchte, folge diesem Wunsch!"

    try:
        # Erstelle intelligenten Prompt für Gemini
        prompt = f"""Du bist ein kreativer Koch. Erstelle ein realistisches, kochbares Rezept mit folgenden Zutaten aus dem Kühlschrank:

{zutaten_text}

{diet_instruction}

WICHTIG:
- Das Rezept MUSS zu den vorhandenen Zutaten passen (z.B. kein Salat mit Burger Buns)
- Verwende NUR Zutaten, die sinnvoll zusammenpassen
- Falls die Zutaten nicht für ein vollständiges Gericht reichen, schlage ein einfaches Gericht vor oder empfehle, was noch besorgt werden sollte
- Sei kreativ aber realistisch
- Erstelle ein Rezept nur aus den Zutaten, die bald ablaufen, und achte darauf, dass sie geschmacklich zusammenpassen und ein sinnvolles Gericht ergeben.
- Verwende nur Zutaten, die geschmacklich gut zusammenpassen, und lasse alle anderen weg. Versuche nicht, alles auf einmal zu verwenden.
- Nutze herrkömliche Gerichte und probiere nicht neuem Sachen zu erfinden und probiere nicht alles in Rezept zu quetschen. Richte dich aber bei der Auswahl der Produkte an das Ablaufdatum
- Es sollen keine Verrückten Kombinationen sein
- Du darfst, falls Produkte fehlen sie ins Rezept einfügen, aber nur wenn es sinnvoll ist. Markiere diese Produkte dann mit einem Sternchen (*)
- Wenn aufgrund einer Allergie oder anderen Essgewohnheiten ein Produkt nicht verwendet werden kann, schlage eine Alternative vor, welche ein Ersatzprodukt ist.

Antworte im folgenden JSON-Format (ohne Markdown, nur pures JSON):
{{
  "title": "Rezeptname",
  "description": "Kurze appetitliche Beschreibung (1-2 Sätze)",
  "ingredients": ["Zutat 1", "Zutat 2", "Zutat 3"],
  "steps": ["Schritt 1", "Schritt 2", "Schritt 3"],
  "time": "ca. 20 Minuten",
  "servings": "2 Personen"
}}"""

        response_text = ""

        if provider == "gemini":
            api_key = ai_config.get("gemini_api_key")
            if not api_key:
                raise ValueError("Gemini API Key fehlt")
            model_name = ai_config.get("gemini_model", "gemini-2.5-flash")
            import google.generativeai as genai  # lazy import
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            response_text = response.text.strip()

        elif provider == "openai":
            api_key = ai_config.get("openai_api_key")
            if not api_key:
                raise ValueError("OpenAI API Key fehlt")
            model_name = ai_config.get("openai_model", "gpt-4o-mini")
            import openai  # lazy import
            client = openai.OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "Du antwortest immer ausschließlich im angeforderten JSON-Format."},
                    {"role": "user", "content": prompt}
                ]
            )
            response_text = response.choices[0].message.content.strip()

        elif provider == "ollama":
            url = ai_config.get("ollama_url", "http://localhost:11434/api/generate")
            model_name = ai_config.get("ollama_model", "llama3.2")
            
            payload = {
                "model": model_name,
                "prompt": prompt,
                "stream": False,
                "format": "json"
            }
            response = requests.post(url, json=payload, timeout=60)
            if response.status_code == 200:
                response_text = response.json().get("response", "").strip()
            else:
                raise ValueError(f"Ollama Error HTTP {response.status_code}: {response.text}")
        else:
            raise ValueError(f"Unbekannter Provider: {provider}")

        # Entferne Markdown Code-Blöcke falls vorhanden
        if response_text.startswith("```"):
            # Entferne ```json oder ``` am Anfang
            response_text = (
                response_text.split("\n", 1)[1]
                if "\n" in response_text
                else response_text[3:]
            )
            # Entferne ``` am Ende
            if response_text.endswith("```"):
                response_text = response_text[:-3]

        rezept = json.loads(response_text)
        return rezept

    except json.JSONDecodeError as e:
        print(f"JSON Parse Error: {e}")
        print(f"Response text: {response_text}")
        return {
            "title": "Kreatives Kühlschrank-Gericht",
            "description": "Ein improvisiertes Gericht mit deinen Zutaten",
            "ingredients": produkt_namen,
            "steps": [
                "Die Zutaten waschen und vorbereiten",
                "Kombiniere die Zutaten kreativ",
                "Mit Gewürzen abschmecken",
                "Servieren und genießen",
            ],
            "time": "ca. 25 Minuten",
            "servings": "2 Personen",
        }
    except Exception as e:
        print(f"Fehler bei Rezeptgenerierung: {e}")
        return {
            "title": "⚠️ Fehler bei der Generierung",
            "description": f"Fehler: {str(e)}",
            "ingredients": produkt_namen,
            "steps": ["Bitte versuche es erneut"],
            "time": "N/A",
            "servings": "N/A",
        }


# ------------------ PRODUKTNAME über Barcode ------------------
def get_produktname(barcode):
    try:
        url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            return data.get("product", {}).get("product_name", "").strip()
    except:
        pass
    return None


# ------------------ ROUTE ------------------
@app.route("/", methods=["GET", "POST"])
def index():
    global users

    # LOGIN
    if "user" not in session:
        error = None
        if request.method == "POST":
            username = request.form.get("username", "").strip()
            password = request.form.get("password", "").strip()
            
            # Login-Check mit gehashten Passwörtern
            if username in users:
                user_data = users[username]
                stored_hash = (
                    user_data.get("password_hash", "")
                    if isinstance(user_data, dict)
                    else str(user_data)
                )

                if stored_hash and check_password_hash(stored_hash, password):
                    session["user"] = username
                    if username not in produkte:
                        produkte[username] = []
                        speichere_produkte(produkte)
                    return redirect(url_for("index"))
            
            error = "Falscher Login"
        return render_template("index.html", login=True, error=error)

    # BENUTZER EINGELOGGT
    user = session["user"]
    if user not in produkte:
        produkte[user] = []

    dev_mode = user == "admin"  # Admin kann Benutzer bearbeiten

    # ADMIN-FUNKTION: Benutzer hinzufügen/löschen
    if dev_mode and request.method == "POST":
        if "add_user" in request.form:
            new_user = request.form.get("new_user").strip()
            new_pass = request.form.get("new_pass").strip()
            if new_user and new_pass:
                users[new_user] = {
                    "password_hash": generate_password_hash(new_pass),
                    "diet": "",
                }
                speichere_users(users)
        elif "delete_user" in request.form:
            del_user = request.form.get("delete_user")
            if del_user in users and del_user != "admin":
                try:
                    store.delete_user(del_user)  # entfernt auch Produkte/Rezepte (Cascade)
                    users.pop(del_user, None)
                    produkte.pop(del_user, None)
                    rezepte.pop(del_user, None)
                except Exception as e:  # z.B. DB nicht erreichbar
                    print(f"[app] Benutzer loeschen fehlgeschlagen: {e}")

    # PRODUKT-HANDLING
    if request.method == "POST" and not request.form.get("username"):
        if "add" in request.form:
            barcode = request.form.get("barcode", "").strip()
            manual_name = request.form.get("manual_name", "").strip()
            ablauf = request.form.get("ablauf", "").strip()
            if manual_name:
                name = manual_name
            elif barcode:
                name = get_produktname(barcode) or f"Unbekanntes Produkt ({barcode})"
            else:
                name = "Unbekanntes Produkt"
            produkte[user].append({"name": name, "ablauf": ablauf})
            speichere_produkte(produkte)

        elif "delete" in request.form:
            index_to_delete = int(request.form.get("delete"))
            if 0 <= index_to_delete < len(produkte[user]):
                produkte[user].pop(index_to_delete)
                speichere_produkte(produkte)

        elif "edit" in request.form:
            index_to_edit = int(request.form.get("edit_index"))
            neuer_name = request.form.get("edit_name", "").strip()
            if 0 <= index_to_edit < len(produkte[user]) and neuer_name:
                produkte[user][index_to_edit]["name"] = neuer_name
                speichere_produkte(produkte)

        return redirect(url_for("index"))

    # PRODUKTSUCHE
    suchbegriff = request.args.get("suche", "").strip().lower()
    gefiltert = produkte[user]
    if suchbegriff:
        gefiltert = [p for p in produkte[user] if suchbegriff in p["name"].lower()]

    return render_template(
        "index.html",
        produkte=gefiltert,
        user=user,
        login=False,
        dev_mode=dev_mode,
        users=users,
    )


@app.route("/logout")
def logout():
    session.pop("user", None)
    return redirect(url_for("index"))


@app.route("/api/change-password", methods=["POST"])
def change_password():
    """API Endpunkt zum Ändern des Passworts"""
    if "user" not in session:
        return jsonify({"success": False, "message": "Nicht eingeloggt"}), 401

    user = session["user"]
    data = request.get_json()
    current_password = data.get("current_password", "")
    new_password = data.get("new_password", "")

    if not current_password or not new_password:
        return jsonify({"success": False, "message": "Bitte alle Felder ausfüllen"})

    user_data = users.get(user, {})
    stored_hash = user_data.get("password_hash", "") if isinstance(user_data, dict) else ""
    if not stored_hash or not check_password_hash(stored_hash, current_password):
        return jsonify({"success": False, "message": "Aktuelles Passwort ist falsch"})

    if len(new_password) < 3:
        return jsonify(
            {"success": False, "message": "Neues Passwort muss mindestens 3 Zeichen lang sein"}
        )

    if isinstance(users[user], dict):
        users[user]["password_hash"] = generate_password_hash(new_password)
    else:
        users[user] = {"password_hash": generate_password_hash(new_password), "diet": ""}

    speichere_users(users)
    return jsonify({"success": True, "message": "Passwort erfolgreich geändert"})


@app.route("/api/get-diet")
def get_diet():
    """API Endpunkt zum Abrufen der Ernährungseinstellungen"""
    if "user" not in session:
        return jsonify({"success": False, "message": "Nicht eingeloggt"}), 401
    
    user = session["user"]
    user_data = users.get(user, {})
    diet = user_data.get("diet", "") if isinstance(user_data, dict) else ""
    
    return jsonify({"success": True, "diet": diet})


@app.route("/api/save-diet", methods=["POST"])
def save_diet():
    """API Endpunkt zum Speichern der Ernährungseinstellungen"""
    if "user" not in session:
        return jsonify({"success": False, "message": "Nicht eingeloggt"}), 401
    
    user = session["user"]
    data = request.get_json()
    diet = data.get("diet", "").strip()
    
    if user not in users:
        users[user] = {"password_hash": "", "diet": diet}
    elif isinstance(users[user], dict):
        users[user]["diet"] = diet
    else:
        # Fallback für alte Struktur
        users[user] = {"password_hash": "", "diet": diet}

    speichere_users(users)
    return jsonify({"success": True, "message": "Ernährungseinstellungen erfolgreich gespeichert"})


@app.route("/api/ai-config", methods=["GET", "POST"])
def api_ai_config():
    """API Endpunkt für die KI Konfiguration (Nur Admin)"""
    if "user" not in session or session["user"] != "admin":
        return jsonify({"success": False, "message": "Unautorisiert"}), 403

    global ai_config

    if request.method == "GET":
        # Verstecke API Keys teilweise für Sicherheit beim Senden
        safe_config = ai_config.copy()
        for key in ["gemini_api_key", "openai_api_key"]:
            if safe_config.get(key):
                val = safe_config[key]
                if len(val) > 8:
                    safe_config[key] = f"{val[:4]}...{val[-4:]}"
                else:
                    safe_config[key] = "***"
        return jsonify({"success": True, "config": safe_config})

    if request.method == "POST":
        data = request.get_json()
        
        # Aktualisiere Config, behalte alte API Keys falls Platzhalter (***) gesendet werden
        updated = False
        
        if "provider" in data:
            ai_config["provider"] = data["provider"]
            updated = True
            
        # Update Felder, ignoriere Dummy/Platzhalter
        for key in ["gemini_model", "openai_model", "ollama_url", "ollama_model"]:
            if key in data:
                ai_config[key] = data[key]
                updated = True
                
        for key in ["gemini_api_key", "openai_api_key"]:
            if key in data and data[key] and not data[key].endswith("..."):
                if data[key] != "***" and "..." not in data[key]:
                    ai_config[key] = data[key]
                    updated = True

        if updated:
            speichere_ai_config(ai_config)
            
        return jsonify({"success": True, "message": "Konfiguration gespeichert"})

@app.route("/api/generate-recipe")
def api_generate_recipe():
    """API Endpunkt zum Generieren von Rezepten basierend auf Benutzerprodukten"""
    global rezepte
    if "user" not in session:
        return jsonify({"success": False, "message": "Nicht eingeloggt"}), 401

    user = session["user"]
    if user not in produkte or len(produkte[user]) == 0:
        return jsonify(
            {
                "success": False,
                "message": "Du hast noch keine Produkte in deinem Kühlschrank! Füge erst einige Produkte hinzu.",
            }
        )

    rezept = generiere_rezept(produkte[user])

    if rezept:
        # Speichere Rezept in History
        if user not in rezepte:
            rezepte[user] = []

        # Füge Metadaten hinzu
        rezept_mit_meta = {
            "id": datetime.now().isoformat(),
            "created_at": datetime.now().isoformat(),
            "is_favorite": False,
            "recipe": rezept,
        }

        rezepte[user].insert(0, rezept_mit_meta)  # Neuestes zuerst
        speichere_rezepte(rezepte)

        return jsonify({"success": True, "recipe": rezept, "recipe_id": rezept_mit_meta["id"]})
    else:
        return jsonify(
            {
                "success": False,
                "message": "Rezeptgenerierung fehlgeschlagen. Bitte versuche es erneut.",
            }
        )


@app.route("/api/recipe-history")
def api_recipe_history():
    """API Endpunkt zum Abrufen der Rezept-History"""
    global rezepte
    if "user" not in session:
        return jsonify({"success": False, "message": "Nicht eingeloggt"}), 401

    user = session["user"]
    if user not in rezepte:
        rezepte[user] = []

    # Bereinige alte Rezepte
    rezepte[user] = bereinige_alte_rezepte(rezepte[user])
    speichere_rezepte(rezepte)

    return jsonify({"success": True, "recipes": rezepte[user]})


@app.route("/api/toggle-favorite", methods=["POST"])
def api_toggle_favorite():
    """API Endpunkt zum Favorisieren/Unfavorisieren eines Rezepts"""
    global rezepte
    if "user" not in session:
        return jsonify({"success": False, "message": "Nicht eingeloggt"}), 401

    user = session["user"]
    data = request.get_json()
    recipe_id = data.get("recipe_id")

    if not recipe_id:
        return jsonify({"success": False, "message": "Rezept ID fehlt"})

    if user not in rezepte:
        return jsonify({"success": False, "message": "Keine Rezepte gefunden"})

    # Finde und toggle Favorit
    for rezept in rezepte[user]:
        if rezept["id"] == recipe_id:
            rezept["is_favorite"] = not rezept.get("is_favorite", False)
            speichere_rezepte(rezepte)
            return jsonify({"success": True, "is_favorite": rezept["is_favorite"]})

    return jsonify({"success": False, "message": "Rezept nicht gefunden"})


@app.route("/api/admin/api-settings", methods=["GET", "POST"])
def api_admin_settings():
    """API Endpunkt für die API Key Einstellungen (Nur Admin)"""
    if "user" not in session or session["user"] != "admin":
        return jsonify({"success": False, "message": "Unautorisiert"}), 403

    global api_config_data

    if request.method == "GET":
        val = api_config_data.get("api_key", "")
        masked = f"{val[:4]}...{val[-4:]}" if len(val) > 8 else ("***" if val else "")
        return jsonify({"success": True, "api_key": masked})

    if request.method == "POST":
        data = request.get_json()
        api_key = data.get("api_key", "").strip()
        # Maskierten Platzhalter ignorieren, damit der echte Key nicht überschrieben wird
        if api_key and "..." not in api_key and api_key != "***":
            api_config_data["api_key"] = api_key
            speichere_api_config(api_config_data)
        return jsonify({"success": True, "message": "API-Einstellungen gespeichert"})


@app.route("/api/products", methods=["GET"])
def api_external_products():
    """
    Externer API-Endpunkt für Produkte.
    Erwartet Header: API-Key
    """
    header_key = request.headers.get("API-Key")
    stored_key = api_config_data.get("api_key", "")

    # Falls kein Key gesetzt ist oder Key nicht übereinstimmt -> 401
    if not stored_key or header_key != stored_key:
        return jsonify({"error": "Unauthorized"}), 401

    # Gebe alle Produkte (aus DB bzw. Fallback) zurück
    return jsonify(store.load_produkte())


# ------------------ MAIN ------------------

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=cfg.PORT, debug=cfg.DEBUG)
