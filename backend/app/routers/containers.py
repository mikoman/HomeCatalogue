"""CRUD router for Containers."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.container import Container
from app.schemas.container import ContainerCreate, ContainerUpdate, ContainerRead

router = APIRouter(prefix="/api/containers", tags=["containers"])


@router.get("/", response_model=List[ContainerRead])
def list_containers(room_id: int, parent_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(Container).filter(Container.room_id == room_id)
    if parent_id is not None:
        query = query.filter(Container.parent_id == parent_id)
    else:
        query = query.filter(Container.parent_id.is_(None))
    return query.order_by(Container.name).all()


@router.post("/", response_model=ContainerRead, status_code=201)
def create_container(data: ContainerCreate, db: Session = Depends(get_db)):
    from app.models.room import Room
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
