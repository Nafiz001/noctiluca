from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers

from .models import CHALLENGER_DEEP, WAVELENGTH_MAX, WAVELENGTH_MIN, Creature, Light
from .moderation import clean_message


class LightSerializer(serializers.ModelSerializer):
    energy = serializers.SerializerMethodField()
    yours = serializers.SerializerMethodField()
    answered = serializers.SerializerMethodField()

    class Meta:
        model = Light
        fields = [
            "id",
            "message",
            "wavelength",
            "depth",
            "drift",
            "phase",
            "energy",
            "answers",
            "created_at",
            "dark_at",
            "yours",
            "answered",
        ]

    def get_energy(self, light):
        return round(light.energy_now(self.context.get("now") or timezone.now()), 4)

    def get_yours(self, light):
        diver = self.context.get("diver")
        return bool(diver) and light.diver == diver

    def get_answered(self, light):
        return light.id in self.context.get("answered", ())


class ReleaseSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=400, trim_whitespace=True)
    wavelength = serializers.IntegerField(min_value=WAVELENGTH_MIN, max_value=WAVELENGTH_MAX)
    depth = serializers.IntegerField(min_value=0, max_value=CHALLENGER_DEEP)

    def validate_message(self, value):
        try:
            return clean_message(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages[0]) from exc


class CreatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = Creature
        fields = ["slug", "name", "latin_name", "depth_min", "depth_max", "home", "wavelength", "note"]
