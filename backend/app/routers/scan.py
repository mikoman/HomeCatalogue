"""Scan router — async image upload and AI vision processing.

The upload endpoint returns immediately with a scan_session_id; the actual
AI inference runs in a FastAPI BackgroundTask and persists results to the
ScanSession row. The frontend polls GET /api/scan/{id} for completion.

This decouples the (slow, minutes-long) model call from the HTTP request,
so no gateway timeout can kill a scan while inference is still running —
the original cause of the 504s. A scan also survives client disconnects and
page refreshes because its state lives in the database, not the request.
"""

import os
import uuid
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.models.container import Container
from app.models.item import Item
from app.models.room import Room
from app.models.house import House
from app.models.scan_session import ScanSession
from app.schemas.scan import ScanResult, ScanUploadResponse, ScanStatusResponse, FailedScanRead
from app.services.ai_vision import process_image_with_ai
from app.storage import save_upload, get_storage_url

router = APIRouter(prefix="/api/scan", tags=["scan"])


@router.post("/upload", response_model=ScanUploadResponse)
async def upload_and_scan(
    background_tasks: BackgroundTasks,
    room_id: int = Form(...),
    image: UploadFile = File(...),
    container_id: int | None = Form(None),
    db: Session = Depends(get_db),
):
    """Upload an image and enqueue async AI analysis.

    Returns immediately with a scan_session_id. Poll
    GET /api/scan/{scan_session_id} for the result.
    """
    # Validate room exists
    if not db.query(Room).filter(Room.id == room_id).first():
        raise HTTPException(status_code=404, detail="Room not found")

    if container_id is not None:
        container = (
            db.query(Container)
            .filter(Container.id == container_id, Container.room_id == room_id)
            .first()
        )
        if not container:
            raise HTTPException(status_code=400, detail="Invalid container for this room")

    # Save the uploaded image
    scan_session_id = str(uuid.uuid4())
    filename = f"{scan_session_id}_{image.filename}"
    file_path = save_upload(image, filename)

    # Persist the session row so its lifecycle survives disconnects/refreshes
    session = ScanSession(
        id=scan_session_id,
        room_id=room_id,
        container_id=container_id,
        image_path=file_path,
        status="pending",
    )
    db.add(session)
    db.commit()

    # Run inference after the response is sent. The background task uses its
    # own DB session because the request's session is closed once we return.
    background_tasks.add_task(_run_scan, scan_session_id, file_path, room_id, container_id)

    return ScanUploadResponse(scan_session_id=scan_session_id, status="pending")


async def _run_scan(
    scan_session_id: str,
    image_path: str,
    room_id: int,
    container_id: int | None = None,
) -> None:
    """Background task: run AI inference and persist the result.

    Runs in the same event loop after the upload response is sent. Inference
    is I/O-bound (httpx await), so other requests stay responsive. Each DB
    write uses a short-lived session so we never hold a connection for the
    full (minutes-long) model call.
    """
    _set_status(scan_session_id, status="processing")

    try:
        existing_containers = _fetch_existing_containers(room_id)
        target_container = _fetch_target_container(room_id, container_id)
        result = await process_image_with_ai(
            image_path,
            room_id,
            existing_containers=existing_containers,
            target_container=target_container,
        )
        _set_status(
            scan_session_id,
            status="completed",
            result=result.model_dump(),
            completed_at=datetime.utcnow(),
        )
    except Exception as exc:  # noqa: BLE001 - surface any failure to the client
        _set_status(
            scan_session_id,
            status="failed",
            error=str(exc),
            completed_at=datetime.utcnow(),
        )


def _set_status(
    scan_session_id: str,
    status: str,
    result: dict | None = None,
    error: str | None = None,
    completed_at: datetime | None = None,
    *,
    clear_result: bool = False,
    clear_error: bool = False,
) -> None:
    """Update a scan session row using a short-lived DB session."""
    db = SessionLocal()
    try:
        sess = db.query(ScanSession).filter(ScanSession.id == scan_session_id).first()
        if not sess:
            return
        sess.status = status
        if clear_result:
            sess.result = None
        elif result is not None:
            sess.result = result
        if clear_error:
            sess.error = None
        elif error is not None:
            sess.error = error
        if completed_at is not None:
            sess.completed_at = completed_at
        db.commit()
    finally:
        db.close()


