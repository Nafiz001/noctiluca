from django.db import migrations

CREATURES = [
    {
        "slug": "sea-sparkle",
        "name": "Sea sparkle",
        "latin_name": "Noctiluca scintillans",
        "depth_min": 0,
        "depth_max": 20,
        "home": 14,
        "wavelength": 474,
        "note": (
            "Single-celled plankton that flashes blue whenever the water around it moves. "
            "On some coasts whole beaches glow as the waves break. This sea is named after it."
        ),
    },
    {
        "slug": "firefly-squid",
        "name": "Firefly squid",
        "latin_name": "Watasenia scintillans",
        "depth_min": 200,
        "depth_max": 400,
        "home": 300,
        "wavelength": 470,
        "note": (
            "A squid about seven centimetres long, dotted with hundreds of light organs. "
            "Every spring millions rise to spawn in Toyama Bay, Japan, and the bay turns blue."
        ),
    },
    {
        "slug": "comb-jelly",
        "name": "Comb jelly",
        "latin_name": "Bathocyroe fosteri",
        "depth_min": 500,
        "depth_max": 2500,
        "home": 520,
        "wavelength": 485,
        "note": (
            "The rainbow running down its body isn't its own light: it's your lamp breaking "
            "apart on eight rows of beating cilia. The light it makes itself is blue."
        ),
    },
    {
        "slug": "vampire-squid",
        "name": "Vampire squid",
        "latin_name": "Vampyroteuthis infernalis",
        "depth_min": 600,
        "depth_max": 1200,
        "home": 720,
        "wavelength": 475,
        "note": (
            "Lives where the water holds almost no oxygen. It has no ink. Instead it releases "
            "a cloud of sticky, glowing mucus that can shine for nearly ten minutes."
        ),
    },
    {
        "slug": "siphonophore",
        "name": "Giant siphonophore",
        "latin_name": "Praya dubia",
        "depth_min": 700,
        "depth_max": 1000,
        "home": 900,
        "wavelength": 470,
        "note": (
            "Not one animal but a colony of specialised clones strung along a single line, "
            "which can reach about 40 metres. That is longer than a blue whale."
        ),
    },
    {
        "slug": "atolla",
        "name": "Atolla jellyfish",
        "latin_name": "Atolla wyvillei",
        "depth_min": 1000,
        "depth_max": 4000,
        "home": 1500,
        "wavelength": 470,
        "note": (
            "When something grabs it, it throws a spinning wheel of blue light. The display is "
            "thought to be a burglar alarm, calling in something bigger to eat the attacker."
        ),
    },
    {
        "slug": "stoplight-loosejaw",
        "name": "Stoplight loosejaw",
        "latin_name": "Malacosteus niger",
        "depth_min": 500,
        "depth_max": 3900,
        "home": 2300,
        "wavelength": 705,
        "note": (
            "Nearly everything down here makes blue light and sees only blue. This fish makes "
            "red light as well, and can see it. It hunts with a searchlight no one else can see."
        ),
    },
    {
        "slug": "anglerfish",
        "name": "Humpback anglerfish",
        "latin_name": "Melanocetus johnsonii",
        "depth_min": 1000,
        "depth_max": 4000,
        "home": 3200,
        "wavelength": 490,
        "note": (
            "The glow at the tip of her lure comes from bacteria living inside it. Females grow to "
            "about 18 centimetres. Males reach about 3, and have no lure at all."
        ),
    },
    {
        "slug": "dumbo-octopus",
        "name": "Dumbo octopus",
        "latin_name": "Grimpoteuthis",
        "depth_min": 3000,
        "depth_max": 7000,
        "home": 4700,
        "wavelength": None,
        "note": (
            "Swims by flapping the two ear-like fins it is named for, and swallows its prey whole. "
            "No octopus is known to live deeper."
        ),
    },
    {
        "slug": "snailfish",
        "name": "Mariana snailfish",
        "latin_name": "Pseudoliparis swirei",
        "depth_min": 6000,
        "depth_max": 8000,
        "home": 7300,
        "wavelength": None,
        "note": (
            "Pale, scaleless and soft, it is the top predator of the trench. A relative filmed at "
            "8,336 metres is the deepest fish anyone has seen."
        ),
    },
    {
        "slug": "amphipod",
        "name": "Hadal amphipod",
        "latin_name": "Hirondellea gigas",
        "depth_min": 6000,
        "depth_max": 10935,
        "home": 10700,
        "wavelength": None,
        "note": (
            "A few centimetres long, and found at the very bottom of the Challenger Deep. "
            "It can digest sunken wood, using an enzyme that breaks down cellulose."
        ),
    },
]


def add_creatures(apps, schema_editor):
    Creature = apps.get_model("sea", "Creature")
    for order, fields in enumerate(CREATURES):
        Creature.objects.update_or_create(slug=fields["slug"], defaults={**fields, "order": order})


def remove_creatures(apps, schema_editor):
    Creature = apps.get_model("sea", "Creature")
    Creature.objects.filter(slug__in=[c["slug"] for c in CREATURES]).delete()


class Migration(migrations.Migration):
    dependencies = [("sea", "0001_initial")]

    operations = [migrations.RunPython(add_creatures, remove_creatures)]
