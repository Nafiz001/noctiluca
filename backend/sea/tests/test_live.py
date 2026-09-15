from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.test import TransactionTestCase

from noctiluca.asgi import application
from sea import presence
from sea.broadcast import GROUP


def connect():
    return WebsocketCommunicator(application, "/ws/sea", headers=[(b"origin", b"http://localhost:3000")])


class LiveSeaTests(TransactionTestCase):
    def setUp(self):
        presence.clear()

    async def test_divers_see_each_other_move_and_leave(self):
        first = connect()
        connected, _ = await first.connect()
        self.assertTrue(connected)
        hello = await first.receive_json_from()
        self.assertEqual(hello["type"], "hello")
        self.assertEqual(hello["divers"], [])

        second = connect()
        await second.connect()
        hello_two = await second.receive_json_from()
        self.assertEqual([d["id"] for d in hello_two["divers"]], [hello["you"]])

        arrived = await first.receive_json_from()
        self.assertEqual(arrived, {"type": "diver.moved", "diver": {"id": hello_two["you"], "depth": 0.0, "x": 0.0}})

        await second.send_json_to({"type": "move", "depth": 1234.56, "x": 3})
        moved = await first.receive_json_from()
        self.assertEqual(moved["diver"], {"id": hello_two["you"], "depth": 1234.6, "x": 1.0})
        self.assertTrue(await second.receive_nothing(), "divers don't hear their own movement")

        await second.disconnect()
        left = await first.receive_json_from()
        self.assertEqual(left, {"type": "diver.left", "id": hello_two["you"]})
        await first.disconnect()

    async def test_ignores_malformed_movement(self):
        watcher, mover = connect(), connect()
        await watcher.connect()
        await watcher.receive_json_from()
        await mover.connect()
        await mover.receive_json_from()
        await watcher.receive_json_from()

        for bad in [{"type": "move", "depth": "deep"}, {"type": "move", "depth": True}, {"type": "wave"}, [1, 2]]:
            await mover.send_json_to(bad)
        self.assertTrue(await watcher.receive_nothing())
        await watcher.disconnect()
        await mover.disconnect()

    async def test_sea_events_reach_everyone(self):
        diver = connect()
        await diver.connect()
        await diver.receive_json_from()

        event = {"type": "light.hidden", "id": "abc"}
        await get_channel_layer().group_send(GROUP, {"type": "sea.event", "event": event})
        self.assertEqual(await diver.receive_json_from(), event)
        await diver.disconnect()

    async def test_rejects_foreign_origins(self):
        stranger = WebsocketCommunicator(application, "/ws/sea", headers=[(b"origin", b"https://elsewhere.example")])
        connected, _ = await stranger.connect()
        self.assertFalse(connected)
