from django.urls import path

from . import views

urlpatterns = [
    path("sea", views.Sea.as_view(), name="sea"),
    path("lights", views.Lights.as_view(), name="lights"),
    path("lights/<str:light_id>/answer", views.AnswerLight.as_view(), name="answer"),
    path("creatures", views.Creatures.as_view(), name="creatures"),
]
