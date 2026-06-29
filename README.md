# Home Catalogue — AI-Powered Home Inventory System

A self-hosted, AI-driven home inventory application that eliminates manual cataloging. Take a photo of any room, shelf, or drawer, and the AI vision model automatically identifies items, proposes containers, and organizes everything into a searchable database.

## Features

- **📸 AI-Powered Scanning**: Upload photos and let GPT-4o, Claude, or local Ollama models identify items
- **🏠 Hierarchical Organization**: House → Room → Container → Item structure
- **🔍 Intelligent Search**: Fuzzy text search across names, categories, and tags
- **📱 Mobile-First**: Responsive PWA with native camera integration
- **🌙 Dark Mode**: Sleek high-contrast dark theme
- **🤖 Structured Outputs**: JSON Schema-validated AI responses
- **🐳 Docker Ready**: Multi-stage builds with hot-reload support

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, React Router |
| Backend | Python FastAPI, SQLAlchemy, Pydantic |
| Database | SQLite (production-ready, easy backup) |
| AI | OpenAI GPT-4o, Anthropic Claude, or Ollama (local) |
| Containerization | Docker, Docker Compose, Nginx |

## Quick Start

### Prerequisites

- Docker & Docker Compose
- An AI API key (OpenAI, Anthropic, or local Ollama)

### 1. Clone and Configure

```bash
cp .env.example .env
# Edit .env with your AI provider and API key
```

### 2. Run with Docker Compose

```bash
docker compose up -d
```

The app will be available at:
- **Frontend**: http://localhost
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### 3. Development Mode (Local)

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

Frontend runs on http://localhost:5173 with API proxy to backend.

## Architecture

```
homeCatalogue/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── config.py            # Environment configuration
│   │   ├── database.py          # SQLAlchemy setup
│   │   ├── models/              # Database models
│   │   │   ├── house.py
│   │   │   ├── room.py
│   │   │   ├── container.py
│   │   │   └── item.py
│   │   ├── schemas/             # Pydantic validation schemas
│   │   ├── routers/             # API endpoint handlers
│   │   │   ├── houses.py
│   │   │   ├── rooms.py
│   │   │   ├── containers.py
│   │   │   ├── items.py
│   │   │   └── scan.py
│   │   └── services/            # Business logic
│   │       ├── ai_vision.py     # AI model integration
│   │       └── search.py        # Search functionality
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/          # React components
│   │   │   ├── Layout.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── RoomView.jsx
│   │   │   ├── ReviewScan.jsx
│   │   │   ├── ItemCard.jsx
│   │   │   ├── ContainerTree.jsx
│   │   │   └── SearchBar.jsx
│   │   ├── api/                 # API client
│   │   ├── hooks/               # Custom React hooks
│   │   └── utils/               # Utilities
│   └── public/                  # Static assets
├── storage/                     # Uploaded images
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

## AI Vision Integration

### Supported Providers

1. **OpenAI** (default): GPT-4o with structured outputs
2. **Anthropic**: Claude 3.5 Sonnet with tool use
3. **Ollama**: Local Llava model for offline use
4. **oMLX**: Local LLaVA models on Apple Silicon (M1/M2/M3/M4)

### Configuration

Set in `.env`:

```env
# For OpenAI:
AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4o

# For oMLX (Apple Silicon):
AI_PROVIDER=omlx
OMLX_MODEL=mlx-community/llava-1.5-7b-4bit
```

### Available oMLX Models

- `mlx-community/llava-1.5-7b-4bit` (recommended, fast)
- `mlx-community/llava-1.5-7b-8bit` (higher quality)
- `mlx-community/llava-phi-3-mini-4bit` (smaller, faster)
- `mlx-community/llava-phi-3-mini-8bit`
- `mlx-community/llava-llama-3-8b-v1_1-4bit`
- `mlx-community/llava-llama-3-8b-v1_1-8bit`
- `mlx-community/llava-v1.6-mistral-7b-4bit`
- `mlx-community/llava-v1.6-mistral-7b-8bit`

### Structured Output Schema

The AI model returns JSON matching this schema:

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
- `GET /api/containers/?room_id={id}&parent_id={id}` — List containers
- `POST /api/containers/` — Create container
- `PUT /api/containers/{id}` — Update container
- `DELETE /api/containers/{id}` — Delete container

### Items
- `GET /api/items/?room_id={id}&search={query}` — List/search items
- `POST /api/items/` — Create item
- `POST /api/items/bulk` — Bulk create (from scan)
- `PUT /api/items/{id}` — Update item
- `DELETE /api/items/{id}` — Delete item

### Scan
- `POST /api/scan/upload` — Upload image and get AI analysis
- `GET /api/scan/pending/{session_id}` — Get pending scan items

## User Flows

### Flow A: Spatial Setup
1. Create a House (e.g., "Main Home")
2. Add Rooms (e.g., "Kitchen", "Living Room")
3. Optionally add Containers (shelves, drawers)

### Flow B: Mobile Capture
1. Navigate to a Room on mobile
2. Tap "Scan Area" → camera opens natively
3. Snap a photo of the space
4. AI processes the image in the background
5. Structured results appear for review

### Flow C: Verification
1. Review the scanned image and detected items
2. Edit item names, categories, or tags
3. Drag items between containers
4. Tap "Accept All" to commit to database

## Mobile PWA

The app is installable as a Progressive Web App:

**iOS (Safari):**
1. Open in Safari
2. Tap Share → "Add to Home Screen"

**Android (Chrome):**
1. Open in Chrome
2. Tap Menu → "Install app"

## Storage

Uploaded images are stored in `/storage/uploads/` with UUID-based filenames:
```
storage/uploads/
└── {scan_session_id}_{original_filename}
```

## Backup

### Database (SQLite)
```bash
cp backend/home_catalogue.db backup/
```

### Images
```bash
tar -czf storage-backup.tar.gz storage/
```

### Docker Volume
```bash
docker compose run --rm backend cp /app/home_catalogue.db /data/
docker compose run --rm backend cp -r /app/storage /data/
```

## Development

### Project Structure Notes

- **Backend**: FastAPI with SQLAlchemy ORM, Pydantic v2 for validation
- **Frontend**: React 18 with functional components, hooks, and Tailwind CSS
- **Database**: SQLite for simplicity; swap to PostgreSQL by changing `DATABASE_URL`
- **AI**: Extensible provider system — add new models in `ai_vision.py`

### Adding a New AI Provider

1. Add configuration in `config.py`
2. Create a new function in `ai_vision.py`
3. Update the provider switch in `process_image_with_ai()`

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_PROVIDER` | `openai` | `openai`, `anthropic`, `ollama`, or `omlx` |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model name |
| `ANTHROPIC_API_KEY` | — | Anthropic API key |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` | Anthropic model name |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama endpoint |
| `OLLAMA_MODEL` | `llava` | Ollama model name |
| `OMLX_MODEL` | `mlx-community/llava-1.5-7b-4bit` | oMLX model name |
| `DATABASE_URL` | `sqlite:///./home_catalogue.db` | Database connection |
| `UPLOAD_DIR` | `/app/storage/uploads` | Image storage path |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed CORS origins |

## License

MIT
