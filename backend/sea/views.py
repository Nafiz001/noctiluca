from django.db import IntegrityError, transaction
from django.db.models import Max, Sum
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView

from . import broadcast, divers, presence
from .models import CHALLENGER_DEEP, Answer, Creature, Light
from .serializers import CreatureSerializer, LightSerializer, ReleaseSerializer

# More than enough for one screenful of sea; when a stretch of water is
# crowded, the lights with the longest left to live win.
LIGHTS_PER_REQUEST = 600


class ReleaseThrottle(SimpleRateThrottle):
    scope = "release"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class AnswerThrottle(ReleaseThrottle):
    scope = "answer"


def _depth_param(request, name, default):
    raw = request.query_params.get(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        raise ValidationError({name: "Depth must be a whole number of metres."}) from None
    return max(0, min(CHALLENGER_DEEP, value))


def _require_diver(request):
    diver = divers.from_request(request)
    if diver is None:
        raise ValidationError({"diver": "Send a diver token in the X-Diver header."})
    return diver


def _light_summary(light, now):
    # Broadcast payloads travel as JSON, so everything in them must already be
    # plain data; dates are formatted the way the REST API formats them.
    return {
        "id": light.id,
        "energy": round(light.energy_now(now), 4),
        "answers": light.answers,
        "dark_at": serializers.DateTimeField().to_representation(light.dark_at),
    }


class Lights(APIView):
    def get_throttles(self):
        return [ReleaseThrottle()] if self.request.method == "POST" else []

    def get(self, request):
        top = _depth_param(request, "top", 0)
        bottom = _depth_param(request, "bottom", CHALLENGER_DEEP)
        now = timezone.now()
        diver = divers.from_request(request)

        lights = list(Light.objects.glowing(now).between(top, bottom).order_by("-dark_at")[:LIGHTS_PER_REQUEST])
        lights.sort(key=lambda light: (light.depth, light.id))

        answered = set()
        if diver:
            answered = set(
                Answer.objects.filter(diver=diver, light__in=lights).values_list("light_id", flat=True)
            )
        context = {"now": now, "diver": diver, "answered": answered}
        return Response(LightSerializer(lights, many=True, context=context).data)

    def post(self, request):
        diver = _require_diver(request)
        release = ReleaseSerializer(data=request.data)
        release.is_valid(raise_exception=True)

        light = Light.objects.create(diver=diver, **release.validated_data)
        broadcast.to_sea({"type": "light.released", "light": LightSerializer(light).data})
        return Response(LightSerializer(light, context={"diver": diver}).data, status=status.HTTP_201_CREATED)


class AnswerLight(APIView):
    throttle_classes = [AnswerThrottle]

    def post(self, request, light_id):
        diver = _require_diver(request)
        now = timezone.now()

        with transaction.atomic():
            light = Light.objects.select_for_update().filter(pk=light_id).first()
            if light is None or not light.is_glowing(now):
                return Response({"detail": "This light has gone dark."}, status=status.HTTP_404_NOT_FOUND)
            if light.diver == diver:
                return Response({"detail": "You can't answer your own light."}, status=status.HTTP_409_CONFLICT)
            try:
                with transaction.atomic():
                    Answer.objects.create(light=light, diver=diver, created_at=now)
            except IntegrityError:
                return Response(
                    {"detail": "You've already answered this light."}, status=status.HTTP_409_CONFLICT
                )

            light.receive_answer(now)
            light.save(update_fields=["energy", "energy_at", "dark_at", "answers"])
            broadcast.to_sea({"type": "light.answered", "light": _light_summary(light, now)})

        context = {"now": now, "diver": diver, "answered": {light.id}}
        return Response(LightSerializer(light, context=context).data)


class Creatures(ListAPIView):
    queryset = Creature.objects.all()
    serializer_class = CreatureSerializer
    pagination_class = None


class Sea(APIView):
    def get(self, request):
        now = timezone.now()
        glowing = Light.objects.glowing(now)
        return Response(
            {
                "glowing": glowing.count(),
                "released": Light.objects.filter(hidden=False).count(),
                "answers": Light.objects.aggregate(total=Sum("answers"))["total"] or 0,
                "deepest": glowing.aggregate(deepest=Max("depth"))["deepest"],
                "divers": presence.count(),
            }
        )
