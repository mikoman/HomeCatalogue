"""Check bounded photo decoding and metadata removal."""

import io

import pytest
from fastapi import HTTPException, UploadFile
from PIL import Image

from app import storage


def test_upload_has_a_bounded_read(monkeypatch, tmp_path):
    monkeypatch.setattr(storage, "MAX_UPLOAD_BYTES", 10)
    monkeypatch.setattr(storage.settings, "upload_dir", str(tmp_path))
    file = UploadFile(file=io.BytesIO(b"x" * 100), filename="photo.jpg")
    with pytest.raises(HTTPException) as failure:
        storage.save_upload(file, "photo.jpg")
    assert failure.value.status_code == 413
    assert file.file.tell() == 11
    assert list(tmp_path.iterdir()) == []


def test_photo_rotation_and_metadata_removal(monkeypatch, tmp_path):
    monkeypatch.setattr(storage.settings, "upload_dir", str(tmp_path))
    source = io.BytesIO()
    exif = Image.Exif()
    exif[274] = 6
    exif[270] = "Private photo description"
    Image.new("RGB", (30, 20), "white").save(source, format="JPEG", exif=exif)
    source.seek(0)
    result = storage.save_upload(UploadFile(file=source), "photo.jpg")
    with Image.open(result) as image:
        assert image.size == (20, 30)
        assert not image.getexif()


def test_large_photo_resizes_for_fast_display(monkeypatch, tmp_path):
    monkeypatch.setattr(storage.settings, "upload_dir", str(tmp_path))
    source = io.BytesIO()
    Image.new("RGB", (3000, 1500), "white").save(source, format="JPEG")
    source.seek(0)
    result = storage.save_upload(UploadFile(file=source), "photo.jpg")
    with Image.open(result) as image:
        assert image.size == (2560, 1280)
