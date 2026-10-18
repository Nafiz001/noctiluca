#!/bin/sh
# Migrates, makes sure the sea is not empty, then serves it.
#
# Lights fade (half their energy every 72 hours), so a quiet public demo
# would go dark within two weeks. Once a day, if fewer than MIN_GLOWING
# lights are glowing, a fresh batch of seeded ones is released.
set -eu

python manage.py migrate --noinput

top_up() {
  python manage.py shell -c "
import sys
from django.utils import timezone
from sea.models import Light
sys.exit(0 if Light.objects.glowing(timezone.now()).count() >= ${NOCTILUCA_MIN_GLOWING:-30} else 1)
" || python manage.py seed_sea
}

top_up
( while sleep 86400; do top_up || true; done ) &

exec daphne -b 0.0.0.0 -p 8000 noctiluca.asgi:application
