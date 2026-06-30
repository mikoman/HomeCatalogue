"""Item model — individual inventory entries."""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False, index=True)
    container_id = Column(Integer, ForeignKey("containers.id"), nullable=True, index=True)
    name = Column(String(500), nullable=False, index=True)
    category = Column(String(255), nullable=True, index=True)
    tags = Column(JSON, default=list)  # Array of strings
    image_path = Column(String(1000), nullable=True)
    scan_session_id = Column(String(100), nullable=True, index=True)  # Groups items from one scan
    confidence_score = Column(Float, nullable=True)
    bbox = Column(JSON, nullable=True)  # [x1,y1,x2,y2] normalized 0..1, from the detector
    embedding = Column(JSON, nullable=True)  # semantic-search vector; None = not indexed
    notes = Column(Text, default="")
    date_added = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    room = relationship("Room", back_populates="items")
    container = relationship("Container", back_populates="items")

    def __repr__(self):
        return f"<Item(id={self.id}, name='{self.name}', room_id={self.room_id})>"
