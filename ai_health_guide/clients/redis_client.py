"""Redis session store — read, write, and TTL-managed session persistence."""

import json
from typing import Optional

import redis.asyncio as aioredis

from ai_health_guide.models.session import SessionState

SESSION_TTL = 7200  # 2 hours in seconds
KEY_PREFIX  = "session:"


class RedisSessionClient:
    def __init__(self, url: str, password: str = "") -> None:
        self._redis = aioredis.from_url(
            url,
            password=password or None,
            encoding="utf-8",
            decode_responses=True,
        )

    async def save(self, session: SessionState) -> None:
        """Persist the session state and reset its TTL."""
        key  = f"{KEY_PREFIX}{session.session_id}"
        data = session.model_dump_json()
        await self._redis.setex(key, SESSION_TTL, data)

    async def load(self, session_id: str) -> Optional[SessionState]:
        """Load a session by ID. Returns None if the session has expired or doesn't exist."""
        key  = f"{KEY_PREFIX}{session_id}"
        data = await self._redis.get(key)
        if data is None:
            return None
        return SessionState.model_validate_json(data)

    async def delete(self, session_id: str) -> None:
        """Delete a session from Redis."""
        await self._redis.delete(f"{KEY_PREFIX}{session_id}")

    async def ping(self) -> bool:
        """Health check — returns True if Redis is reachable."""
        try:
            return await self._redis.ping()
        except Exception:
            return False
