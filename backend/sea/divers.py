"""Divers have no accounts.

The browser makes up a random token the first time it visits and sends it as
the X-Diver header. The server never stores the token itself, only a keyed
hash of it, which is enough to recognise "you released this light" and "you
already answered this one" without being able to link a diver to anything.
"""

import hashlib
import hmac
import re

from django.conf import settings

HEADER = "HTTP_X_DIVER"
TOKEN = re.compile(r"^[A-Za-z0-9_-]{16,64}$")


def fingerprint(token: str) -> str:
    key = settings.SECRET_KEY.encode()
    return hmac.new(key, token.encode(), hashlib.sha256).hexdigest()[:40]


def from_request(request) -> str | None:
    token = request.META.get(HEADER, "")
    if not TOKEN.match(token):
        return None
    return fingerprint(token)
