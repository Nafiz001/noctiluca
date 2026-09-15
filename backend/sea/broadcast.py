from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

GROUP = "sea"


def to_sea(event: dict):
    """Send an event to every diver, once the current transaction commits."""

    def send():
        layer = get_channel_layer()
        if layer is not None:
            async_to_sync(layer.group_send)(GROUP, {"type": "sea.event", "event": event})

    transaction.on_commit(send)
