"""CRUD router for Rooms."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.room import Room
from app.schemas.room import RoomCreate, RoomUpdate, RoomRead

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


@router.get("/", response_model=List[RoomRead])
def list_rooms(house_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(Room)
    if house_id is not None:
        query = query.filter(Room.house_id == house_id)
    return query.order_by(Room.name).all()


@router.post("/", response_model=RoomRead, status_code=201)
def create_room(data: RoomCreate, db: Session = Depends(get_db)):
    # Verify house exists
    from app.models.house import House
    if not db.query(House).filter(House.id == data.house_id).first():
        raise HTTPException(status_code=404, detail="House not found")
    room = Room(**data.model_dump())
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


@router.get("/{room_id}", response_model=RoomRead)
def get_room(room_id: int, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


@router.put("/{room_id}", response_model=RoomRead)
def update_room(room_id: int, data: RoomUpdate, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(room, key, value)
    db.commit()
    db.refresh(room)
    return room


@router.delete("/{room_id}", status_code=204)
def delete_room(room_id: int, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    db.delete(room)
    db.commit()
