# DiaTrack

A self-hosted web app for tracking diabetes hardware — sensors and catheters — so you never forget when something needs changing.

## Why I built this

Living with diabetes means constantly swapping sensors and catheters. Every few days you're changing something, and it's surprisingly easy to lose track of when you put it on, where on your body it went, and when it's going to expire. I got tired of guessing, so I built DiaTrack to handle it for me.

It shows me exactly how much time is left on each device, sends me email reminders before they expire, and keeps a full history so I can spot patterns — like which body locations tend to fail early or which sensor batches are unreliable.

## What it does

- **Countdown timers** for active sensors and catheters with body location tracking
- **Email reminders** before a device expires (configurable — e.g. 24h and 6h before)
- **Failure logging** when something goes wrong (clogged, fell off, sensor error, skin reaction)
- **Statistics & charts** — failure rates, average lifetimes, breakdowns by location and reason
- **Full history** — searchable, sortable table of every device you've ever used
- **Per-user settings** — customize default lifetimes and reminder intervals
- **Mobile-friendly** — works well on your phone
- **German UI** — the interface is in German (it's a personal project, after all)

## Quick start

You need [Docker](https://docs.docker.com/get-docker/) installed. That's it.

```bash
git clone https://github.com/paul1404/diatrack.git
cd diatrack
cp .env.example .env
```

Edit `.env` and set a JWT secret (you can generate one with `openssl rand -hex 32`):

```env
JWT_SECRET=your-generated-secret-here
ALLOW_REGISTRATION=true
```

Then start it up:

```bash
docker compose up -d --build
```

Open [http://localhost:8000](http://localhost:8000), create your account, and you're good to go.

Once you've registered, set `ALLOW_REGISTRATION=false` in `.env` and restart to lock things down:

```bash
docker compose up -d
```

## Configuration

| Variable | Default | What it does |
|----------|---------|--------------|
| `JWT_SECRET` | *(required)* | Secret key for signing auth tokens |
| `ALLOW_REGISTRATION` | `false` | Set to `true` to allow new sign-ups |
| `DATABASE_URL` | *(unset — uses SQLite)* | PostgreSQL connection string if you want an external DB |
| `CORS_ORIGINS` | `http://localhost:8000` | Allowed origins for CORS |
| `COOKIE_SECURE` | `false` | Set to `true` when running behind HTTPS |

By default DiaTrack uses SQLite, stored in a Docker volume. No external database needed. If you want PostgreSQL instead, set `DATABASE_URL` to your connection string.

## Running behind a reverse proxy

If you're putting this behind Traefik, Caddy, nginx, or similar:

1. Set `CORS_ORIGINS=https://your-domain.com` and `COOKIE_SECURE=true` in your `.env`
2. There's a ready-made Traefik override in `docker-compose.traefik.yml`:

```bash
docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d --build
```

## Local development

**Backend:**

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

The Vite dev server proxies `/api` requests to the backend at `localhost:8000`.

## Tech stack

FastAPI · React · TypeScript · Vite · SQLite/PostgreSQL · Atlaskit UI · Recharts · Docker
