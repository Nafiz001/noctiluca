"""What a light may say.

Lights are anonymous and permanent until they fade, so the one thing they must
not carry is a way to find someone: no links, no email addresses, no phone
numbers, no handles. Anything else is left to the admin, who can hide a light.
"""

import re

from django.core.exceptions import ValidationError

MAX_LENGTH = 180

_LINK = re.compile(r"(https?://|www\.|\b[a-z0-9-]+\.(com|net|org|io|app|dev|ly|gg|xyz)\b)", re.I)
_EMAIL = re.compile(r"[^\s@]+@[^\s@]+\.[^\s@]+")
_PHONE = re.compile(r"(?:\+?\d[\s().-]*){9,}")
_HANDLE = re.compile(r"(?:^|\s)@[A-Za-z0-9_.]{2,}")
_REPEAT = re.compile(r"(.)\1{7,}")
_SPACE = re.compile(r"\s+")


def clean_message(text: str) -> str:
    text = _SPACE.sub(" ", text or "").strip()
    if not text:
        raise ValidationError("Write something for the light to carry.")
    if len(text) > MAX_LENGTH:
        raise ValidationError(f"A light carries at most {MAX_LENGTH} characters.")
    if _LINK.search(text) or _EMAIL.search(text):
        raise ValidationError("Lights can't carry links or email addresses.")
    if _PHONE.search(text) or _HANDLE.search(text):
        raise ValidationError("Lights can't carry phone numbers or handles.")
    if _REPEAT.search(text):
        raise ValidationError("That looks like a key held down.")
    return text
