![OpenSmartFridge](assets/banner.png)

# 🧊 OpenSmartFridge Server

**OpenSmartFridge** ist ein selbst gehosteter Server zur Verwaltung von Lebensmitteln im Kühlschrank — mit moderner Weboberfläche, Ablaufdatum-Erkennung, Barcode-Unterstützung und KI-gestützter Rezeptgenerierung.

[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-yellow.svg)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.26%2B-00ADD8.svg?logo=go&logoColor=white)](https://go.dev/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=white)](https://react.dev/)
[![Docker Hub](https://img.shields.io/badge/Docker%20Hub-opensmartfridge%2Fserver-2496ED.svg?logo=docker&logoColor=white)](https://hub.docker.com/r/opensmartfridge/server)
[![Dokumentation](https://img.shields.io/badge/Dokumentation-opensmartfridge.de-4C1.svg)](https://opensmartfridge.de)

[Dokumentation](https://opensmartfridge.de) · [Issue melden](https://github.com/OpenSmartFridge/server/issues) · [Lizenz](LICENSE)

---

## 📑 Inhaltsverzeichnis

- [✨ Features](#-features)
- [🛠 Technologie](#-technologie)
- [📚 Dokumentation](#-dokumentation)
- [🚀 Installation](#-installation)
- [▶️ Verwendung](#️-verwendung)
- [⚙️ Konfiguration](#️-konfiguration)
- [💻 Lokale Entwicklung](#-lokale-entwicklung)
- [🤝 Mitwirken](#-mitwirken)
- [📄 Lizenz](#-lizenz)

## ✨ Features

- **Lebensmittelverwaltung** mit individuellen Ablaufdaten
- **Barcode-Erkennung** über Open Food Facts
- **KI-gestützte Rezeptgenerierung** auf Basis vorhandener Zutaten
- **Ernährungsvorlieben** und gespeicherte Lieblingsrezepte
- **Ablaufbenachrichtigungen** über Gotify oder ntfy
- **Zeitgesteuerte Benachrichtigungen** mit konfigurierbaren Cron-Zeitplänen
- **API-Zugriff** für Clients und Integrationen
- **PostgreSQL-Sitzungen und Datenspeicherung**
- **KeyDB-/Redis-Caching**
- **React-Weboberfläche**, direkt in den Go-Server eingebettet

## 🛠 Technologie

| Bereich | Technologie |
| --- | --- |
| Backend | Go |
| Frontend | React 19, TypeScript und Vite |
| Datenbank | PostgreSQL |
| Cache | KeyDB / Redis |
| KI | OpenAI-kompatible APIs und Anthropic |
| Produktdaten | Open Food Facts |
| Benachrichtigungen | Gotify und ntfy |
| Deployment | Docker und Docker Compose |

## 📚 Dokumentation

Installations-, Konfigurations- und Nutzungshinweise findest du unter:

👉 **[opensmartfridge.de](https://opensmartfridge.de)**

## 🚀 Installation

### Voraussetzungen

- Docker
- Docker Compose

### Schnellstart mit Docker Compose

Repository klonen und Beispielkonfiguration übernehmen:

```bash
git clone https://github.com/OpenSmartFridge/server.git
cd server
cp docker.example.env .env
```

Passe anschließend die Werte in `.env` an. Die vollständige Konfiguration ist in der [Dokumentation](https://opensmartfridge.de) beschrieben.

Image bauen und den gesamten Stack starten:

```bash
docker pull opensmartfridge/server:latest
docker compose up -d
```

Docker Compose verwendet dafür standardmäßig das Docker-Hub-Image `opensmartfridge/server:latest`.

Danach ist OpenSmartFridge unter folgender Adresse erreichbar:

```text
http://localhost:<PORT>
```

Der Standardport ist `8000`.

> [!IMPORTANT]
> Verwende starke Werte für `POSTGRES_PASSWORD` und sichere die `.env`-Datei. Setze `HTTPS=true`, wenn die Anwendung über HTTPS bereitgestellt wird; für lokalen HTTP-Betrieb verwende `false`.

Die Anwendung stoppen:

```bash
docker compose down
```

PostgreSQL- und KeyDB-Daten bleiben in den Docker-Volumes `postgres_data` und `keydb_data` erhalten.

## ▶️ Verwendung

Nach dem Start stehen unter anderem folgende Funktionen zur Verfügung:

- Lebensmittel erfassen, bearbeiten und nach Ablaufdatum sortieren
- Produkte per Barcode hinzufügen
- Rezepte aus dem aktuellen Bestand generieren
- Ernährungsvorlieben verwalten und Rezepte speichern
- Ablaufbenachrichtigungen über Gotify oder ntfy konfigurieren
- Bestand über die integrierte API für Clients und Integrationen bereitstellen

Die Benutzeroberfläche wird direkt vom Go-Server ausgeliefert.

### Administratorrechte

Den Administratorstatus eines Benutzers umschalten:

```bash
go run . chadm <username>
```

## ⚙️ Konfiguration

Die vollständige Konfigurationsreferenz findest du unter [opensmartfridge.de](https://opensmartfridge.de).

| Variable | Beschreibung |
| --- | --- |
| `PORT` | HTTP-Port des Servers |
| `HTTPS` | Aktiviert sichere Sitzung-Cookies bei HTTPS-Betrieb |
| `POSTGRES_DB` | Name der PostgreSQL-Datenbank |
| `POSTGRES_USER` | PostgreSQL-Benutzer |
| `POSTGRES_PASSWORD` | PostgreSQL-Passwort |
| `DATABASE_URL` | PostgreSQL-Verbindungszeichenfolge |
| `REDIS_URL` | Adresse von KeyDB oder Redis |
| `REDIS_PASSWORD` | Passwort von KeyDB oder Redis |
| `TIMEZONE` | Zeitzone für geplante Benachrichtigungen |
| `NOTIFICATION_CRON` | Semikolon-getrennte Cron-Zeitpläne |
| `NOTIFICATION_PRIORITY` | Priorität von Benachrichtigungen |
| `LLM_PROVIDER` | `openai`, `anthropic` oder `custom` |
| `LLM_LANGUAGE` | Sprache für generierte Rezepte |

### OpenAI

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=dein-api-key
OPENAI_MODEL=dein-modell
```

### Anthropic

```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=dein-api-key
ANTHROPIC_MODEL=dein-modell
```

### OpenAI-kompatibler Endpunkt

```env
LLM_PROVIDER=custom
CUSTOM_BASE_URL=https://example.com/v1
CUSTOM_MODEL=dein-modell
CUSTOM_KEY=dein-api-key
```

## 💻 Lokale Entwicklung

### Voraussetzungen

- Go 1.26 oder neuer
- Node.js 24 oder neuer
- PostgreSQL
- KeyDB oder Redis

Lokale Umgebungsdatei erstellen:

```bash
cp example.env .env
```

Konfiguriere PostgreSQL und KeyDB/Redis in `.env` und starte anschließend die Anwendung:

```bash
./start.sh
```

Das Startskript führt folgende Schritte aus:

1. Frontend-Abhängigkeiten installieren
2. React-Anwendung bauen
3. Go-Server starten

Für eine separate Frontend-Entwicklung:

```bash
cd frontend
npm install
npm run dev
```

Die Vite-Konfiguration leitet API-Anfragen an `http://localhost:8001` weiter.

## 🤝 Mitwirken

Beiträge sind willkommen!

1. Repository forken
2. Feature- oder Fehlerzweig erstellen
3. Änderungen sauber dokumentieren und testen
4. Einen Pull Request öffnen

Bitte öffne vor größeren Änderungen zuerst ein Issue, damit Implementierungsdetails und Kompatibilität besprochen werden können.

## 📄 Lizenz

OpenSmartFridge Server steht unter der **MIT-Lizenz**. Details stehen in der Datei [LICENSE](LICENSE).
