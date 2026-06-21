"""Tests for the demo source and permission-error resilience."""

from unittest.mock import patch

import psutil

from app.collectors.demo_source import DemoConnectionSource
from app.collectors.system_source import SystemConnectionSource


def test_demo_source_produces_connections():
    src = DemoConnectionSource(seed=1)
    conns, limited = src.poll()
    assert limited is False
    assert len(conns) > 0
    sample = conns[0]
    assert sample.process_name
    assert sample.protocol == "TCP"


def test_system_source_handles_access_denied():
    src = SystemConnectionSource()
    with patch("psutil.net_connections", side_effect=psutil.AccessDenied()):
        conns, limited = src.poll()
    assert conns == []
    assert limited is True


def test_system_source_handles_oserror():
    src = SystemConnectionSource()
    with patch("psutil.net_connections", side_effect=OSError("boom")):
        conns, limited = src.poll()
    assert conns == []
    assert limited is True


def test_process_info_handles_missing_process():
    src = SystemConnectionSource()
    with patch("psutil.Process", side_effect=psutil.NoSuchProcess(1234)):
        name, exe, user = src._process_info(1234)
    assert name == "pid-1234"
    assert exe is None
