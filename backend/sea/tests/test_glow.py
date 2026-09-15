from datetime import UTC, datetime, timedelta

from django.test import SimpleTestCase

from sea import glow

T0 = datetime(2026, 1, 1, tzinfo=UTC)


class DecayTests(SimpleTestCase):
    def test_halves_every_half_life(self):
        self.assertAlmostEqual(glow.decay(1.0, glow.HALF_LIFE), 0.5)
        self.assertAlmostEqual(glow.decay(1.0, glow.HALF_LIFE * 3), 0.125)

    def test_no_decay_for_zero_or_negative_elapsed(self):
        self.assertEqual(glow.decay(0.8, timedelta(0)), 0.8)
        self.assertEqual(glow.decay(0.8, -timedelta(hours=1)), 0.8)

    def test_dark_at_is_when_energy_reaches_threshold(self):
        dark = glow.dark_at(1.0, T0)
        self.assertAlmostEqual(glow.decay(1.0, dark - T0), glow.DARK)

    def test_fresh_light_lasts_about_two_weeks(self):
        lifetime = glow.dark_at(glow.RELEASE_ENERGY, T0) - T0
        self.assertGreater(lifetime, timedelta(days=13))
        self.assertLess(lifetime, timedelta(days=15))

    def test_already_dark_energy_is_dark_immediately(self):
        self.assertEqual(glow.dark_at(glow.DARK / 2, T0), T0)

    def test_boost_is_capped(self):
        self.assertAlmostEqual(glow.boosted(1.0), 1.0 + glow.BOOST)
        self.assertEqual(glow.boosted(glow.MAX_ENERGY - 0.01), glow.MAX_ENERGY)
