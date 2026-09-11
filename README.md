<div align="center">

The September 2026 update adds OpenRouter, YOLOE-26 support, and current model recommendations for 32 GB machines. It also includes capture and review improvements. See the [code and usability review](docs/app-review.md) for changes, validation, and remaining work.

# 🏠 Home Catalogue

### Point your camera at a shelf. Walk away with a searchable inventory.

**A self-hosted home inventory with local vision inference and optional OpenRouter cloud models. Local scans need no API key.**

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
| 🔒 **Local-first AI** | Use **Ollama** or **LM Studio** for local scans. Select **OpenRouter** when you want a cloud model. |
| ⚙️ **Settings UI** | Pick provider, server URL, and model right in the app. Test connectivity and load models live — no restart. |
| ⚡ **Async scan queue** | Fire off multiple photos in parallel; inference runs in the background and survives page refreshes. |
| 📦 **Scan inside containers** | Open a drawer, bin, or suitcase and catalogue only what's inside it. |
| 🌳 **Hierarchical organization** | `House → Room → Container → Item`, with infinitely nestable containers. |
| 🔄 **Promote items to containers** | Misdetected a drawer as an "item"? Reclassify it as a real container during review or from any card. |
| 🔍 **Global fuzzy search** | Search names, categories, and tags across everything — results grouped by house, room, and container. |
| 🚚 **Move & relocate** | Shuffle items or entire container subtrees between rooms. |
| 📝 **Scan review** | Edit names, set destinations, flag containers, and reject false positives _before_ anything is filed. |
| 📲 **Mobile-first PWA** | Installable, responsive, with native camera capture (`capture="environment"`). |
| 🎯 **Structured outputs** | Requests include a JSON Schema. The backend checks inventory fields. Ollama and OpenRouter also reject truncated completions. |
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
| **AI (cloud)** | OpenRouter in Settings · direct OpenAI and Anthropic via environment variables |
| **Infra** | Docker · Docker Compose · Nginx |

---

## 🚀 Quick Start

