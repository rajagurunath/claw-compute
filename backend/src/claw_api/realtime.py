"""In-memory pub/sub for worker control-plane events.

v1: single-process, in-memory. v1.5: swap to Redis pub/sub for multi-instance
fan-out (see docs/network-and-orchestration.md §1.7).

Channels are typed strings — the convention is `worker:<worker_id>`.
"""

import asyncio
from collections import defaultdict
from typing import Any

_subscribers: dict[str, set[asyncio.Queue]] = defaultdict(set)


async def register(channel: str) -> asyncio.Queue:
    """Subscribe to a channel; returns a fresh queue."""
    queue: asyncio.Queue = asyncio.Queue(maxsize=64)
    _subscribers[channel].add(queue)
    return queue


async def unregister(channel: str, queue: asyncio.Queue) -> None:
    _subscribers[channel].discard(queue)
    if not _subscribers[channel]:
        _subscribers.pop(channel, None)


async def publish(channel: str, message: dict[str, Any]) -> None:
    """Best-effort fan-out. Drops messages on a full queue rather than blocking
    publishers — callers should treat publish as fire-and-forget."""
    for queue in list(_subscribers.get(channel, set())):
        try:
            queue.put_nowait(message)
        except asyncio.QueueFull:
            # Slow consumer; skip and let the next event try again.
            pass


def channel_for_worker(worker_id: str) -> str:
    return f"worker:{worker_id}"
