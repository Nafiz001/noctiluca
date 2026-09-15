import random
import secrets
import string

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from . import glow

CHALLENGER_DEEP = 10_935
WAVELENGTH_MIN = 440
WAVELENGTH_MAX = 710

_ID_ALPHABET = string.ascii_lowercase + string.digits


def new_light_id() -> str:
    return "".join(secrets.choice(_ID_ALPHABET) for _ in range(10))


def random_drift() -> float:
    return random.uniform(-1.0, 1.0)


def random_phase() -> float:
    return random.random()


class LightQuerySet(models.QuerySet):
    def glowing(self, now=None):
        return self.filter(hidden=False, dark_at__gt=now or timezone.now())

    def between(self, top: int, bottom: int):
        return self.filter(depth__gte=top, depth__lte=bottom)


class Light(models.Model):
    """A message somebody left in the water, at the depth they wrote it."""

    id = models.CharField(primary_key=True, max_length=10, default=new_light_id, editable=False)
    message = models.CharField(max_length=180)
    wavelength = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(WAVELENGTH_MIN), MaxValueValidator(WAVELENGTH_MAX)],
        help_text="Colour of the light, in nanometres.",
    )
    depth = models.PositiveIntegerField(
        validators=[MaxValueValidator(CHALLENGER_DEEP)],
        help_text="Metres below the surface.",
    )
    # Where in the water column the light hangs, so every diver sees it in the
    # same place: drift is a horizontal offset in [-1, 1], phase offsets its
    # flicker.
    drift = models.FloatField(default=random_drift)
    phase = models.FloatField(default=random_phase)

    energy = models.FloatField(default=glow.RELEASE_ENERGY)
    energy_at = models.DateTimeField(default=timezone.now)
    dark_at = models.DateTimeField(db_index=True, editable=False)

    answers = models.PositiveIntegerField(default=0)
    diver = models.CharField(max_length=40, editable=False, help_text="Fingerprint of who released it.")
    hidden = models.BooleanField(default=False, help_text="Hidden lights are never shown.")
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    objects = LightQuerySet.as_manager()

    class Meta:
        indexes = [models.Index(fields=["depth", "dark_at"])]
        ordering = ["depth"]

    def __str__(self):
        return f"{self.depth} m: {self.message[:40]}"

    def save(self, *args, **kwargs):
        if self.dark_at is None:
            self.dark_at = glow.dark_at(self.energy, self.energy_at)
        super().save(*args, **kwargs)

    def energy_now(self, now=None) -> float:
        return glow.decay(self.energy, (now or timezone.now()) - self.energy_at)

    def is_glowing(self, now=None) -> bool:
        return not self.hidden and self.dark_at > (now or timezone.now())

    def receive_answer(self, now=None):
        now = now or timezone.now()
        self.energy = glow.boosted(self.energy_now(now))
        self.energy_at = now
        self.dark_at = glow.dark_at(self.energy, now)
        self.answers += 1


class Answer(models.Model):
    """One diver answering one light. A diver can answer a light once."""

    light = models.ForeignKey(Light, on_delete=models.CASCADE, related_name="answer_set")
    diver = models.CharField(max_length=40)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["light", "diver"], name="one_answer_per_diver")]


class Creature(models.Model):
    """Real animals of the water column, placed at the depths they live."""

    slug = models.SlugField(primary_key=True)
    name = models.CharField(max_length=80)
    latin_name = models.CharField(max_length=80)
    depth_min = models.PositiveIntegerField()
    depth_max = models.PositiveIntegerField()
    home = models.PositiveIntegerField(help_text="The depth the dive shows it at.")
    wavelength = models.PositiveSmallIntegerField(null=True, blank=True)
    note = models.TextField()
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return self.name
