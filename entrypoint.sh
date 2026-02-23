#!/bin/sh
set -e

# Fix data directory ownership if it's not owned by appuser (happens when
# a Docker/Fly.io volume is mounted, overriding the build-time chown)
if [ "$(stat -c '%u' /app/data)" != "1000" ]; then
    chown -R appuser:appuser /app/data
fi

exec gosu appuser uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --proxy-headers \
    --forwarded-allow-ips "*"
