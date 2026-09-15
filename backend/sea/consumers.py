"""The live sea.

Every diver holds one websocket. Through it they learn who else is in the
water and where, and hear about lights being released and answered. The only
thing a diver sends is their own position.

    server -> diver   {"type": "hello", "you": id, "divers": [...]}
                      {"type": "diver.moved", "diver": {id, depth, x}}
                      {"type": "diver.left", "id": id}
                      {"type": "light.released", "light": {...}}
                      {"type": "light.answered", "light": {id, energy, answers, dark_at}}
                      {"type": "light.hidden", "id": id}
    diver -> server   {"type": "move", "depth": metres, "x": -1..1}
"""

import math
import secrets
import time

from channels.generic.websocket import AsyncJsonWebsocketConsumer

from . import presence
from .broadcast import GROUP
from .models import CHALLENGER_DEEP

# Positions arrive at most this often per diver; anything faster is dropped.
MOVE_INTERVAL = 0.15


class SeaConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.diver = presence.Diver(id=secrets.token_urlsafe(6))
        self.last_move = 0.0

        await self.channel_layer.group_add(GROUP, self.channel_name)
        await self.accept()

        await self.send_json(
            {"type": "hello", "you": self.diver.id, "divers": presence.everyone(excluding=self.channel_name)}
        )
        presence.join(self.channel_name, self.diver)
        await self._tell_others({"type": "diver.moved", "diver": self.diver.public()})

    async def disconnect(self, code):
        await self.channel_layer.group_discard(GROUP, self.channel_name)
        if presence.leave(self.channel_name) is not None:
            await self._tell_others({"type": "diver.left", "id": self.diver.id})

    async def receive_json(self, content, **kwargs):
        if not isinstance(content, dict) or content.get("type") != "move":
            return

        now = time.monotonic()
        if now - self.last_move < MOVE_INTERVAL:
            return

        depth, x = content.get("depth"), content.get("x", 0)
        if not _finite(depth) or not _finite(x):
            return

        self.last_move = now
        self.diver.depth = round(max(0.0, min(float(CHALLENGER_DEEP), float(depth))), 1)
        self.diver.x = round(max(-1.0, min(1.0, float(x))), 3)
        await self._tell_others({"type": "diver.moved", "diver": self.diver.public()})

    async def sea_event(self, message):
        if message.get("skip") == self.channel_name:
            return
        await self.send_json(message["event"])

    async def _tell_others(self, event):
        await self.channel_layer.group_send(
            GROUP, {"type": "sea.event", "event": event, "skip": self.channel_name}
        )


def _finite(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
