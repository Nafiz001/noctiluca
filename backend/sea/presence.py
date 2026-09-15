"""Who is in the water right now.

Presence is kept in the memory of the process serving the websockets. That is
exact for a single ASGI process, which is how noctiluca is meant to run. With
several processes behind a Redis channel layer each process only counts its
own divers, but clients still see everyone, because every movement is
broadcast through the layer.
"""

from dataclasses import asdict, dataclass


@dataclass
class Diver:
    id: str
    depth: float = 0.0
    x: float = 0.0

    def public(self) -> dict:
        return asdict(self)


_divers: dict[str, Diver] = {}


def join(channel: str, diver: Diver):
    _divers[channel] = diver


def leave(channel: str) -> Diver | None:
    return _divers.pop(channel, None)


def get(channel: str) -> Diver | None:
    return _divers.get(channel)


def everyone(excluding: str | None = None) -> list[dict]:
    return [d.public() for ch, d in _divers.items() if ch != excluding]


def count() -> int:
    return len(_divers)


def clear():
    _divers.clear()
