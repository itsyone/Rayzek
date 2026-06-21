"""Process-wide runtime registry for shared singletons."""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.services.collector import CollectorService


@dataclass
class Runtime:
    collector: CollectorService | None = None
    start_time: float = time.monotonic()

    @property
    def uptime_seconds(self) -> float:
        return time.monotonic() - self.start_time


runtime = Runtime()
