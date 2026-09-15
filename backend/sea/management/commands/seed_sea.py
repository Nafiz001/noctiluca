import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from sea import divers
from sea.models import CHALLENGER_DEEP, Answer, Light

MESSAGES = [
    "My grandmother used to say the sea keeps whatever you tell it. Hi, Nani.",
    "I passed my driving test today on the fourth try. Nobody down here cares, which is perfect.",
    "If you're reading this at 3am too: go to sleep. I will if you will.",
    "I never told him. Leaving it here instead.",
    "Still thinking about the dog we couldn't keep.",
    "We moved countries this year and I finally stopped translating my thoughts.",
    "Whoever answers this: I hope your tea is exactly the right temperature.",
    "Dad's scans came back clear.",
    "Is it strange that the dark feels calmer than the surface?",
    "I learned to swim at 31. This is the deepest I've ever been.",
    "Practising saying no. No. See, that wasn't so bad.",
    "The anglerfish has a better social life than me.",
    "I'm scared of the job I said yes to. I'm going anyway.",
    "Somewhere up there it's raining on my window.",
    "Two years sober on Thursday.",
    "To the stranger on the 7:40 train who gave me their umbrella: thank you.",
    "I miss being a kid who thought the deep end was the bottom of the world.",
    "My daughter asked what's at the bottom of the ocean. Going to find out for her.",
    "Everything I planted this spring died except the mint. The mint is thriving. Respect.",
    "Forgive yourself for the version of you that didn't know better.",
    "I finished the novel. Nobody will read it. I wrote it anyway.",
    "Hello from a hospital waiting room.",
    "My cat knocked this cup of coffee over while I was typing. Worth it.",
    "It's been a year since the flood. The house smells like new paint now.",
    "I wanted to leave something that doesn't need a reply. So: here.",
    "Learning Bengali to talk to my grandfather properly before it's too late.",
    "Someone down here is braver than they think. Probably you.",
    "I counted the lights on the way down and lost count at the jellyfish.",
    "Can't sleep. The fan is making whale noises.",
    "Mum, I got in.",
    "I'm the kind of tired that sleep doesn't fix. Resting here a minute.",
    "The quietest place I've ever been is inside this browser tab.",
    "First light I've ever left. Hope it lasts.",
    "Sorry to the friend I stopped calling. It wasn't you.",
    "We named her Mira. She's four days old.",
    "Deep enough that nobody from work can find me.",
    "The loosejaw sees red when nobody else can. Relatable.",
    "Today I let someone else be right and it felt like putting down a heavy bag.",
    "Leaving this for whoever needs a small, steady light.",
    "Old enough now to be kind to my younger self.",
    "Grief is just love with nowhere to go. It came here.",
    "Made pancakes shaped like squid for my son. He said they looked like socks.",
    "I think the ocean would be less lonely if more of us came down here.",
    "Our band played its first gig to eleven people. Eleven!",
    "I moved to the city with one suitcase. Year three. Still one suitcase.",
    "Wish I could hear what the siphonophore is thinking. All forty metres of it.",
    "Retired today after 38 years. What do people do on Mondays?",
    "Telling the dark that I'm okay, so I'll believe it.",
    "Finally fixed the bug. It was a typo. It's always a typo.",
    "If you're lost, you're at least lost somewhere beautiful.",
    "The water is cold, and my heart is loud.",
    "Dedicated to my brother, who would have loved this.",
    "Promise to myself: fewer apologies, more oranges.",
    "I left a light at the bottom because that's where it's needed most.",
    "Nothing down here is lit unless it lights itself. Noted.",
    "Hey, you. Yes, you with the lamp. Keep going.",
    "We got married in a parking lot during a thunderstorm. Best day.",
    "The snailfish lives where it shouldn't be able to. So do I, some days.",
    "Tonight I am grateful for small warm things.",
    "Hi from Dhaka. It's hot. The sea is nice and cold.",
]

# Blue carries furthest through seawater, so most light in the sea is blue.
WAVELENGTHS = [470] * 10 + [460, 475, 480, 490, 495, 505, 510, 520, 540, 560, 590, 640, 680, 700]


class Command(BaseCommand):
    help = "Fill the sea with lights left by imaginary divers over the past fortnight."

    def add_arguments(self, parser):
        parser.add_argument("--clear", action="store_true", help="Remove every existing light first.")
        parser.add_argument("--seed", type=int, default=None, help="Random seed, for a repeatable sea.")

    def handle(self, *args, clear=False, seed=None, **options):
        rng = random.Random(seed)
        if clear:
            Light.objects.all().delete()

        now = timezone.now()
        made = 0
        for message in MESSAGES:
            released = now - timedelta(hours=rng.uniform(0.2, 11 * 24))
            light = Light(
                message=message,
                wavelength=rng.choice(WAVELENGTHS) + rng.randint(-4, 4),
                depth=_depth(rng),
                drift=rng.uniform(-1, 1),
                phase=rng.random(),
                diver=divers.fingerprint(f"seed-diver-{rng.randint(0, 10**9)}"),
                energy_at=released,
                created_at=released,
            )
            light.save()

            answers = []
            for n in range(int(rng.expovariate(1 / 4))):
                answered = released + (now - released) * rng.random()
                answers.append((answered, divers.fingerprint(f"seed-answer-{light.id}-{n}")))
            for answered, diver in sorted(answers):
                light.receive_answer(answered)
                Answer.objects.create(light=light, diver=diver, created_at=answered)
            light.save()
            made += 1

        glowing = Light.objects.glowing(now).count()
        self.stdout.write(self.style.SUCCESS(f"Released {made} lights; {glowing} are glowing."))


def _depth(rng: random.Random) -> int:
    # Spread lights through every zone, a little heavier near the surface where
    # most divers turn back.
    zone = rng.choices(
        [(5, 200), (200, 1000), (1000, 4000), (4000, 6000), (6000, CHALLENGER_DEEP)],
        weights=[3, 4, 4, 2, 2],
    )[0]
    return rng.randint(*zone)