> **You need:** Docker & Docker Compose _(recommended)_ **— or —** Python 3.11+ and Node 18+.
> **Plus** a vision model in **Ollama** or **LM Studio**, or an OpenRouter API key. Start locally with `qwen3.5:9b`.

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
ollama pull qwen3.5:9b
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
2. Choose **Ollama**, **LM Studio**, or [OpenRouter](#openrouter-cloud-option).
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

### 6️⃣ (Optional) Enable bounding boxes

A vision-language model (VLM) names items. The optional **YOLOE-26** detector locates those item classes and returns boxes.
Run the detector on the host to use CUDA. It also supports CPU inference.

```bash
cd detector
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8077
```

Select **Settings → Detection mode → Detector**. Use `http://host.docker.internal:8077` from Docker, or `http://localhost:8077` from a local backend.
Select **Test**, then **Save detection settings**.

The default is `yoloe-26s-seg.pt`, with `DETECTOR_CONF=0.25` and `DETECTOR_IMGSZ=960`.
These are starting values, not calibrated thresholds. Try `yoloe-26m-seg.pt` or `yoloe-26l-seg.pt` if the detector misses small objects.
Set `DETECTOR_MODEL=yolov8x-worldv2.pt` to retain YOLO-World. Existing explicit model choices remain supported.

YOLOE needs Ultralytics 8.4 or later. Its first text prompt also downloads a text encoder and can install CLIP.
Complete one prompted prediction before offline use. Use `*-seg.pt` checkpoints. Prompt-free `*-seg-pf.pt` checkpoints cannot accept the scan's item classes.
The sidecar returns boxes only. It does not store YOLOE masks. [Ultralytics documentation](https://docs.ultralytics.com/models/yoloe)

The detector selects CUDA when available, otherwise CPU. MPS is an explicit experimental override through `DETECTOR_DEVICE=mps`.
The existing YOLO-World text encoder can fail on MPS. YOLOE support also needs testing on your installed PyTorch version.
`/health` reports the selected model, family, device, and image size. This check does not run a prediction.

**VLM mode** requests boxes directly from the selected vision model. It needs no detector.
The prompt requires `[x1, y1, x2, y2]` coordinates on a 0–1000 scale. The backend converts them to 0–1 coordinates.
It rejects out-of-range, non-finite, and zero-area boxes. It no longer guesses coordinate units from the size of a box.

A detector failure leaves the inventory available without boxes. Check repeated objects carefully: same-class boxes currently match items by detector score.
That association does not establish which bottle or book matches a detailed name.

The backend limits image size to `SCAN_MAX_EDGE=1280` while preserving aspect ratio.
This can remove small label details. Use closer photographs first, or test `SCAN_MAX_EDGE=1920` with sufficient memory.
The browser also resizes uploads, so increasing the backend limit cannot recover discarded pixels.

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

### Model recommendations for 32 GB RAM

Research checked on **11 September 2026**. These are recommendations for this workload, not a measured Home Catalogue leaderboard.
See the [detailed model research](docs/model-research.md) for benchmarks, alternatives, licenses, and source links.

| Use | Model and exact Ollama tag | Published download | Recommendation |
|---|---|---:|---|
| Practical default | **Qwen3.5 9B**, `qwen3.5:9b` | 6.6 GB, Q4_K_M | Start here for classification, visible labels, and container suggestions. |
| Quality candidate | **Qwen3.8 27B**, `qwen3.8:27b` | 18 GB, Q4_K_M | Try on 32 GB unified memory with one request and a short context. |
| Lower memory | **Qwen3.5 4B**, `qwen3.5:4b` | 3.4 GB, Q4_K_M | Use when GPU memory or response time limits the larger models. |
| Grounding baseline | **Qwen3-VL 8B**, `qwen3-vl:8b` | 6.1 GB, Q4_K_M | Compare bounding boxes and compatibility against newer models. |
| Other model family | **Gemma 4 12B**, `gemma4:12b` | 7.6 GB, Q4_K_M | Compare recognition errors against Qwen on the same photographs. |

Sizes come from the current [Qwen3.5](https://ollama.com/library/qwen3.5/tags), [Qwen3.8](https://ollama.com/library/qwen3.8:27b),
[Qwen3-VL](https://ollama.com/library/qwen3-vl:8b), and [Gemma 4](https://ollama.com/library/gemma4:12b) listings.
Qwen3.8 is the newer quality candidate. Qwen3.5 9B is the default because it leaves more memory for the detector and desktop applications.

**Download size is not peak RAM use.** A machine with 32 GB system RAM can have much less GPU VRAM.
Apple Silicon shares its memory with the operating system. Start with 4-bit weights, an 8,192-token context, and one request at a time.
Avoid 27B Q8 on a 32 GB machine. Its weights alone approach the full memory budget.

```bash
# Set these in the environment of the Ollama server.
OLLAMA_NUM_PARALLEL=1 OLLAMA_MAX_LOADED_MODELS=1 ollama serve

# Run these in a separate terminal.
ollama pull qwen3.5:9b
# Optional quality comparison:
ollama pull qwen3.8:27b
ollama ps
```

The backend sends `OLLAMA_NUM_CTX=8192`, `SCAN_MAX_TOKENS=4096`, and `think: false` to Ollama.
These limits reduce context allocation and reserve output for the inventory. Tune them for crowded scenes.
Set context and thinking controls in LM Studio itself. Larger contexts and concurrent requests consume more memory. [Ollama guidance](https://docs.ollama.com/faq)

For LM Studio, choose a vision-capable **GGUF Q4_K_M** or **MLX 4-bit** package.
Load its vision projector as required. Select the actual model ID returned by **Load models**.
Examples include `lmstudio-community/Qwen3.5-9B-GGUF` and `lmstudio-community/Qwen3.8-27B-MLX-4bit`.
The [research note](docs/model-research.md#lm-studio-and-apple-silicon) includes exact files and projector sizes.

Saving Settings preserves each provider's model choice. An existing saved `llava` choice remains unchanged until you select a replacement.
Runtime choices persist in `storage/ai_settings.json`. `AI_SETTINGS_FILE` can change that path.

### OpenRouter cloud option

OpenRouter is available beside Ollama and LM Studio in Settings. The API key stays in the backend environment.
The app does not place it in browser storage, API responses, or `ai_settings.json`.

1. Create an [OpenRouter API key](https://openrouter.ai/keys).
2. Set `OPENROUTER_API_KEY` in the backend environment or deployment secrets.
3. Restart the backend. With Compose, use `docker compose up -d --force-recreate backend` after changing its environment.
4. Open **Settings → OpenRouter**.
5. Select **Test** to check credentials without sending a photo or generating paid output.
6. Select **Load models**, choose a vision model, then **Save settings**.

`OPENROUTER_MODEL` supplies the initial model. The default is `google/gemini-3.8-flash`.
Compare `qwen/qwen3.8-27b` for difficult photographs. Both advertise image input and structured outputs in the
[current model catalog](https://openrouter.ai/api/v1/models). This is a starting comparison, not a measured cloud accuracy ranking.
Model availability and prices can change. The app loads compatible model metadata live and excludes text-only, image-generation, and batch-only entries.

**Cloud scans send the photo and container context outside your machine and can incur charges.**
Local providers remain available. The optional detector stays local even when OpenRouter performs classification.
OpenRouter mode uses keyword search. Your saved local embedding settings resume when you select that local provider again.

Requests use the fixed `https://openrouter.ai/api/v1` endpoint, a strict JSON Schema, and `provider.require_parameters=true`.
The app also requests `data_collection=deny` to exclude providers that collect data. This can reduce endpoint availability.
It does not guarantee zero retention across every service. [Structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs),
[provider data policies](https://openrouter.ai/docs/guides/routing/provider-selection)

The backend rejects empty and truncated completions. An invalid inventory receives one repair attempt, which can incur another model charge.
Authentication, credit, rate-limit, and provider errors do not trigger that repair attempt.
Connection testing checks the key and model catalog. Only a successful scan proves that the chosen endpoint accepts your request.

### Methods and optional extensions

The implemented flow normalizes image orientation, proposes an inventory, then obtains boxes through the selected detection mode.
It keeps detector class labels separate from detailed item names. Every result remains available for review before filing.
VLM confidence is a model estimate, not a calibrated probability.

| Task | Current recommendation | Integration status |
|---|---|---|
| Item names, categories, visible text, containers | Qwen3.5 9B or Qwen3.8 27B | Available through local providers. |
| Boxes from text prompts | YOLOE-26s, with m/l comparisons | Implemented in the optional sidecar. YOLO-World remains supported. |
| Boxes in one VLM pass | Qwen3.8 or Qwen3-VL | Implemented. Review small and repeated objects. |
| Dedicated label OCR | PP-OCRv6 small or medium on crops | Research recommendation. Needs a separate integration. |
| Mask refinement | YOLOE masks first, then SAM 3 or SAM 2.1 if needed | Masks are not stored or displayed yet. |
| Visual similarity search | SigLIP2 base or Qwen3-VL-Embedding-2B | Research recommendation. Current semantic search embeds text only. |
| Crowded shelves | Closer photos now, crop or tile passes later | Automatic crops, tile merging, and crop reclassification are not implemented. |

The [research note](docs/model-research.md) compares these methods with Grounding DINO, Moondream, InternVL, and other candidates.
Evaluate precision, recall, duplicate counts, box overlap, OCR, JSON success, latency, and peak memory on the same household photos.
Do not compare published scores from different datasets as one ranking.

### ☁️ Direct cloud providers — environment configuration

OpenAI and Anthropic use environment configuration. An explicit `AI_PROVIDER` supplies the default when no saved provider choice exists. Saving a provider in Settings overrides that default for new scans. Settings also shows the effective provider and model.

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
OLLAMA_MODEL=qwen3.5:9b

LMSTUDIO_BASE_URL=http://host.docker.internal:1234/v1
LMSTUDIO_MODEL=
```

These seed the defaults on first run; the Settings UI overrides them at runtime.

### 🎯 Structured output schema

Vision requests include a JSON Schema. This example shows the inventory fields returned for review:

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

The parser checks names, field types, and finite coordinates. Local responses can use aliases or omit optional fields.
OpenRouter requests strict output, but the backend still checks the result. Invalid inventories receive one repair attempt.

> Storage objects that are themselves containers (drawers, suitcases, bins, boxes) should land in `proposed_containers`. If the model misclassifies one as an item, hit **This is a container** during review or **Make container** on an existing item.

---

## 🧭 How You'll Actually Use It

<details open>
<summary><b>🏗️ Flow A — Set up your space</b></summary>

1. Open **Your catalogue**.
2. Enter a property name and a room or space name in the first form.
3. Select **Create space and continue**.
4. Add containers later, or review the containers proposed by a scan.
</details>

<details>
<summary><b>⚙️ Flow B — Configure AI (first time)</b></summary>

1. Start Ollama or LM Studio with a vision model loaded
2. **Settings** → pick provider → set server URL
3. **Test** → **Load models** → select → **Save**
</details>

<details>
<summary><b>📷 Flow C — Scan a room</b></summary>

1. Open a room, or use **Scan** to choose a space.
2. Select **Take photo** or **Choose photos**.
3. Keep the page open while photos upload. The library supports multiple photos.
4. Watch the preparation, upload, and analysis states.
5. Open a completed scan to review the suggestions.
</details>

<details>
<summary><b>📦 Flow D — Scan inside a container</b></summary>

1. Select a container in the room (or open an empty one)
2. Tap **Scan inside container**
3. AI catalogues only the items visible inside it
</details>

<details>
<summary><b>📝 Flow E — Review before filing</b></summary>

1. Open a completed scan.
2. Check the names against the source photo.
3. Clear the selection for false detections. You can select them again before saving.
4. Change the category or destination when needed. Storage objects can become containers.
5. Save the selected results. The server saves the review in one transaction.

Review drafts remain in this browser after refresh when browser storage is available. The server restores uploaded scans independently.
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
│           ├── ai_vision.py        # OpenRouter · OpenAI · Anthropic · local providers
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
| `GET` | `/api/scan/active?room_id={id}` | Restore active and unsaved scans for a room |
| `POST` | `/api/scan/{session_id}/accept` | Save one reviewed scan atomically and return a reusable receipt |
| `GET` | `/api/scan/pending/{session_id}` | Low-confidence items from a session |
</details>

<details>
<summary><b>⚙️ Settings</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/settings/ai` | Current AI provider configuration |
| `PUT` | `/api/settings/ai` | Save provider, base URL, and model |
| `GET` | `/api/settings/ai/models?provider={ollama\|lmstudio\|openrouter}&base_url={url}` | List models from server |
| `GET` | `/api/settings/ai/test?provider={ollama\|lmstudio\|openrouter}&base_url={url}` | Test server connectivity |
</details>

---

## 💾 Storage & Backup

Uploaded images live in `storage/uploads/` with generated filenames. New uploads become JPEG files with normalised orientation and no original metadata:

```
storage/uploads/{scan_session_id}_{upload_file_id}.jpg
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

### Validation

Run the backend tests from `backend/` with its Python environment active:

```bash
python -m pytest tests -q
```

Run the frontend checks from `frontend/`:

```bash
npm test
npm run build
```

OpenRouter tests use mocked responses and temporary settings. They do not spend credits or send personal photographs.
Detector adapter tests use model substitutes, so backend tests do not download weights.

The September 2026 implementation check also ran YOLOE-26s on CPU with a synthetic blank image and an Ultralytics example photograph.
This checks runtime compatibility and box serialization. It does not establish household accuracy, CUDA/MPS support, or peak memory on a 32 GB machine.
Local VLM generation and paid OpenRouter inference still require a configured service and representative photographs.

### ➕ Add a new AI provider

1. Add configuration in `config.py`
2. Create a processor function in `ai_vision.py`
3. Wire it into the switch in `process_image_with_ai()`
4. _(Optional)_ extend `Settings.jsx` + `routers/settings.py` for UI configuration

### 🔧 Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_PROVIDER` | `ollama` | `ollama`, `lmstudio`, `openrouter`, `openai`, `anthropic`, or `omlx` |
| `OPENROUTER_API_KEY` | — | Backend-only OpenRouter key. Restart after changing it. |
| `OPENROUTER_MODEL` | `google/gemini-3.8-flash` | Initial OpenRouter model. Settings overrides it. |
| `SCAN_MAX_TOKENS` | `4096` | Output token limit for Ollama and OpenRouter. |
| `OLLAMA_NUM_CTX` | `8192` | Context size sent to Ollama. |
| `SCAN_MAX_EDGE` | `1280` | Maximum image edge sent to inference providers. |
| `DETECTOR_BASE_URL` | `http://host.docker.internal:8077` | Initial detector URL. Settings overrides it. |
| `DETECTOR_MODEL` | `yoloe-26s-seg.pt` | Sidecar checkpoint. Set in the detector process environment. |
| `DETECTOR_CONF` | `0.25` | Sidecar confidence threshold. |
| `DETECTOR_IMGSZ` | `960` | Sidecar inference image size. |
| `DETECTOR_DEVICE` | CUDA or CPU | Sidecar device override. |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model name |
| `ANTHROPIC_API_KEY` | — | Anthropic API key |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` | Anthropic model name |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama endpoint (seed default) |
| `OLLAMA_MODEL` | `qwen3.5:9b` | Ollama model name (seed default) |
| `LMSTUDIO_BASE_URL` | `http://localhost:1234/v1` | LM Studio OpenAI-compatible API |
| `LMSTUDIO_MODEL` | — | LM Studio model id (seed default) |
| `AI_SETTINGS_FILE` | `{upload_dir}/../ai_settings.json` | Runtime settings persistence path |
| `RUNNING_IN_DOCKER` | — | Set `1` in Docker to show host-URL hints in Settings |
| `DATABASE_URL` | `sqlite:///./home_catalogue.db` | Database connection |
| `UPLOAD_DIR` | `/app/storage/uploads` | Image storage path |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed CORS origins |

---

## 📄 License

Application code uses the **[MIT License](LICENSE)**. Model and dependency licenses apply separately.
Ultralytics uses AGPL-3.0 or an Enterprise license. See the [research note](docs/model-research.md) for model terms.

<div align="center">
<br/>

**Built for people with too much stuff and not enough patience for spreadsheets.**

</div>
