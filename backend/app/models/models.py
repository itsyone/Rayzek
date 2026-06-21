"""Database models for processes, destinations, connections, alerts, settings."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


class ProcessRecord(Base):
    __tablename__ = "processes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pid: Mapped[int] = mapped_column(Integer, index=True)
    process_name: Mapped[str] = mapped_column(String(256), index=True)
    executable_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    username: Mapped[str | None] = mapped_column(String(256), nullable=True)
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    last_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, index=True
    )

    connections: Mapped[list[ConnectionRecord]] = relationship(
        back_populates="process", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("pid", "process_name", name="uq_process_pid_name"),
    )


class Destination(Base):
    __tablename__ = "destinations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ip_address: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    hostname: Mapped[str | None] = mapped_column(String(512), nullable=True)
    country_code: Mapped[str | None] = mapped_column(String(4), nullable=True, index=True)
    country_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    city: Mapped[str | None] = mapped_column(String(128), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    organization: Mapped[str | None] = mapped_column(String(256), nullable=True)
    asn: Mapped[str | None] = mapped_column(String(128), nullable=True)
    is_private: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    enriched: Mapped[bool] = mapped_column(Boolean, default=False)
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    last_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, index=True
    )
    observation_count: Mapped[int] = mapped_column(Integer, default=1)

    connections: Mapped[list[ConnectionRecord]] = relationship(back_populates="destination")


class ConnectionRecord(Base):
    __tablename__ = "connections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    process_id: Mapped[int | None] = mapped_column(
        ForeignKey("processes.id", ondelete="CASCADE"), nullable=True, index=True
    )
    destination_id: Mapped[int | None] = mapped_column(
        ForeignKey("destinations.id"), nullable=True, index=True
    )

    local_ip: Mapped[str] = mapped_column(String(64))
    local_port: Mapped[int] = mapped_column(Integer)
    remote_ip: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    remote_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    protocol: Mapped[str] = mapped_column(String(8), default="TCP", index=True)
    connection_status: Mapped[str] = mapped_column(String(32), default="NONE", index=True)

    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    last_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, index=True
    )
    observation_count: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    risk_score: Mapped[int] = mapped_column(Integer, default=0, index=True)

    process: Mapped[ProcessRecord | None] = relationship(back_populates="connections")
    destination: Mapped[Destination | None] = relationship(back_populates="connections")

    __table_args__ = (
        Index("ix_conn_identity", "process_id", "local_port", "remote_ip", "remote_port"),
    )


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    alert_type: Mapped[str] = mapped_column(String(64), index=True)
    severity: Mapped[str] = mapped_column(String(16), default="informational", index=True)
    title: Mapped[str] = mapped_column(String(256))
    description: Mapped[str] = mapped_column(Text)
    process_name: Mapped[str | None] = mapped_column(String(256), nullable=True, index=True)
    remote_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    destination_country: Mapped[str | None] = mapped_column(String(128), nullable=True)
    evidence: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON-encoded
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, index=True
    )
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False, index=True)


class ApplicationSetting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )
