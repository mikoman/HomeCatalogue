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
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.models.container import Container
from app.models.item import Item
from app.models.room import Room
from app.models.house import House
from app.models.scan_session import ScanSession
from app.schemas.item import ItemCreate
from app.schemas.scan import (
    ScanResult, ScanUploadResponse, ScanStatusResponse, FailedScanRead,
    ScanAcceptRequest, ScanAcceptResponse,
)
from app.services.ai_vision import process_image_with_ai
from app.services.embeddings import index_saved_items
from app.storage import save_upload, get_storage_url

router = APIRouter(prefix="/api/scan", tags=["scan"])


def _existing_upload_response(session: ScanSession, room_id: int, container_id: int | None) -> ScanUploadResponse:
    if session.room_id != room_id or session.container_id != container_id:
        raise HTTPException(status_code=409, detail="This upload request belongs to another destination. Start a new upload for this destination.")
    return ScanUploadResponse(scan_session_id=session.id, status=session.status)


@router.post("/upload", response_model=ScanUploadResponse)
async def upload_and_scan(
    background_tasks: BackgroundTasks,
    room_id: int = Form(...),
    image: UploadFile = File(...),
    container_id: int | None = Form(None),
    request_id: uuid.UUID | None = Form(None),
    db: Session = Depends(get_db),
):
    """Upload an image and enqueue async AI analysis.

    Returns immediately with a scan_session_id. Poll
    GET /api/scan/{scan_session_id} for the result.
    """
    scan_session_id = str(request_id or uuid.uuid4())
    existing = db.get(ScanSession, scan_session_id)
    if existing is not None:
        return _existing_upload_response(existing, room_id, container_id)

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
    filename = f"{scan_session_id}_{uuid.uuid4()}.jpg"
    file_path = await run_in_threadpool(save_upload, image, filename)

    # Persist the session row so its lifecycle survives disconnects/refreshes
    session = ScanSession(
        id=scan_session_id,
        room_id=room_id,
        container_id=container_id,
        image_path=file_path,
        status="pending",
    )
    try:
        db.add(session)
        db.commit()
    except IntegrityError:
        db.rollback()
        Path(file_path).unlink(missing_ok=True)
        existing = db.get(ScanSession, scan_session_id)
        if existing is not None:
            return _existing_upload_response(existing, room_id, container_id)
        raise
    except Exception:
        db.rollback()
        Path(file_path).unlink(missing_ok=True)
        raise

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
    if not _claim_scan(scan_session_id):
        return

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
            error=_scan_error_message(exc),
            completed_at=datetime.utcnow(),
        )


def _scan_error_message(exc: Exception) -> str:
    """Return a useful error without exposing provider keys or request headers."""
    from app.services.openrouter import OpenRouterError

    if isinstance(exc, OpenRouterError):
        return str(exc)
    name = type(exc).__name__
    if name in {"AuthenticationError", "PermissionDeniedError"}:
        return "The AI service rejected its credentials. Check the provider settings, then retry."
    if "Timeout" in name:
        return "The AI service did not respond in time. Check the model, then retry."
    if name in {"ConnectError", "APIConnectionError", "ConnectionError"}:
        return "Cannot connect to the AI service. Check its address and confirm that it is running."
    if isinstance(exc, ValueError):
        return "The AI service returned an invalid inventory. Retry the scan or choose another vision model."
    return "The image analysis failed. Check the AI service and selected vision model, then retry."


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


def _claim_scan(scan_session_id: str) -> bool:
    """Start each queued scan once, including duplicate task deliveries."""
    with SessionLocal() as db:
        changed = db.query(ScanSession).filter(
            ScanSession.id == scan_session_id,
            ScanSession.status == "pending",
        ).update({ScanSession.status: "processing"}, synchronize_session=False)
        db.commit()
        return bool(changed)


def recover_interrupted_scans() -> int:
    """Make interrupted scans available for retry after the server restarts."""
    with SessionLocal() as db:
        changed = db.query(ScanSession).filter(
            ScanSession.status.in_(["pending", "processing"])
        ).update({
            ScanSession.status: "failed",
            ScanSession.error: "The server restarted before this scan finished. Retry the scan to continue.",
            ScanSession.completed_at: datetime.utcnow(),
        }, synchronize_session=False)
        db.commit()
        return changed


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
    if db.query(Item.id).filter(Item.scan_session_id == sess.id).first():
        raise HTTPException(status_code=409, detail="This scan already contains saved items. Start a new scan to analyze another photo.")
    if not sess.image_path or not os.path.isfile(sess.image_path):
        raise HTTPException(status_code=400, detail="Original image no longer available")

    changed = db.query(ScanSession).filter(
        ScanSession.id == scan_session_id,
        ScanSession.status.in_(["failed", "completed"]),
    ).update({
        ScanSession.status: "pending",
        ScanSession.error: None,
        ScanSession.result: None,
        ScanSession.completed_at: None,
    }, synchronize_session=False)
    if not changed:
        db.rollback()
        raise HTTPException(status_code=409, detail="This scan is already processing or saved.")
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
        room_id=sess.room_id,
        container_id=sess.container_id,
        result_revision=_result_revision(sess),
        image_url=image_url,
        result=None,
        error=None,
    )


