# Home Catalogue — AI-Powered Home Inventory System

A self-hosted, AI-driven home inventory application that eliminates manual cataloging. Take a photo of any room, shelf, or drawer, and a vision model automatically identifies items, proposes containers, and organizes everything into a searchable database.

## Features

- **AI-powered scanning**: Upload photos and let local or cloud vision models identify items and propose containers
- **Local-first AI**: Run scans with **Ollama** or **LM Studio** on your machine — no API key required
- **Settings UI**: Pick provider, server URL, and model from the app; test the connection and load models live
- **Async scan queue**: Multiple photos can scan in parallel; results persist across page refreshes
- **Scan inside containers**: Photograph the contents of a specific drawer, shelf, or bin
- **Hierarchical organization**: House → Room → Container → Item, with nested containers
- **Promote items to containers**: Reclassify misdetected storage (drawers, suitcases, bins) as real containers during review or from any item card
- **Global catalogue search**: Fuzzy search across names, categories, and tags with house/room/container context
- **Move & relocate**: Move items or whole container subtrees between rooms (same house)
- **Scan review**: Edit names, assign destinations, flag containers, and reject false positives before filing
- **Mobile-first PWA**: Responsive layout with native camera integration (`capture="environment"`)
- **Dark mode**: High-contrast dark theme throughout
- **Structured outputs**: JSON Schema-validated AI responses
- **Docker ready**: Multi-stage builds with hot-reload support

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, React Router |
| Backend | Python FastAPI, SQLAlchemy, Pydantic |
| Database | SQLite (production-ready, easy backup) |
| AI (local) | Ollama, LM Studio (OpenAI-compatible API) |
| AI (cloud) | OpenAI GPT-4o, Anthropic Claude (via `.env`) |
| Containerization | Docker, Docker Compose, Nginx |

## Quick Start

### Prerequisites

- Docker & Docker Compose (recommended), **or** Python 3.11+ and Node 18+
- For local scanning: **Ollama** or **LM Studio** with a vision-capable model (e.g. `llava`, `qwen3-vl`)

### 1. Clone and Configure

```bash
cp .env.example .env
# Edit .env — defaults target Ollama via host.docker.internal when using Docker
```

### 2. Start a local vision model

**Ollama:**
```bash
ollama pull llava          # or qwen3-vl:8b, etc.
ollama serve               # listens on :11434
```

**LM Studio:**
1. Load a vision model in LM Studio
2. Start the local server (default `http://localhost:1234`)
3. Enable the OpenAI-compatible API

### 3. Run with Docker Compose

```bash
docker compose up -d
```

The app will be available at:
- **Frontend**: http://localhost
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### 4. Configure AI in the app

1. Open **Settings** in the sidebar (or navigate to `/settings`)
2. Choose **Ollama** or **LM Studio**
3. Set the server URL — use `host.docker.internal` when the backend runs in Docker (quick-fill buttons provided)
4. Click **Test** to verify connectivity, then **Load models** to fetch available models
5. Select a vision model and click **Save settings**

Settings are persisted to `storage/ai_settings.json` and apply to all new scans immediately.

### 5. Development Mode (Local)

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173 with API proxy to backend. When running the backend locally (not in Docker), use `localhost` URLs in Settings instead of `host.docker.internal`.

## AI Provider Configuration

### Local providers (recommended) — Settings UI

Ollama and LM Studio are configured at runtime through the **Settings** page. No restart required after saving.

| Provider | Default URL (local) | Default URL (Docker backend) |
|----------|--------------------|-----------------------------|
| Ollama | `http://localhost:11434` | `http://host.docker.internal:11434` |
| LM Studio | `http://localhost:1234/v1` | `http://host.docker.internal:1234/v1` |

**Settings flow:**

```
Open Settings → Pick provider (Ollama / LM Studio)
    → Enter or quick-fill server URL
    → Test connection (latency + model count)
    → Load models (fetched live from your server)
    → Select a vision-capable model → Save
```

Persisted file: `storage/ai_settings.json` (path overridable via `AI_SETTINGS_FILE`).

