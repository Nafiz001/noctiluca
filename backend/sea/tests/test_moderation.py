from django.core.exceptions import ValidationError
from django.test import SimpleTestCase

from sea.moderation import MAX_LENGTH, clean_message


class CleanMessageTests(SimpleTestCase):
    def test_collapses_whitespace(self):
        self.assertEqual(clean_message("  hello \n\n  down   there "), "hello down there")

    def test_keeps_ordinary_messages(self):
        for text in [
            "Mum, I got in.",
            "Two years sober on Thursday.",
            "It was 2026-09-15 when I finally went.",
            "10,935 metres is a long way down.",
            "I think it's 3.14 or so.",
        ]:
            with self.subTest(text=text):
                self.assertEqual(clean_message(text), text)

    def test_rejects_empty(self):
        with self.assertRaises(ValidationError):
            clean_message("   \n ")

    def test_rejects_too_long(self):
        clean_message("a b" * (MAX_LENGTH // 3))
        with self.assertRaises(ValidationError):
            clean_message("x " * MAX_LENGTH)

    def test_rejects_ways_to_find_someone(self):
        for text in [
            "see https://example.org",
            "go to www.example.org",
            "visit mysite.com now",
            "mail me at someone@example.org",
            "call +1 (555) 123-4567",
            "find me @someone_here",
        ]:
            with self.subTest(text=text), self.assertRaises(ValidationError):
                clean_message(text)

    def test_rejects_held_down_keys(self):
        with self.assertRaises(ValidationError):
            clean_message("aaaaaaaaaaaaaaaa")