def _fetch_target_container(room_id: int, container_id: int | None) -> dict | None:
    """Return {name, description} when scanning inside a specific container."""
    if container_id is None:
        return None
    db = SessionLocal()
    try:
        row = (
            db.query(Container)
            .filter(Container.id == container_id, Container.room_id == room_id)
            .first()
        )
        if not row:
            return None
        return {"name": row.name, "description": row.description or ""}
    finally:
        db.close()


def _fetch_existing_containers(room_id: int) -> list[dict]:
    """Snapshot of the room's existing containers at scan-creation time.

    Captured once (when the scan starts running) so mid-scan container
    additions don't race the AI prompt. Returns a list of {name, description}
    dicts for the AI context.
    """
    db = SessionLocal()
    try:
        rows = (
            db.query(Container)
            .filter(Container.room_id == room_id)
            .order_by(Container.name)
            .all()
        )
        return [{"name": c.name, "description": c.description or ""} for c in rows]
    finally:
        db.close()


@router.get("/failed", response_model=list[FailedScanRead])
def list_failed_scans(db: Session = Depends(get_db)):
    """List scan sessions that failed AI analysis, newest first."""
    rows = (
        db.query(ScanSession, Room, House, Container)
        .join(Room, ScanSession.room_id == Room.id)
        .join(House, Room.house_id == House.id)
        .outerjoin(Container, ScanSession.container_id == Container.id)
        .filter(ScanSession.status == "failed")
        .order_by(ScanSession.completed_at.desc().nullslast(), ScanSession.created_at.desc())
        .all()
    )
    return [
        FailedScanRead(
            scan_session_id=sess.id,
            room_id=room.id,
            room_name=room.name,
            house_id=house.id,
            house_name=house.name,
            container_id=container.id if container else None,
            container_name=container.name if container else None,
            status=sess.status,
            image_url=get_storage_url(os.path.basename(sess.image_path)) if sess.image_path else None,
            error=sess.error,
            created_at=sess.created_at,
            completed_at=sess.completed_at,
        )
        for sess, room, house, container in rows
    ]


@router.post("/{scan_session_id}/retry", response_model=ScanStatusResponse)
async def retry_scan(
    scan_session_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Re-run AI analysis on a failed scan using the retained image."""
    sess = db.query(ScanSession).filter(ScanSession.id == scan_session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Scan session not found")
    if sess.status not in ("failed", "completed"):
        raise HTTPException(status_code=400, detail="Only failed or completed scans can be retried")
    if not sess.image_path or not os.path.isfile(sess.image_path):
        raise HTTPException(status_code=400, detail="Original image no longer available")

    sess.status = "pending"
    sess.error = None
    sess.result = None
    sess.completed_at = None
    db.commit()

    background_tasks.add_task(
        _run_scan,
        scan_session_id,
        sess.image_path,
        sess.room_id,
        sess.container_id,
    )

    image_url = get_storage_url(os.path.basename(sess.image_path))
    return ScanStatusResponse(
        scan_session_id=sess.id,
        status="pending",
        image_url=image_url,
        result=None,
        error=None,
    )


@router.delete("/{scan_session_id}", status_code=204)
def dismiss_failed_scan(scan_session_id: str, db: Session = Depends(get_db)):
    """Remove a failed scan from the failed-analysis list (image file is kept on disk)."""
    sess = db.query(ScanSession).filter(ScanSession.id == scan_session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Scan session not found")
    if sess.status != "failed":
        raise HTTPException(status_code=400, detail="Only failed scans can be dismissed here")
    db.delete(sess)
    db.commit()


@router.get("/pending/{scan_session_id}")
def get_pending_scan(scan_session_id: str, db: Session = Depends(get_db)):
    """Retrieve items that were created but not yet confirmed in a scan session."""
    items = db.query(Item).filter(
        Item.scan_session_id == scan_session_id,
        Item.confidence_score < 0.8,
    ).all()
    return {"scan_session_id": scan_session_id, "low_confidence_items": items}


@router.get("/{scan_session_id}", response_model=ScanStatusResponse)
def get_scan_status(scan_session_id: str, db: Session = Depends(get_db)):
    """Poll a scan session: returns status and, when ready, the result.

    Declared after /pending/{...} so the more specific route matches first.
    """
    sess = db.query(ScanSession).filter(ScanSession.id == scan_session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Scan session not found")

    image_url = get_storage_url(os.path.basename(sess.image_path)) if sess.image_path else None
    result = ScanResult(**sess.result) if sess.result else None

    return ScanStatusResponse(
        scan_session_id=sess.id,
        status=sess.status,
        image_url=image_url,
        result=result,
        error=sess.error,
    )
