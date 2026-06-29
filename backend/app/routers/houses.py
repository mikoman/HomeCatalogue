"""CRUD router for Houses."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.house import House
from app.schemas.house import HouseCreate, HouseUpdate, HouseRead

router = APIRouter(prefix="/api/houses", tags=["houses"])


@router.get("/", response_model=List[HouseRead])
def list_houses(db: Session = Depends(get_db)):
    return db.query(House).order_by(House.name).all()


@router.post("/", response_model=HouseRead, status_code=201)
def create_house(data: HouseCreate, db: Session = Depends(get_db)):
    house = House(**data.model_dump())
    db.add(house)
    db.commit()
    db.refresh(house)
    return house


@router.get("/{house_id}", response_model=HouseRead)
def get_house(house_id: int, db: Session = Depends(get_db)):
    house = db.query(House).filter(House.id == house_id).first()
    if not house:
        raise HTTPException(status_code=404, detail="House not found")
    return house


@router.put("/{house_id}", response_model=HouseRead)
def update_house(house_id: int, data: HouseUpdate, db: Session = Depends(get_db)):
    house = db.query(House).filter(House.id == house_id).first()
    if not house:
        raise HTTPException(status_code=404, detail="House not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(house, key, value)
    db.commit()
    db.refresh(house)
    return house


@router.delete("/{house_id}", status_code=204)
def delete_house(house_id: int, db: Session = Depends(get_db)):
    house = db.query(House).filter(House.id == house_id).first()
    if not house:
        raise HTTPException(status_code=404, detail="House not found")
    db.delete(house)
    db.commit()
