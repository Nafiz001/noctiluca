from django.contrib import admin
from django.utils import timezone

from . import broadcast
from .models import Creature, Light


@admin.register(Light)
class LightAdmin(admin.ModelAdmin):
    list_display = ["message", "depth", "wavelength", "answers", "glowing", "hidden", "created_at"]
    list_filter = ["hidden"]
    search_fields = ["message"]
    readonly_fields = ["id", "diver", "dark_at", "energy", "energy_at", "answers", "created_at"]
    actions = ["hide", "unhide"]

    @admin.display(boolean=True)
    def glowing(self, light):
        return light.is_glowing(timezone.now())

    @admin.action(description="Hide selected lights")
    def hide(self, request, queryset):
        ids = list(queryset.values_list("id", flat=True))
        queryset.update(hidden=True)
        for light_id in ids:
            broadcast.to_sea({"type": "light.hidden", "id": light_id})

    @admin.action(description="Show selected lights again")
    def unhide(self, request, queryset):
        queryset.update(hidden=False)


@admin.register(Creature)
class CreatureAdmin(admin.ModelAdmin):
    list_display = ["name", "latin_name", "depth_min", "depth_max", "wavelength"]
