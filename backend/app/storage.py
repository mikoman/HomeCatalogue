"""Storage utilities for managing uploaded images."""

import io
import warnings
from pathlib import Path

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from app.config import settings

MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
STORED_IMAGE_EDGE = 2560


def save_upload(file: UploadFile, filename: str) -> str:
    """Validate a photo. Save a rotated JPEG with no original metadata."""
    if Path(filename).name != filename:
        raise ValueError("The storage filename must not contain a path.")
    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="The photo must be 20 MB or smaller.")
    if not content:
        raise HTTPException(status_code=400, detail="The photo is empty.")

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(content)) as image:
                if image.format not in {"JPEG", "PNG", "WEBP"}:
                    raise HTTPException(status_code=415, detail="Use a JPEG, PNG, or WebP photo.")
                if image.width * image.height > MAX_IMAGE_PIXELS:
                    raise HTTPException(status_code=413, detail="The photo must contain no more than 40 million pixels.")
                image.verify()
            with Image.open(io.BytesIO(content)) as image:
                image = ImageOps.exif_transpose(image)
                image.thumbnail((STORED_IMAGE_EDGE, STORED_IMAGE_EDGE), Image.Resampling.LANCZOS)
                if image.mode in {"RGBA", "LA"} or "transparency" in image.info:
                    rgba = image.convert("RGBA")
                    image = Image.new("RGB", rgba.size, "white")
                    image.paste(rgba, mask=rgba.getchannel("A"))
                else:
                    image = image.convert("RGB")
                output = io.BytesIO()
                image.save(output, format="JPEG", quality=90)
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise HTTPException(status_code=413, detail="The photo dimensions are too large.") from exc
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as exc:
        raise HTTPException(status_code=415, detail="The photo cannot be read. Use a valid JPEG, PNG, or WebP photo.") from exc

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    filepath = upload_dir / filename
    try:
        filepath.write_bytes(output.getvalue())
    except OSError:
        filepath.unlink(missing_ok=True)
        raise
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
