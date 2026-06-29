"""Scan router — handles image upload and AI vision processing."""

import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models.item import Item
from app.schemas.scan import ScanResult
from app.services.ai_vision import process_image_with_ai
from app.storage import save_upload, get_storage_url
from app.config import settings

router = APIRouter(prefix="/api/scan", tags=["scan"])


@router.post("/upload", response_model=ScanResult)
async def upload_and_scan(
    room_id: int = Form(...),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload an image, process it with the AI vision model,
    and return the structured result for review.
    """
    # Validate room exists
    from app.models.room import Room
    if not db.query(Room).filter(Room.id == room_id).first():
        raise HTTPException(status_code=404, detail="Room not found")

    # Save the uploaded image
    scan_session_id = str(uuid.uuid4())
    filename = f"{scan_session_id}_{image.filename}"
    file_path = save_upload(image, filename)

    # Process with AI vision model
    result = await process_image_with_ai(file_path, room_id)

    # Store image path on scan session for reference
    result._image_path = file_path
    result._scan_session_id = scan_session_id

    return result


@router.get("/pending/{scan_session_id}")
def get_pending_scan(scan_session_id: str, db: Session = Depends(get_db)):
    """Retrieve items that were created but not yet confirmed in a scan session."""
    items = db.query(Item).filter(
        Item.scan_session_id == scan_session_id,
        Item.confidence_score < 0.8,
    ).all()
    return {"scan_session_id": scan_session_id, "low_confidence_items": items}
