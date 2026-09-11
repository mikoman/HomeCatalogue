"""Check fresh startup and frontend routes with temporary files."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import main
from app.config import settings


@pytest.fixture
def frontend(tmp_path):
    directory = tmp_path / "dist"
    directory.mkdir()
    (directory / "index.html").write_text("<html>Catalogue</html>")
    (directory / "assets").mkdir()
    (directory / "assets" / "app.js").write_text("window.catalogue = true")
    (tmp_path / "private.txt").write_text("private data")
    (directory / "linked.txt").symlink_to(tmp_path / "private.txt")
    app = FastAPI()

    @app.get("/{full_path:path}")
    def serve(full_path: str):
        return main.serve_frontend_file(full_path, directory)

    with TestClient(app) as client:
        yield client


def test_deep_links_serve_the_spa(frontend):
    response = frontend.get("/rooms/42")
    assert response.status_code == 200
    assert response.text == "<html>Catalogue</html>"
    assert frontend.get("/assets/app.js").text == "window.catalogue = true"


@pytest.mark.parametrize("path", ["/api/missing", "/api", "/assets/missing.js", "/%2e%2e/private.txt", "/linked.txt"])
def test_api_and_missing_or_unsafe_files_remain_404(frontend, path):
    assert frontend.get(path).status_code == 404


def test_startup_creates_upload_directory_before_storage_request(tmp_path, monkeypatch):
    directory = tmp_path / "new-uploads"
    engine = create_engine(f"sqlite:///{tmp_path / 'startup.db'}")
    monkeypatch.setattr(main, "engine", engine)
    monkeypatch.setattr(main.scan, "SessionLocal", sessionmaker(bind=engine))
    monkeypatch.setattr(settings, "upload_dir", str(directory))
    storage_route = next(route for route in main.app.routes if getattr(route, "name", None) == "storage")
    monkeypatch.setattr(storage_route.app, "directory", str(directory))
    monkeypatch.setattr(storage_route.app, "all_directories", [str(directory)])
    monkeypatch.setattr(storage_route.app, "config_checked", False)
    assert not directory.exists()
    with TestClient(main.app) as client:
        assert directory.is_dir()
        assert client.get("/api/storage/missing.jpg").status_code == 404
    engine.dispose()
