<div align="center">

# 🏠 Home Catalogue

### Point your camera at a shelf. Walk away with a searchable inventory.

**A self-hosted, AI-driven home inventory that catalogues your stuff for you — using a vision model running on _your own machine_. No cloud. No subscription. No API key.**

<br/>

[![License: MIT](https://img.shields.io/badge/License-MIT-FFC700?style=for-the-badge&labelColor=0A0A0B)](LICENSE)
[![Local-first AI](https://img.shields.io/badge/AI-Local--first-FFC700?style=for-the-badge&labelColor=0A0A0B)](#-ai-providers)
[![PWA](https://img.shields.io/badge/PWA-Installable-FFC700?style=for-the-badge&labelColor=0A0A0B)](#-install-as-an-app)

![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React_18-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-000000?style=flat-square&logo=ollama&logoColor=white)

</div>

---

> **Manual inventory apps fail because typing is boring.** Home Catalogue replaces the keyboard with a camera. Snap a drawer, a shelf, a whole room — a local vision model reads the photo, names every item, proposes containers, and files it all into a tidy `House → Room → Container → Item` tree you can search in milliseconds.

<br/>

```
   📷  snap            🧠  local vision model         🗂️  filed & searchable
  ┌──────────┐       ┌────────────────────────┐      ┌────────────────────────┐
  │  a shelf  │  ──►  │  identifies items       │ ──► │  House › Kitchen ›      │
  │  a drawer │       │  proposes containers     │     │  Top Shelf › Olive Oil  │
  │  a room   │       │  scores confidence       │     │  🔍 fuzzy search-ready  │
  └──────────┘       └────────────────────────┘      └────────────────────────┘
```

---

## 📑 Table of Contents

- [✨ Features](#-features)
- [🎨 The Look](#-the-look)
- [🧱 Tech Stack](#-tech-stack)
- [🚀 Quick Start](#-quick-start)
- [🤖 AI Providers](#-ai-providers)
- [🧭 How You'll Actually Use It](#-how-youll-actually-use-it)
- [📱 Install as an App](#-install-as-an-app)
- [🗺️ Architecture](#️-architecture)
- [🔌 API Reference](#-api-reference)
- [💾 Storage & Backup](#-storage--backup)
- [🛠️ Development](#️-development)
- [📄 License](#-license)

---

## ✨ Features

| | |
|---|---|
| 📸 **AI-powered scanning** | Photograph any space; a vision model identifies items and proposes containers automatically. |
| 🔒 **Local-first AI** | Runs scans through **Ollama** or **LM Studio** on your machine — **no API key, no cloud, no data leaving home.** |
| ⚙️ **Settings UI** | Pick provider, server URL, and model right in the app. Test connectivity and load models live — no restart. |
| ⚡ **Async scan queue** | Fire off multiple photos in parallel; inference runs in the background and survives page refreshes. |
| 📦 **Scan inside containers** | Open a drawer, bin, or suitcase and catalogue only what's inside it. |
| 🌳 **Hierarchical organization** | `House → Room → Container → Item`, with infinitely nestable containers. |
| 🔄 **Promote items to containers** | Misdetected a drawer as an "item"? Reclassify it as a real container during review or from any card. |
| 🔍 **Global fuzzy search** | Search names, categories, and tags across everything — results grouped by house, room, and container. |
| 🚚 **Move & relocate** | Shuffle items or entire container subtrees between rooms. |
| 📝 **Scan review** | Edit names, set destinations, flag containers, and reject false positives _before_ anything is filed. |
| 📲 **Mobile-first PWA** | Installable, responsive, with native camera capture (`capture="environment"`). |
| 🎯 **Structured outputs** | Every AI response is validated against a JSON Schema — no fragile string parsing. |
| 🐳 **Docker ready** | Multi-stage builds, hot reload, one command to run. |

---

## 🎨 The Look

Home Catalogue isn't "dark mode bolted onto a CRUD app." It's a deliberate **industrial "manifest paper"** aesthetic — built to feel like a workshop logbook, not a spreadsheet.

- **Safety-yellow on charcoal** — `#FFC700` actions over a warm near-black `#0A0A0B` canvas.
- **Graph-paper grid** beneath everything, like an engineer's notebook.
- **Display type** in _Space Grotesk_, monospace details in _Space Mono_.
- **High-contrast, focus-visible everywhere** — keyboard navigation never disappears behind an `outline: none`.

> Tokens live in `frontend/tailwind.config.js` + `frontend/src/index.css`.

---

## 🧱 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 · Vite · Tailwind CSS · React Router |
| **Backend** | Python · FastAPI · SQLAlchemy · Pydantic v2 |
| **Database** | SQLite — production-ready, single-file, trivial to back up |
| **AI (local)** | Ollama · LM Studio _(OpenAI-compatible API)_ |
| **AI (cloud)** | OpenAI GPT-4o · Anthropic Claude _(via `.env`)_ |
| **Infra** | Docker · Docker Compose · Nginx |

---

## 🚀 Quick Start

> **You need:** Docker & Docker Compose _(recommended)_ **— or —** Python 3.11+ and Node 18+.
> **Plus** a vision-capable model in **Ollama** or **LM Studio** (e.g. `llava`, `qwen3-vl`).

### 1️⃣ Clone & configure

```bash
cp .env.example .env
# Defaults target Ollama via host.docker.internal when running in Docker
```

### 2️⃣ Start a local vision model

<table>
<tr><th>Ollama</th><th>LM Studio</th></tr>
<tr><td valign="top">

```bash
ollama pull llava      # or qwen3-vl:8b
ollama serve           # → :11434
```

</td><td valign="top">

1. Load a vision model
2. Start the local server (`:1234`)
3. Enable the OpenAI-compatible API

</td></tr>
</table>

### 3️⃣ Run with Docker Compose

```bash
docker compose up -d
```

| Service | URL |
|---------|-----|
| 🖥️ **Frontend** | http://localhost |
| 🔧 **Backend API** | http://localhost:8000 |
| 📚 **Interactive API docs** | http://localhost:8000/docs |

### 4️⃣ Point the app at your model

1. Open **Settings** in the sidebar (`/settings`)
2. Choose **Ollama** or **LM Studio**
3. Set the server URL — use `host.docker.internal` when the backend runs in Docker _(one-tap quick-fill buttons provided)_
4. **Test** connectivity → **Load models** → pick a vision model → **Save**

> Settings persist to `storage/ai_settings.json` and apply to every new scan immediately — no restart.

### 5️⃣ (Alternative) Run it locally without Docker

<table>
<tr><th>Backend</th><th>Frontend</th></tr>
<tr><td valign="top">

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

</td><td valign="top">

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173 (proxied to backend)
```

</td></tr>
</table>

> Running the backend locally (not in Docker)? Use `localhost` URLs in Settings instead of `host.docker.internal`.

---

## 🤖 AI Providers

### 🏡 Local providers — recommended, configured in the Settings UI

No restart required after saving.

| Provider | Local URL | Docker-backend URL |
|----------|-----------|--------------------|
| **Ollama** | `http://localhost:11434` | `http://host.docker.internal:11434` |
| **LM Studio** | `http://localhost:1234/v1` | `http://host.docker.internal:1234/v1` |

```
Open Settings → Pick provider (Ollama / LM Studio)
   → Enter or quick-fill server URL
   → Test connection (latency + model count)
   → Load models (fetched live from your server)
   → Select a vision-capable model → Save
```

**Recommended vision models**

- **Ollama:** `llava`, `qwen3-vl:8b`, `qwen2-vl`
- **LM Studio:** any loaded vision model exposed via the OpenAI-compatible API

> Persisted to `storage/ai_settings.json` (override the path with `AI_SETTINGS_FILE`).

### ☁️ Cloud providers — via `.env` only

OpenAI and Anthropic are environment-configured and **not** exposed in the Settings UI. When `AI_PROVIDER` is `openai` or `anthropic`, scans use that cloud provider regardless of the Settings selection.

```env
# OpenAI
AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4o

# Anthropic
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-xxx
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

### 🌱 Initial `.env` defaults (local)

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=llava

LMSTUDIO_BASE_URL=http://host.docker.internal:1234/v1
LMSTUDIO_MODEL=
```

These seed the defaults on first run; the Settings UI overrides them at runtime.

### 🎯 Structured output schema

Every vision response is validated against this schema before anything touches the database:

```json
{
  "proposed_containers": [
    { "name": "Top Shelf", "description": "Upper wooden shelf" }
  ],
  "items": [
    {
      "name": "Olive Oil Bottle",
      "category": "Condiments",
      "tags": ["cooking", "liquid"],
      "suggested_container": "Top Shelf",
      "confidence_score": 0.92
    }
  ]
}
```

> Storage objects that are themselves containers (drawers, suitcases, bins, boxes) should land in `proposed_containers`. If the model misclassifies one as an item, hit **This is a container** during review or **Make container** on an existing item.

---

## 🧭 How You'll Actually Use It

<details open>
<summary><b>🏗️ Flow A — Set up your space</b></summary>

1. Create a **House** (e.g. _"Main Home"_)
2. Add **Rooms** (_"Kitchen"_, _"Living Room"_)
3. Optionally add containers manually — or let scans propose them
</details>

<details>
<summary><b>⚙️ Flow B — Configure AI (first time)</b></summary>

1. Start Ollama or LM Studio with a vision model loaded
2. **Settings** → pick provider → set server URL
3. **Test** → **Load models** → select → **Save**
</details>

<details>
<summary><b>📷 Flow C — Scan a room</b></summary>

1. Open a Room on mobile or desktop
2. Tap **Scan area** → camera opens natively
3. Snap a photo — it enqueues instantly, so keep shooting
4. AI processes each image in the background; the UI polls for completion
5. Tap **Review** on a completed scan
</details>

<details>
<summary><b>📦 Flow D — Scan inside a container</b></summary>

1. Select a container in the room (or open an empty one)
2. Tap **Scan inside container**
3. AI catalogues only the items visible inside it
</details>

<details>
<summary><b>📝 Flow E — Review before filing</b></summary>

1. Compare the source image and detected entries side by side
2. Edit item names inline
3. Check **This is a container** for storage misclassified as items
4. Set per-item destination (**File in** / **Place under**)
5. Remove false positives
6. Tap **File** to commit everything to the database
</details>

<details>
<summary><b>🔄 Flow F — Promote an existing item</b></summary>

1. On any item card, click the container icon or **edit → Make container**
2. Confirm — the item becomes a real container in the tree
</details>

<details>
<summary><b>🔍 Flow G — Search everything</b></summary>

1. Use the header search bar from any page
2. Results group by `House → Room → Container`, each linked to its location
</details>

<details>
<summary><b>🚚 Flow H — Move items or containers</b></summary>

1. Select items via checkboxes, or use the move icon on a single item
2. Pick a destination room and optional container
3. For containers, use the move icon in the tree to relocate a whole subtree
</details>

---

## 📱 Install as an App

Home Catalogue is a full PWA — install it like a native app:

| iOS (Safari) | Android (Chrome) |
|--------------|------------------|
| Share → **Add to Home Screen** | Menu → **Install app** |

---

## 🗺️ Architecture

```
homeCatalogue/
├── backend/
│   └── app/
│       ├── main.py · config.py · database.py
│       ├── models/                 # house, room, container, item, scan_session
│       ├── schemas/
│       ├── routers/
│       │   ├── houses.py · rooms.py · containers.py · items.py
│       │   ├── scan.py
│       │   └── settings.py         # AI provider settings API
│       └── services/
│           ├── ai_vision.py        # OpenAI · Anthropic · Ollama · LM Studio
│           ├── ai_settings_store.py
│           ├── ai_models.py        # live model listing + connection test
│           └── search.py
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Layout.jsx · Sidebar.jsx
│       │   ├── HouseList.jsx · HouseDetail.jsx
│       │   ├── RoomView.jsx        # scan queue + item grid
│       │   ├── ReviewScan.jsx      # scan review overlay
│       │   ├── ItemCard.jsx · ContainerTree.jsx · MovePicker.jsx
│       │   ├── SearchBar.jsx · SearchResults.jsx
│       │   └── Settings.jsx        # AI provider configuration UI
│       ├── hooks/ · utils/ · api/client.js
│       └── App.jsx
├── storage/
│   ├── uploads/                    # scanned images
│   ├── ai_settings.json            # runtime AI config (created on first save)
│   └── home_catalogue.db           # SQLite database
├── docker-compose.yml
├── Dockerfile.backend · Dockerfile.frontend
└── nginx.conf
```

### Database schema

```
House (id, name, description)
  └─ Room (id, house_id, name, description)
       ├─ Container (id, room_id, parent_id, name, description)
       │    └─ Container (self-referencing → nesting)
       └─ Item (id, room_id, container_id, name, category, tags, image_path, confidence_score)
```

---

## 🔌 API Reference

<details>
<summary><b>🏠 Houses</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/houses/` | List all houses |
| `POST` | `/api/houses/` | Create house |
| `GET` | `/api/houses/{id}` | Get house |
| `PUT` | `/api/houses/{id}` | Update house |
| `DELETE` | `/api/houses/{id}` | Delete house |
</details>

<details>
<summary><b>🚪 Rooms</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/rooms/?house_id={id}` | List rooms |
| `POST` | `/api/rooms/` | Create room |
| `GET` | `/api/rooms/{id}` | Get room |
| `PUT` | `/api/rooms/{id}` | Update room |
| `DELETE` | `/api/rooms/{id}` | Delete room |
</details>

<details>
<summary><b>📦 Containers</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/containers/?room_id={id}` | List containers (`include_all=true` for full tree) |
| `POST` | `/api/containers/` | Create container |
| `POST` | `/api/containers/{id}/move` | Move container subtree to another room |
| `PUT` | `/api/containers/{id}` | Update container |
| `DELETE` | `/api/containers/{id}?delete_items={bool}` | Delete container (optionally its items) |
</details>

<details>
<summary><b>🧷 Items</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/items/?room_id={id}&search={query}` | List / filter items |
| `GET` | `/api/items/search?q={query}` | Global search with location context |
| `POST` | `/api/items/` | Create item |
| `POST` | `/api/items/bulk` | Bulk create (from scan review) |
| `POST` | `/api/items/move` | Move items to a room/container |
| `POST` | `/api/items/{id}/promote-to-container` | Convert an item into a container |
| `PUT` | `/api/items/{id}` | Update item |
| `DELETE` | `/api/items/{id}` | Delete item |
</details>

<details>
<summary><b>📷 Scan</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/scan/upload` | Upload image; returns `scan_session_id` immediately (async inference) |
| `GET` | `/api/scan/{session_id}` | Poll scan status and result |
| `GET` | `/api/scan/pending/{session_id}` | Low-confidence items from a session |
</details>

<details>
<summary><b>⚙️ Settings</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/settings/ai` | Current AI provider configuration |
| `PUT` | `/api/settings/ai` | Save provider, base URL, and model |
| `GET` | `/api/settings/ai/models?provider={ollama\|lmstudio}&base_url={url}` | List models from server |
| `GET` | `/api/settings/ai/test?provider={ollama\|lmstudio}&base_url={url}` | Test server connectivity |
</details>

---

## 💾 Storage & Backup

Uploaded images live in `storage/uploads/` with session-scoped filenames:

```
storage/uploads/{scan_session_id}_{original_filename}
```

| What | How |
|------|-----|
| **SQLite database** | `cp storage/home_catalogue.db backup/` |
| **Images + settings** | `tar -czf storage-backup.tar.gz storage/` |
| **From a Docker volume** | `docker compose run --rm backend cp -r /app/storage /data/` |

---

## 🛠️ Development

- **Backend** — FastAPI + SQLAlchemy ORM, Pydantic v2 validation
- **Frontend** — React 18 functional components, hooks, Tailwind CSS
- **Database** — SQLite for simplicity; swap to PostgreSQL by changing `DATABASE_URL`
- **AI** — provider switch in `ai_vision.py`; local config via `ai_settings_store.py`
- **Scans** — async background tasks with DB-persisted `ScanSession` rows; frontend polls `GET /api/scan/{id}`

### ➕ Add a new AI provider

1. Add configuration in `config.py`
2. Create a processor function in `ai_vision.py`
3. Wire it into the switch in `process_image_with_ai()`
4. _(Optional)_ extend `Settings.jsx` + `routers/settings.py` for UI configuration

### 🔧 Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_PROVIDER` | `ollama` | `openai`, `anthropic`, `ollama`, or `lmstudio` |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model name |
| `ANTHROPIC_API_KEY` | — | Anthropic API key |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` | Anthropic model name |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama endpoint (seed default) |
| `OLLAMA_MODEL` | `llava` | Ollama model name (seed default) |
| `LMSTUDIO_BASE_URL` | `http://localhost:1234/v1` | LM Studio OpenAI-compatible API |
| `LMSTUDIO_MODEL` | — | LM Studio model id (seed default) |
| `AI_SETTINGS_FILE` | `{upload_dir}/../ai_settings.json` | Runtime settings persistence path |
| `RUNNING_IN_DOCKER` | — | Set `1` in Docker to show host-URL hints in Settings |
| `DATABASE_URL` | `sqlite:///./home_catalogue.db` | Database connection |
| `UPLOAD_DIR` | `/app/storage/uploads` | Image storage path |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed CORS origins |

---

## 📄 License

Released under the **[MIT License](LICENSE)**.

<div align="center">
<br/>

**Built for people with too much stuff and not enough patience for spreadsheets.**

</div>
