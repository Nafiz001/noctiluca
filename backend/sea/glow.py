"""How a light fades.

A light is released with an energy of 1.0 and loses half of it every
HALF_LIFE. Each answer adds BOOST, up to MAX_ENERGY. Once the energy falls
below DARK the light has gone dark and is no longer shown.

Because the decay is a plain exponential, the moment a light goes dark is
known the instant its energy changes. That moment is stored on the row as
`dark_at`, so "which lights are still glowing" is an indexed range query
instead of a computation over every light ever released.
"""

import math
from datetime import datetime, timedelta

HALF_LIFE = timedelta(hours=72)
BOOST = 0.35
MAX_ENERGY = 3.0
RELEASE_ENERGY = 1.0
DARK = 0.04


def decay(energy: float, elapsed: timedelta) -> float:
    if elapsed <= timedelta(0):
        return energy
    return energy * 0.5 ** (elapsed / HALF_LIFE)


def dark_at(energy: float, since: datetime) -> datetime:
    if energy <= DARK:
        return since
    return since + HALF_LIFE * math.log2(energy / DARK)


def boosted(energy: float) -> float:
    return min(MAX_ENERGY, energy + BOOST)
