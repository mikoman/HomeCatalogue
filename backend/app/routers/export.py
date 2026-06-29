"""Export a house's catalogue as CSV or JSON — backup, insurance, moving."""

import csv
import io
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.house import House
from app.models.room import Room
from app.models.container import Container
from app.models.item import Item

router = APIRouter(prefix="/api/export", tags=["export"])


def compose_container_paths(containers) -> dict[int, str]:
    """Map container id -> 'Parent / Child' path. Pure: `containers` is any
    iterable of objects with .id, .name, .parent_id."""
    by_id = {c.id: c for c in containers}
    cache: dict[int, str] = {}

    def path(cid):
        if cid is None:
            return ""
        if cid in cache:
            return cache[cid]
        c = by_id.get(cid)
        if not c:
            return ""
        cache[cid] = c.name  # seed before recursing so a cycle can't loop forever
        parent = path(c.parent_id)
        cache[cid] = f"{parent} / {c.name}" if parent else c.name
        return cache[cid]

    return {c.id: path(c.id) for c in containers}


def _container_path_resolver(db: Session, house_id: int):
    """Return a fn mapping container_id -> path string within a house."""
    rows = (
        db.query(Container)
        .join(Room, Container.room_id == Room.id)
        .filter(Room.house_id == house_id)
        .all()
    )
    paths = compose_container_paths(rows)
    return lambda cid: paths.get(cid, "") if cid is not None else ""


@router.get("")
def export_catalogue(
    house_id: int = Query(...),
    format: str = Query("csv", pattern="^(csv|json)$"),
    db: Session = Depends(get_db),
):
    house = db.query(House).filter(House.id == house_id).first()
    if not house:
        raise HTTPException(status_code=404, detail="House not found")

    rows = (
        db.query(Item, Room)
        .join(Room, Item.room_id == Room.id)
        .filter(Room.house_id == house_id)
        .order_by(Room.name, Item.name)
        .all()
    )
    path_of = _container_path_resolver(db, house_id)
    safe = (house.name or "catalogue").replace("/", "-").replace(" ", "_")

    if format == "json":
        rooms: dict[int, dict] = {}
        for item, room in rows:
            r = rooms.setdefault(room.id, {"room": room.name, "items": []})
            r["items"].append({
                "name": item.name,
                "category": item.category,
                "container": path_of(item.container_id),
                "tags": item.tags or [],
                "notes": item.notes or "",
                "date_added": item.date_added.isoformat() if item.date_added else None,
            })
        body = json.dumps({"house": house.name, "rooms": list(rooms.values())}, indent=2)
        return Response(
            content=body,
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{safe}.json"'},
        )

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["house", "room", "container", "item", "category", "tags", "notes", "date_added"])
    for item, room in rows:
        w.writerow([
            house.name,
            room.name,
            path_of(item.container_id),
            item.name,
            item.category or "",
            ", ".join(item.tags or []),
            item.notes or "",
            item.date_added.isoformat() if item.date_added else "",
        ])
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{safe}.csv"'},
    )
