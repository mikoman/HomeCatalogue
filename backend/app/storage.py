"""Storage utilities for managing uploaded images."""

from pathlib import Path
from fastapi import UploadFile
from app.config import settings


def save_upload(file: UploadFile, filename: str) -> str:
    """Save an uploaded file to the storage directory. Returns the file path."""
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    filepath = upload_dir / filename
    content = file.file.read()
    filepath.write_bytes(content)
    file.file.close()

    return str(filepath)


def get_storage_url(filename: str) -> str:
    """Get the public URL for a stored file."""
    return f"/api/storage/{filename}"


async def delete_file(filename: str) -> bool:
    """Delete a file from storage. Returns True if deleted, False if not found."""
    filepath = Path(settings.upload_dir) / filename
    if filepath.exists():
        filepath.unlink()
        return True
    return False
