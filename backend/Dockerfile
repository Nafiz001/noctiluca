# noctiluca's Django + Channels backend, served by daphne.
#
# The sea is a single SQLite file under /data and an in-process channel
# layer, so one container is the whole backend: no Postgres, no Redis.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 \
    NOCTILUCA_DEBUG=0 NOCTILUCA_DATABASE_PATH=/data/sea.sqlite3

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN useradd --system --uid 10001 noctiluca && mkdir /data && chown noctiluca /data
USER noctiluca
VOLUME /data
EXPOSE 8000

CMD ["sh", "entrypoint.sh"]
