"""ScanSession model — tracks the lifecycle of an async AI scan job.

A scan is uploaded and processed independently of the requesting HTTP
connection: the upload endpoint enqueues a background task and returns
immediately with the session id; the frontend polls for completion.
This row is the persistence point for that workflow, so a scan survives
gateway timeouts, client disconnects, and refreshes.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from app.database import Base


class ScanSession(Base):
    __tablename__ = "scan_sessions"

    id = Column(String(100), primary_key=True)  # UUID scan_session_id
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False, index=True)
    image_path = Column(String(1000), nullable=True)

    # pending -> processing -> completed | failed
    status = Column(String(20), default="pending", nullable=False, index=True)

    result = Column(JSON, nullable=True)   # ScanResult dict once completed
    error = Column(Text, nullable=True)     # failure message if status == failed

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<ScanSession(id={self.id}, status='{self.status}', room_id={self.room_id})>"