@router.delete("/{scan_session_id}", status_code=204)
def dismiss_failed_scan(scan_session_id: str, db: Session = Depends(get_db)):
    """Discard a finished scan. Retain its photo on disk."""
    sess = db.query(ScanSession).filter(ScanSession.id == scan_session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Scan session not found")
    if sess.status not in {"failed", "completed"}:
        raise HTTPException(status_code=400, detail="Only failed or unsaved completed scans can be discarded.")
    removed = db.query(ScanSession).filter(
        ScanSession.id == scan_session_id,
        ScanSession.status.in_(["failed", "completed"]),
    ).delete(synchronize_session=False)
    if not removed:
        db.rollback()
        raise HTTPException(status_code=409, detail="This scan changed. Reload it before discarding it.")
    db.commit()


@router.get("/pending/{scan_session_id}")
def get_pending_scan(scan_session_id: str, db: Session = Depends(get_db)):
    """Retrieve items that were created but not yet confirmed in a scan session."""
    items = db.query(Item).filter(
        Item.scan_session_id == scan_session_id,
        Item.confidence_score < 0.8,
    ).all()
    return {"scan_session_id": scan_session_id, "low_confidence_items": items}


def _result_revision(sess: ScanSession) -> str | None:
    version = sess.completed_at or sess.created_at
    if sess.status in {"pending", "processing"}:
        version = sess.updated_at or version
    return version.isoformat() if version is not None else None


def _status_response(sess: ScanSession) -> ScanStatusResponse:
    return ScanStatusResponse(
        scan_session_id=sess.id,
        status=sess.status,
        room_id=sess.room_id,
        container_id=sess.container_id,
        result_revision=_result_revision(sess),
        image_url=get_storage_url(os.path.basename(sess.image_path)) if sess.image_path else None,
        result=ScanResult(**sess.result) if sess.result else None,
        error=sess.error,
    )


@router.get("/active", response_model=list[ScanStatusResponse])
def list_active_scans(room_id: int, db: Session = Depends(get_db)):
    """Return unfinished and unsaved scans for a room."""
    already_saved = db.query(Item.id).filter(Item.scan_session_id == ScanSession.id).exists()
    rows = db.query(ScanSession).filter(
        ScanSession.room_id == room_id,
        ScanSession.status.in_(["pending", "processing", "completed"]),
        ~already_saved,
    ).order_by(ScanSession.created_at).all()
    return [_status_response(sess) for sess in rows]


def _acceptance_receipt(sess: ScanSession, already_filed: bool) -> ScanAcceptResponse:
    receipt = (sess.result or {}).get("acceptance", {})
    return ScanAcceptResponse(
        scan_session_id=sess.id,
        item_ids=receipt.get("item_ids", []),
        container_ids=receipt.get("container_ids", []),
        already_filed=already_filed,
    )


def _check_review_context(sess: ScanSession, data: ScanAcceptRequest) -> None:
    if data.room_id is not None and data.room_id != sess.room_id:
        raise HTTPException(status_code=409, detail="This scan moved to another room. Open that room before saving.")
    if data.expected_revision is not None and data.expected_revision != _result_revision(sess):
        raise HTTPException(status_code=409, detail="This scan has a new result. Reload the review before saving.")


@router.post("/{scan_session_id}/accept", response_model=ScanAcceptResponse)
def accept_scan(
    scan_session_id: str,
    data: ScanAcceptRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Save reviewed containers and items once in one transaction."""
    sess = db.query(ScanSession).filter(ScanSession.id == scan_session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Scan session not found")
    _check_review_context(sess, data)
    if sess.status == "filed":
        return _acceptance_receipt(sess, already_filed=True)
    if sess.status != "completed":
        raise HTTPException(status_code=409, detail="Wait until this scan finishes before saving it.")
    if not db.query(Room.id).filter(Room.id == sess.room_id).first():
        raise HTTPException(status_code=404, detail="Room not found")
    if db.query(Item.id).filter(Item.scan_session_id == sess.id).first():
        db.refresh(sess)
        _check_review_context(sess, data)
        if sess.status == "filed":
            return _acceptance_receipt(sess, already_filed=True)
        raise HTTPException(status_code=409, detail="This scan already contains saved items. Review them in the room.")

    existing = {row.id: row for row in db.query(Container).filter(Container.room_id == sess.room_id).all()}
    count = len(data.containers)
    for index, container in enumerate(data.containers):
        if container.parent_id is not None and container.parent_id not in existing:
            raise HTTPException(status_code=400, detail="Each parent container must belong to this room.")
        if container.proposed_parent_index is not None and container.proposed_parent_index >= count:
            raise HTTPException(status_code=400, detail="A proposed parent container does not exist.")
        visited = {index}
        parent = container.proposed_parent_index
        while parent is not None:
            if parent >= count or parent in visited:
                raise HTTPException(status_code=400, detail="Proposed containers cannot contain a parent cycle.")
            visited.add(parent)
            parent = data.containers[parent].proposed_parent_index

    validated_items = []
    for item in data.items:
        if item.container_id is not None and item.container_id not in existing:
            raise HTTPException(status_code=400, detail="Each item container must belong to this room.")
        if item.proposed_container_index is not None and item.proposed_container_index >= count:
            raise HTTPException(status_code=400, detail="An item refers to a proposed container that does not exist.")
        payload = item.model_dump(exclude={"proposed_container_index"})
        payload.update(
            room_id=sess.room_id,
            scan_session_id=sess.id,
            image_path=os.path.basename(sess.image_path) if sess.image_path else None,
        )
        try:
            validated_items.append(ItemCreate(**payload))
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail=exc.errors(include_context=False, include_input=False)) from exc

    try:
        claimed = db.query(ScanSession).filter(
            ScanSession.id == sess.id, ScanSession.status == "completed",
            ScanSession.room_id == sess.room_id,
            ScanSession.completed_at == sess.completed_at,
        ).update({ScanSession.status: "filing"}, synchronize_session=False)
        if not claimed:
            db.rollback()
            current = db.get(ScanSession, scan_session_id)
            if current is None:
                raise HTTPException(status_code=404, detail="Scan session not found")
            _check_review_context(current, data)
            if current.status == "filed":
                return _acceptance_receipt(current, already_filed=True)
            raise HTTPException(status_code=409, detail="This scan changed. Reload it before saving.")

        room_exists = db.query(Room.id).filter(Room.id == sess.room_id).first()
        destination_ids = {item.container_id for item in data.items if item.container_id is not None}
        destination_ids.update(container.parent_id for container in data.containers if container.parent_id is not None)
        valid_ids = {
            row.id for row in db.query(Container.id).filter(
                Container.id.in_(destination_ids), Container.room_id == sess.room_id,
            ).all()
        }
        if not room_exists or valid_ids != destination_ids:
            raise HTTPException(status_code=409, detail="The destination changed. Reload the room before saving.")

        created_containers: dict[int, Container] = {}
        remaining = set(range(count))
        while remaining:
            for index in sorted(remaining):
                proposed = data.containers[index]
                parent_index = proposed.proposed_parent_index
                if parent_index is not None and parent_index not in created_containers:
                    continue
                parent_id = created_containers[parent_index].id if parent_index is not None else proposed.parent_id
                container = Container(
                    room_id=sess.room_id,
                    parent_id=parent_id,
                    name=proposed.name,
                    description=proposed.description,
                )
                db.add(container)
                db.flush()
                created_containers[index] = container
                remaining.remove(index)

        saved_items = []
        for proposed, validated in zip(data.items, validated_items):
            payload = validated.model_dump()
            if proposed.proposed_container_index is not None:
                payload["container_id"] = created_containers[proposed.proposed_container_index].id
            item = Item(**payload)
            db.add(item)
            saved_items.append(item)
        db.flush()
        sess.status = "filed"
        sess.result = {
            **(sess.result or {}),
            "acceptance": {
                "item_ids": [item.id for item in saved_items],
                "container_ids": [created_containers[index].id for index in range(count)],
            },
        }
        db.commit()
        background_tasks.add_task(index_saved_items, [item.id for item in saved_items])
        return _acceptance_receipt(sess, already_filed=False)
    except Exception:
        db.rollback()
        raise


@router.get("/{scan_session_id}", response_model=ScanStatusResponse)
def get_scan_status(scan_session_id: str, db: Session = Depends(get_db)):
    """Poll a scan session: returns status and, when ready, the result.

    Declared after /pending/{...} so the more specific route matches first.
    """
    sess = db.query(ScanSession).filter(ScanSession.id == scan_session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Scan session not found")

    return _status_response(sess)
