from django.urls import path

from .consumers import SeaConsumer

websocket_urlpatterns = [
    path("ws/sea", SeaConsumer.as_asgi()),
]
