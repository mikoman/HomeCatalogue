"""Main FastAPI application entry point."""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import text
from app.database import engine, Base
from app.config import settings
from app.routers import houses, rooms, containers, items, scan


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables on startup if they don't exist."""
    Base.metadata.create_all(bind=engine)
    # Ensure upload directory exists
    os.makedirs(settings.upload_dir, exist_ok=True)
    yield


app = FastAPI(
    title="Home Catalogue",
    description="AI-Powered Home Inventory System",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(houses.router)
app.include_router(rooms.router)
app.include_router(containers.router)
app.include_router(items.router)
app.include_router(scan.router)

# Serve uploaded files
app.mount("/api/storage", StaticFiles(directory=settings.upload_dir), name="storage")


@app.get("/api/health")
def health_check():
    """Simple health check endpoint."""
    return {"status": "healthy", "provider": settings.ai_provider}


# Serve the frontend in production
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "../../frontend/dist")

if os.path.exists(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve the frontend SPA for all non-API routes."""
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
