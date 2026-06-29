"""Container model — represents shelves, drawers, bins, etc. Supports nesting via parent_id."""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


class Container(Base):
    __tablename__ = "containers"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False, index=True)
    parent_id = Column(Integer, ForeignKey("containers.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    room = relationship("Room", back_populates="containers")
    parent = relationship("Container", remote_side=[id], backref="children")
    items = relationship("Item", back_populates="container", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Container(id={self.id}, name='{self.name}', room_id={self.room_id})>"
