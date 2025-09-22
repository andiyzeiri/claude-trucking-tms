from sqlalchemy import Column, DateTime, Integer
from sqlalchemy.sql import func
from app.database import Base as DatabaseBase


class Base(DatabaseBase):
    __abstract__ = True

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())