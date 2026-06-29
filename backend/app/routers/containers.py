"""CRUD router for Containers."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.container import Container
from app.models.room import Room
from app.models.item import Item
from app.schemas.container import ContainerCreate, ContainerUpdate, ContainerRead, ContainerMove

router = APIRouter(prefix="/api/containers", tags=["containers"])


@router.get("/", response_model=List[ContainerRead])
def list_containers(
    room_id: int,
    parent_id: int | None = None,
    include_all: bool = False,
    db: Session = Depends(get_db),
):
    """List containers in a room.

    By default only root containers (parent_id IS NULL) are returned, which is
    what the room view + tree expect. Pass `include_all=true` to get every
    container in the room regardless of nesting (used by the scan-review
    overlay, which needs the same set the AI was shown).
    """
    query = db.query(Container).filter(Container.room_id == room_id)
    if include_all:
        pass  # no parent filter — return the whole room
    elif parent_id is not None:
        query = query.filter(Container.parent_id == parent_id)
    else:
        query = query.filter(Container.parent_id.is_(None))
    return query.order_by(Container.name).all()


@router.post("/", response_model=ContainerRead, status_code=201)
def create_container(data: ContainerCreate, db: Session = Depends(get_db)):
    if not db.query(Room).filter(Room.id == data.room_id).first():
        raise HTTPException(status_code=404, detail="Room not found")
    if data.parent_id:
        parent = db.query(Container).filter(Container.id == data.parent_id).first()
        if not parent or parent.room_id != data.room_id:
            raise HTTPException(status_code=400, detail="Invalid parent container")
    container = Container(**data.model_dump())
    db.add(container)
    db.commit()
    db.refresh(container)
    return container


@router.post("/{container_id}/move", response_model=ContainerRead)
def move_container(container_id: int, data: ContainerMove, db: Session = Depends(get_db)):
    """Re-home a container and its whole subtree into another room.

    Same-house only. The moved container is detached to a root (parent_id =
    null) in the new room. All descendant containers and all items inside
    those containers are moved along (their room_id is updated to match).
    """
    container = db.query(Container).filter(Container.id == container_id).first()
    if not container:
        raise HTTPException(status_code=404, detail="Container not found")

    current_room = db.query(Room).filter(Room.id == container.room_id).first()
    target_room = db.query(Room).filter(Room.id == data.room_id).first()
    if not target_room:
        raise HTTPException(status_code=404, detail="Target room not found")

    if current_room and current_room.house_id != target_room.house_id:
        raise HTTPException(status_code=400, detail="Cannot move containers between houses")

    # No-op when moving to the same room.
    if target_room.id == container.room_id:
        return container

    # Gather the whole subtree (the container + all descendants) by walking
    # parent_id links one depth at a time.
    subtree_ids = {container.id}
    frontier = [container.id]
    while frontier:
        children = (
            db.query(Container)
            .filter(Container.parent_id.in_(frontier))
            .all()
        )
        child_ids = [c.id for c in children]
        if not child_ids:
            break
        subtree_ids.update(child_ids)
        frontier = child_ids

    # Re-home every container in the subtree.
    moved_containers = db.query(Container).filter(Container.id.in_(subtree_ids)).all()
    for c in moved_containers:
        c.room_id = target_room.id

    # Detach the moved container to a root in the new room (its old parent
    # stays in the old room). Descendants keep their internal parent chains.
    container.parent_id = None

    # Re-home all items inside any container in the subtree.
    db.query(Item).filter(Item.container_id.in_(subtree_ids)).update(
        {Item.room_id: target_room.id}, synchronize_session=False
    )

    db.commit()
    db.refresh(container)
    return container


@router.get("/{container_id}", response_model=ContainerRead)
def get_container(container_id: int, db: Session = Depends(get_db)):
    container = db.query(Container).filter(Container.id == container_id).first()
    if not container:
        raise HTTPException(status_code=404, detail="Container not found")
    return container


@router.put("/{container_id}", response_model=ContainerRead)
def update_container(container_id: int, data: ContainerUpdate, db: Session = Depends(get_db)):
    container = db.query(Container).filter(Container.id == container_id).first()
    if not container:
        raise HTTPException(status_code=404, detail="Container not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(container, key, value)
    db.commit()
    db.refresh(container)
    return container


@router.delete("/{container_id}", status_code=204)
def delete_container(container_id: int, db: Session = Depends(get_db)):
    container = db.query(Container).filter(Container.id == container_id).first()
    if not container:
        raise HTTPException(status_code=404, detail="Container not found")
    db.delete(container)
    db.commit()
