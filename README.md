# noctiluca

A deep-sea dive lit by messages from strangers. Django and Channels on the
back, Next.js and WebGL on the front.

*Noctiluca scintillans* is the plankton that makes breaking waves glow blue
when the water moves.

You start at the surface at night and descend, all the way to the bottom of the
Challenger Deep at 10,935 metres. Everything you see down there is made of
light: the plankton flashing where your pointer disturbs the water, real
animals placed at the depths they really live, and the lights other people
left. Each light is a short message someone released at the depth where they
wrote it. You can read it, answer it to keep it glowing, and leave one of your
own. Other divers who are in the water at the same time show up as small warm
lamps, moving at their real depth.

```console
$ make seed dev

Released 60 lights; 60 are glowing.
backend  http://127.0.0.1:8000
web      http://localhost:3000
```

## What's in the water

**The dive.** Scroll, drag or use the arrow keys. The instruments along the
bottom read out depth, water temperature, pressure and the share of noon
daylight that would reach you, from a tropical western-Pacific profile. By
1,000 m that last one is 10⁻¹⁰. At the bottom it is 10⁻¹⁰⁹.

**The zones.** Sunlight, twilight, midnight, abyssal, hadal. They are wildly
different sizes (200 m against nearly 5 km), so the dive doesn't move through
metres at a constant rate. Each zone gets a share of the descent, and the world
is laid out in that share rather than in metres. See `web/src/lib/ocean.ts`.

**The animals.** Eleven real species, served by the backend with their depth
ranges and a fact each, and drawn as clouds of points animated in their own
vertex shaders. The light they make is their own, not decoration:

| Animal | Where | What it does when you touch it |
| --- | --- | --- |
| Firefly squid | 200–400 m | the school flashes in a wave |
| Comb jelly | 500–2,500 m | the rainbow is your lamp diffracting on its cilia; touched, it flashes blue |
| Vampire squid | 600–1,200 m | leaves a cloud of glowing mucus and slips away |
| Giant siphonophore | 700–1,000 m | a wave of light runs down a colony longer than the screen |
| Atolla jellyfish | 1,000–4,000 m | the spinning "burglar alarm" wheel of blue light |
| Stoplight loosejaw | 500–3,900 m | sweeps its red searchlight, which almost nothing else can see |
| Humpback anglerfish | 1,000–4,000 m | snaps its jaws; the lure's glow comes from bacteria |
| Dumbo octopus, Mariana snailfish, hadal amphipods | 3,000 m and deeper | nothing: they make no light, and you only find them by pointing your lamp at the dark |

**The lights.** Pick a colour on a real spectrum slider, from 440 to 710 nm;
the note under it tells you what makes light of that colour down here. The
light hangs where you wrote it for anyone who dives that deep.

**Sound**, if you turn it on: a low drone and the rush of water, both of which
dull as you go deeper, and a soft ping pitched by a light's colour whenever
one is born or answered. It's all synthesised with Web Audio; there are no
audio files.

## How the backend works

### A light fades, and the database knows when

A light is released with an energy of 1.0 and loses half of it every 72 hours.
Each answer adds 0.35, up to 3.0. Below 0.04 it has gone dark.

The obvious way to find glowing lights is to compute every light's current
energy and filter, which means reading every light ever released. Instead,
because the decay is a plain exponential, the moment a light will go dark is
known the instant its energy changes:

```
dark_at = energy_at + half_life × log₂(energy / 0.04)
```

`dark_at` is stored and indexed, so "what's glowing between 200 and 1,000 m" is
a range query on `(depth, dark_at)`. Answering a light recomputes it inside a
`SELECT ... FOR UPDATE` transaction. A fresh light lasts about two weeks. See
`backend/sea/glow.py`.

### Divers have no accounts

