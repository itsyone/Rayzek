"""Pydantic response/request schemas for the REST API and WebSocket events."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

Severity = Literal["informational", "low", "medium", "high"]
SortOrder = Literal["asc", "desc"]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------- #
# Destinations
# --------------------------------------------------------------------------- #
class DestinationOut(ORMModel):
    id: int
    ip_address: str
    hostname: str | None = None
    country_code: str | None = None
    country_name: str | None = None
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    organization: str | None = None
    asn: str | None = None
    is_private: bool = False
    first_seen: datetime
    last_seen: datetime
    observation_count: int


# --------------------------------------------------------------------------- #
# Processes
# --------------------------------------------------------------------------- #
class ProcessOut(ORMModel):
    id: int
    pid: int
    process_name: str
    executable_path: str | None = None
    username: str | None = None
    first_seen: datetime
    last_seen: datetime


class ProcessStats(ProcessOut):
    active_connections: int = 0
    unique_destinations: int = 0
    countries: int = 0
    total_observations: int = 0
    max_risk: int = 0


# --------------------------------------------------------------------------- #
# Connections
# --------------------------------------------------------------------------- #
class ConnectionOut(ORMModel):
    id: int
    pid: int | None = None
    process_name: str | None = None
    executable_path: str | None = None
    local_ip: str
    local_port: int
    remote_ip: str | None = None
    remote_port: int | None = None
    protocol: str
    connection_status: str
    hostname: str | None = None
    country_code: str | None = None
    country_name: str | None = None
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    organization: str | None = None
    asn: str | None = None
    is_new_destination: bool = False
    first_seen: datetime
    last_seen: datetime
    observation_count: int
    is_active: bool
    risk_score: int


class PaginatedConnections(BaseModel):
    items: list[ConnectionOut]
    total: int
    limit: int
    offset: int


# --------------------------------------------------------------------------- #
# Alerts
# --------------------------------------------------------------------------- #
class AlertOut(ORMModel):
    id: int
    alert_type: str
    severity: Severity
    title: str
    description: str
    process_name: str | None = None
    remote_ip: str | None = None
    destination_country: str | None = None
    evidence: dict[str, Any] | None = None
    created_at: datetime
    acknowledged: bool


# --------------------------------------------------------------------------- #
# Stats / health
# --------------------------------------------------------------------------- #
class StatsOut(BaseModel):
    active_connections: int
    active_processes: int
    unique_destinations: int
    countries_connected: int
    new_destinations_today: int
    alerts_today: int
    total_connections: int
    collector_status: str


class HealthOut(BaseModel):
    status: str
    database: str
    collector: str
    demo_mode: bool
    platform: str
    version: str
    uptime_seconds: float


class CollectorStatus(BaseModel):
    status: str
    running: bool
    demo_mode: bool
    poll_interval: float
    last_poll: datetime | None = None
    permission_limited: bool = False


# --------------------------------------------------------------------------- #
# Settings
# --------------------------------------------------------------------------- #
class SettingItem(BaseModel):
    key: str
    value: str


class SettingsUpdate(BaseModel):
    settings: dict[str, str] = Field(default_factory=dict)


# --------------------------------------------------------------------------- #
# WebSocket envelope
# --------------------------------------------------------------------------- #
class WSEvent(BaseModel):
    type: str
    timestamp: str
    data: dict[str, Any]
