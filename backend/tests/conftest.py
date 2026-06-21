"""Pytest fixtures: isolated in-memory database and TestClient."""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_rayzek.db")
os.environ.setdefault("RAYZEK_DEMO_MODE", "true")
os.environ.setdefault("START_COLLECTOR_AUTOMATICALLY", "false")
os.environ.setdefault("GEOLOCATION_ENABLED", "false")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.session import Base


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine, expire_on_commit=False)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client():
    # Import here so env vars above are applied before settings load.
    from app.main import app

    with TestClient(app) as c:
        yield c
