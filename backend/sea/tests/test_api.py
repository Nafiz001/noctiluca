import json
from datetime import timedelta
from unittest import mock

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from sea import divers, glow
from sea.models import Creature, Light

ALICE = "alice-token-0123456789"
BOB = "bob-token-0123456789ab"


def client_for(token=None):
    client = APIClient()
    if token:
        client.credentials(HTTP_X_DIVER=token)
    return client


def make_light(**fields):
    defaults = {"message": "hello", "wavelength": 470, "depth": 300, "diver": divers.fingerprint(ALICE)}
    return Light.objects.create(**{**defaults, **fields})


class ReleaseTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_release_creates_a_glowing_light(self):
        response = client_for(ALICE).post(
            "/api/lights", {"message": "  first light ", "wavelength": 480, "depth": 1200}, format="json"
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["message"], "first light")
        self.assertTrue(response.data["yours"])
        self.assertAlmostEqual(response.data["energy"], 1.0, places=2)

        light = Light.objects.get(pk=response.data["id"])
        self.assertTrue(light.is_glowing())
        self.assertNotEqual(light.diver, ALICE, "the raw token must never be stored")

    def test_release_requires_a_diver_token(self):
        response = client_for().post("/api/lights", {"message": "hi", "wavelength": 480, "depth": 10}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("diver", response.data)

    def test_release_validates_the_light(self):
        client = client_for(ALICE)
        cases = [
            {"message": "hi", "wavelength": 300, "depth": 10},
            {"message": "hi", "wavelength": 480, "depth": 20_000},
            {"message": "write me at a@b.org", "wavelength": 480, "depth": 10},
        ]
        for body in cases:
            with self.subTest(body=body):
                self.assertEqual(client.post("/api/lights", body, format="json").status_code, 400)
        self.assertEqual(Light.objects.count(), 0)

    def test_release_is_broadcast(self):
        with mock.patch("sea.views.broadcast.to_sea") as to_sea:
            client_for(ALICE).post("/api/lights", {"message": "hi", "wavelength": 480, "depth": 10}, format="json")
        event = to_sea.call_args.args[0]
        self.assertEqual(event["type"], "light.released")
        self.assertNotIn("diver", event["light"])
        self.assertFalse(event["light"]["yours"])

    def test_release_is_throttled(self):
        client = client_for(ALICE)
        body = {"message": "again", "wavelength": 480, "depth": 10}
        codes = [client.post("/api/lights", body, format="json").status_code for _ in range(10)]
        self.assertIn(429, codes)


class ListTests(TestCase):
    def test_lists_only_glowing_visible_lights_in_range(self):
        shallow = make_light(depth=100)
        make_light(depth=5000)
        make_light(depth=120, hidden=True)
        long_ago = timezone.now() - timedelta(days=60)
        make_light(depth=110, energy_at=long_ago, created_at=long_ago)

        response = client_for().get("/api/lights", {"top": 0, "bottom": 1000})
        self.assertEqual([item["id"] for item in response.data], [shallow.id])

    def test_marks_what_the_diver_released_and_answered(self):
        mine = make_light(diver=divers.fingerprint(BOB))
        theirs = make_light()
        client_for(BOB).post(f"/api/lights/{theirs.id}/answer")

        data = {item["id"]: item for item in client_for(BOB).get("/api/lights").data}
        self.assertTrue(data[mine.id]["yours"])
        self.assertFalse(data[mine.id]["answered"])
        self.assertFalse(data[theirs.id]["yours"])
        self.assertTrue(data[theirs.id]["answered"])

    def test_rejects_non_numeric_depths(self):
        self.assertEqual(client_for().get("/api/lights", {"top": "deep"}).status_code, 400)


class AnswerTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_answer_brightens_and_extends_the_light(self):
        light = make_light()
        before = light.dark_at
        response = client_for(BOB).post(f"/api/lights/{light.id}/answer")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["answers"], 1)
        self.assertTrue(response.data["answered"])
        light.refresh_from_db()
        self.assertGreater(light.energy, glow.RELEASE_ENERGY)
        self.assertGreater(light.dark_at, before)

    def test_cannot_answer_twice(self):
        light = make_light()
        client = client_for(BOB)
        self.assertEqual(client.post(f"/api/lights/{light.id}/answer").status_code, 200)
        self.assertEqual(client.post(f"/api/lights/{light.id}/answer").status_code, 409)
        light.refresh_from_db()
        self.assertEqual(light.answers, 1)

    def test_cannot_answer_your_own_light(self):
        light = make_light()
        self.assertEqual(client_for(ALICE).post(f"/api/lights/{light.id}/answer").status_code, 409)

    def test_cannot_answer_a_dark_or_missing_light(self):
        long_ago = timezone.now() - timedelta(days=60)
        dark = make_light(energy_at=long_ago)
        client = client_for(BOB)
        self.assertEqual(client.post(f"/api/lights/{dark.id}/answer").status_code, 404)
        self.assertEqual(client.post("/api/lights/nope/answer").status_code, 404)

    def test_answer_is_broadcast(self):
        light = make_light()
        with mock.patch("sea.views.broadcast.to_sea") as to_sea:
            client_for(BOB).post(f"/api/lights/{light.id}/answer")
        event = to_sea.call_args.args[0]
        self.assertEqual(event["type"], "light.answered")
        self.assertEqual(event["light"]["answers"], 1)


class BroadcastPayloadTests(TestCase):
    """Events go out over websockets as JSON; a payload that can't be encoded
    would drop every connected diver."""

    def setUp(self):
        cache.clear()

    def test_every_event_encodes_as_json(self):
        with mock.patch("sea.views.broadcast.to_sea") as to_sea:
            released = client_for(ALICE).post(
                "/api/lights", {"message": "hi", "wavelength": 480, "depth": 10}, format="json"
            )
            client_for(BOB).post(f"/api/lights/{released.data['id']}/answer")
        self.assertEqual(to_sea.call_count, 2)
        for call in to_sea.call_args_list:
            json.dumps(call.args[0])


class CreatureAndSeaTests(TestCase):
    def test_creatures_are_seeded_in_depth_order(self):
        data = client_for().get("/api/creatures").data
        self.assertEqual(len(data), Creature.objects.count())
        self.assertGreater(len(data), 5)
        homes = [c["home"] for c in data]
        self.assertEqual(homes, sorted(homes))
        for creature in data:
            self.assertLessEqual(creature["depth_min"], creature["home"])
            self.assertLessEqual(creature["home"], creature["depth_max"])

    def test_sea_stats(self):
        make_light(depth=200, answers=3)
        make_light(depth=9000)
        make_light(depth=10_000, hidden=True)
        data = client_for().get("/api/sea").data
        self.assertEqual(data["glowing"], 2)
        self.assertEqual(data["released"], 2)
        self.assertEqual(data["answers"], 3)
        self.assertEqual(data["deepest"], 9000)