The browser invents a random token on its first visit and sends it as
`X-Diver`. The server only ever stores an HMAC of it, keyed with the secret key.
That is enough to know that you released a light (so you can't answer your own)
and that you already answered one (a unique constraint, so you can't answer it
twice), and not enough to link a light to anyone.

For the same reason, lights can't carry a way to find somebody: links, email
addresses, phone numbers and handles are rejected, and an admin can hide a
light, which removes it from every diver's screen at once.

### The live sea

Each diver holds one websocket (`/ws/sea`). Through it they hear about lights
being released, answered and hidden, and see every other diver's depth. The
only thing a diver sends is their own position, at most every 150 ms, with
anything malformed ignored.

Broadcasts are sent with `transaction.on_commit`, so no diver ever hears about
a light that then fails to save. Every broadcast payload is plain JSON by the
time it leaves the view; there's a test that encodes each one, because a single
unencodable value would drop every connected socket.

Presence lives in the memory of the ASGI process, which is exact for a single
process. Set `NOCTILUCA_REDIS_URL` to use a Redis channel layer across several
processes; events still reach everyone, though each process only counts its own
divers.

### API

| | |
| --- | --- |
| `GET /api/lights?top=&bottom=` | glowing lights in a depth range |
| `POST /api/lights` | release a light `{message, wavelength, depth}` (throttled) |
| `POST /api/lights/<id>/answer` | answer a light (once per diver, not your own) |
| `GET /api/creatures` | the animals and where they live |
| `GET /api/sea` | how many lights are glowing, and who is in the water |
| `WS /ws/sea` | the live sea |

## How the frontend works

The page is one full-screen WebGL canvas with the instruments laid over it.
Nothing that changes per frame goes through React: depth, velocity and the
pointer live in a plain mutable object (`web/src/lib/motion.ts`), the scene reads
them in its render loop, and the readouts write straight to the DOM from their
own animation frame. React only renders when something discrete happens, like a
light arriving or a card opening.

Every layer shares one set of uniform objects, updated once per frame by the
camera rig. That includes the diver's lamp, which is a soft cone through the
pointer that every shader samples in clip space. That shared lamp is why the
dark animals appear when you point at them, why marine snow glints warm around
the cursor, and why the comb jelly's rainbow blazes when your lamp is on it.

The lights are a single instanced draw call. Their glow, flicker, birth and the
ring they throw when answered are computed in the shader from four numbers per
light. Picking which light is under the pointer is done on the CPU in screen
space, with the same drift formula the shader uses (`web/src/scene/placement.ts`).

Plankton sparks are a 6,000-point ring buffer. The CPU writes where and when a
spark was born; the GPU animates it for its whole life.

## Running it

You need Python 3.12+ and Node 20.9+.

```console
make setup   # venv, pip install, npm install, migrate
make seed    # 60 lights from imaginary divers over the past fortnight
make dev     # Django on :8000 and Next.js on :3000
make test    # backend tests, then typecheck and lint the web app
```

Or by hand:

```console
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements.txt   # .venv\Scripts on Windows
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_sea
.venv/bin/python manage.py runserver 127.0.0.1:8000

cd web
npm install
npm run dev
```

Next proxies `/api` to Django (`NOCTILUCA_BACKEND` if it isn't on
`127.0.0.1:8000`). The websocket connects to port 8000 on the same host directly,
or to `NEXT_PUBLIC_SEA_SOCKET` if set.

Backend settings, all optional locally: `NOCTILUCA_SECRET_KEY` (required when
`NOCTILUCA_DEBUG=0`), `NOCTILUCA_ALLOWED_HOSTS`, `NOCTILUCA_DATABASE_PATH`,
`NOCTILUCA_REDIS_URL`, `NOCTILUCA_RELEASE_RATE`, `NOCTILUCA_ANSWER_RATE`,
`NOCTILUCA_NUM_PROXIES`.

Moderation is at `/admin/` once you've run `manage.py createsuperuser`.

## Layout

```
backend/
  noctiluca/        settings, ASGI routing
  sea/
    glow.py         how a light fades
    divers.py       anonymous diver fingerprints
    moderation.py   what a light may say
    models.py       Light, Answer, Creature
    views.py        REST API
    consumers.py    the live sea (websocket)
    presence.py     who is in the water
    migrations/     includes the eleven animals
    tests/
web/src/
  lib/              ocean profile, spectrum, API, socket, store, sound
  scene/            the WebGL sea: water, snow, plankton, lights, divers, floor
    creatures/      one file per animal, each a point cloud and a shader
  hud/              the instruments and panels over the water
```