**Recommended vision models:**
- Ollama: `llava`, `qwen3-vl:8b`, `qwen2-vl`
- LM Studio: any loaded vision model exposed via the OpenAI-compatible API

### Cloud providers — `.env` only

OpenAI and Anthropic are configured via environment variables and are not exposed in the Settings UI:

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

When `AI_PROVIDER` is `openai` or `anthropic` in `.env`, scans use that cloud provider regardless of the Settings page selection.

### Initial `.env` defaults (local providers)

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=llava

LMSTUDIO_BASE_URL=http://host.docker.internal:1234/v1
LMSTUDIO_MODEL=
```

These seed the defaults on first run; the Settings UI overrides them at runtime.

### Structured output schema

The vision model returns JSON matching this schema:

```json
{
  "proposed_containers": [
    {
      "name": "Top Shelf",
      "description": "Upper wooden shelf"
    }
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

Storage objects that are containers themselves (drawers, suitcases, bins, boxes) should appear in `proposed_containers`. If the model misclassifies them as items, mark **This is a container** during scan review or use **Make container** on an existing item.

## Architecture

```
homeCatalogue/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/              # house, room, container, item, scan_session
│   │   ├── schemas/
│   │   ├── routers/
│   │   │   ├── houses.py
│   │   │   ├── rooms.py
│   │   │   ├── containers.py
│   │   │   ├── items.py
│   │   │   ├── scan.py
│   │   │   └── settings.py      # AI provider settings API
│   │   └── services/
│   │       ├── ai_vision.py     # OpenAI, Anthropic, Ollama, LM Studio
│   │       ├── ai_settings_store.py
│   │       ├── ai_models.py     # Live model listing + connection test
│   │       └── search.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── RoomView.jsx     # Scan queue, review overlay, item grid
│   │   │   ├── ItemCard.jsx
│   │   │   ├── ContainerTree.jsx
│   │   │   ├── MovePicker.jsx
│   │   │   ├── SearchBar.jsx
│   │   │   ├── SearchResults.jsx
│   │   │   └── Settings.jsx     # AI provider configuration UI
│   │   └── api/client.js
│   └── public/
├── storage/
│   ├── uploads/                 # Scanned images
│   └── ai_settings.json         # Runtime AI config (created on first save)
├── docker-compose.yml
├── Dockerfile.backend
└── Dockerfile.frontend
```

## Database Schema

```
House (id, name, description)
  └─ Room (id, house_id, name, description)
       ├─ Container (id, room_id, parent_id, name, description)
       │    └─ Container (self-referencing for nesting)
       └─ Item (id, room_id, container_id, name, category, tags, image_path, confidence_score)
```

## API Endpoints

### Houses
- `GET /api/houses/` — List all houses
- `POST /api/houses/` — Create house
- `GET /api/houses/{id}` — Get house
- `PUT /api/houses/{id}` — Update house
- `DELETE /api/houses/{id}` — Delete house

### Rooms
- `GET /api/rooms/?house_id={id}` — List rooms
- `POST /api/rooms/` — Create room
- `GET /api/rooms/{id}` — Get room
- `PUT /api/rooms/{id}` — Update room
- `DELETE /api/rooms/{id}` — Delete room

### Containers
- `GET /api/containers/?room_id={id}` — List containers (`include_all=true` for full tree)
- `POST /api/containers/` — Create container
- `POST /api/containers/{id}/move` — Move container subtree to another room
- `PUT /api/containers/{id}` — Update container
- `DELETE /api/containers/{id}?delete_items={bool}` — Delete container (optionally delete items inside)

### Items
- `GET /api/items/?room_id={id}&search={query}` — List/filter items
- `GET /api/items/search?q={query}` — Global search with house/room/container context
- `POST /api/items/` — Create item
- `POST /api/items/bulk` — Bulk create (from scan review)
- `POST /api/items/move` — Move items to a room/container
- `POST /api/items/{id}/promote-to-container` — Convert an item into a container
- `PUT /api/items/{id}` — Update item
- `DELETE /api/items/{id}` — Delete item

### Scan
- `POST /api/scan/upload` — Upload image; returns `scan_session_id` immediately (async inference)
- `GET /api/scan/{session_id}` — Poll scan status and result
- `GET /api/scan/pending/{session_id}` — Low-confidence items from a session

### Settings
- `GET /api/settings/ai` — Current AI provider configuration
- `PUT /api/settings/ai` — Save provider, base URL, and model
- `GET /api/settings/ai/models?provider={ollama|lmstudio}&base_url={url}` — List models from server
- `GET /api/settings/ai/test?provider={ollama|lmstudio}&base_url={url}` — Test server connectivity

## User Flows

### Flow A: Spatial setup
1. Create a House (e.g. "Main Home")
2. Add Rooms (e.g. "Kitchen", "Living Room")
3. Optionally add Containers manually, or let scans propose them

### Flow B: Configure AI (first time)
1. Start Ollama or LM Studio with a vision model loaded
2. Open **Settings** → pick provider
3. Set server URL (use Docker host shortcut if running in containers)
4. **Test** connection → **Load models** → select model → **Save**

### Flow C: Room scan
1. Navigate to a Room on mobile or desktop
2. Tap **Scan area** → camera opens natively
3. Snap a photo; the scan enqueues immediately (you can take more photos without waiting)
4. AI processes each image in the background; the UI polls for completion
5. When ready, tap **Review** on a completed scan

### Flow D: Scan inside a container
1. Select a container in the room (or open an empty one)
2. Tap **Scan inside container**
3. AI catalogs only items visible inside that container

### Flow E: Scan review
1. Review the source image and detected entries side by side
2. Edit item names inline
3. Check **This is a container** for storage misclassified as items (drawers, suitcases, etc.)
4. Set per-item destination (**File in** / **Place under**) using existing or newly proposed containers
5. Remove false positives
6. Tap **File** to commit items and containers to the database

### Flow F: Promote an existing item
1. On any single item card, click the container icon or open edit → **Make container**
2. Confirm in the modal; the item becomes a real container in the tree

### Flow G: Search
1. Use the search bar in the header from any page
2. Results are grouped by house → room → container, with links to each location

### Flow H: Move items or containers
1. Select items via checkboxes, or use the move icon on a single item
2. Pick destination room and optional container
3. For containers, use the move icon in the container tree to relocate a whole subtree

## Mobile PWA

The app is installable as a Progressive Web App:

**iOS (Safari):**
1. Open in Safari
2. Tap Share → "Add to Home Screen"

**Android (Chrome):**
1. Open in Chrome
2. Tap Menu → "Install app"

## Storage

Uploaded images are stored in `storage/uploads/` with UUID-based filenames:
```
storage/uploads/
└── {scan_session_id}_{original_filename}
```

Runtime AI settings: `storage/ai_settings.json`

## Backup

### Database (SQLite)
```bash
cp storage/home_catalogue.db backup/
```

### Images and settings
```bash
tar -czf storage-backup.tar.gz storage/
```

### Docker Volume
```bash
docker compose run --rm backend cp /app/storage/home_catalogue.db /data/
docker compose run --rm backend cp -r /app/storage /data/
```

## Development

### Project structure notes

- **Backend**: FastAPI with SQLAlchemy ORM, Pydantic v2 for validation
- **Frontend**: React 18 with functional components, hooks, and Tailwind CSS
- **Database**: SQLite for simplicity; swap to PostgreSQL by changing `DATABASE_URL`
- **AI**: Provider switch in `ai_vision.py`; local config via `ai_settings_store.py`
- **Scans**: Async background tasks with DB-persisted `ScanSession` rows; frontend polls `GET /api/scan/{id}`

### Adding a new AI provider

1. Add configuration in `config.py`
2. Create a processor function in `ai_vision.py`
3. Update the provider switch in `process_image_with_ai()`
4. Optionally extend `Settings.jsx` and `routers/settings.py` for UI configuration

### Environment variables

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
| `RUNNING_IN_DOCKER` | — | Set `1` in Docker to show host URL hints in Settings |
| `DATABASE_URL` | `sqlite:///./home_catalogue.db` | Database connection |
| `UPLOAD_DIR` | `/app/storage/uploads` | Image storage path |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed CORS origins |

## License

MIT
