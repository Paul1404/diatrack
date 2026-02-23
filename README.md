# DiaTrack

Diabetes hardware tracker for monitoring sensor and catheter lifecycles. Single-container web app with automatic expiry reminders.

## Features

- **Device tracking** — Log sensors and catheters with body location, see real-time progress bars and remaining hours
- **Expiry reminders** — Automatic email notifications at configurable intervals before a device expires (default: 24h and 6h)
- **Failure logging** — Report defective devices with categorised reasons (clogged, fell off, sensor error, skin reaction, other)
- **Statistics** — Failure rates, average durations, MTBF, breakdown by body location and failure reason, with charts
- **History** — Searchable table of all past devices with sortable columns and pagination
- **Per-user settings** — Customisable default runtimes and reminder intervals
- **SMTP configuration** — Manage email settings directly in the web UI (Settings page)
- **Mobile-optimised** — Responsive design with hamburger navigation, touch-friendly sizing
- **German UI** — Full German language interface with Atlassian/Jira-like design system

## Architecture

Single Docker container running:

| Component | Technology |
|-----------|------------|
| Backend API | FastAPI 0.109 · Python 3.12 |
| Database | PostgreSQL (Neon) in production; SQLite for local dev |
| Auth | FastAPI-Users 13 · Cookie-based JWT |
| Background tasks | APScheduler (checks expiring devices every 15 min) |
| Frontend | React 18 · TypeScript · Vite · Atlaskit components · Recharts |
| Frontend serving | FastAPI serves the built Vite output as static files |
| Reverse proxy | Traefik (external, via Docker labels) |

## Quick Start

### Prerequisites

- Docker & Docker Compose
- A Traefik reverse proxy on the `traefik` Docker network (or adapt the compose file)

### 1. Configure environment

Create a `.env` file in the `diatrack/` directory:

```env
JWT_SECRET=your-secure-random-secret
ALLOW_REGISTRATION=true
```

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | (required) | Secret key for signing JWT tokens |
| `DATABASE_URL` | (optional) | Neon Postgres connection string; if unset, uses local SQLite at `./data/diatrack.db` |
| `ALLOW_REGISTRATION` | `false` | Set to `true` to allow new user sign-ups |

### 2. Build and run

```bash
cd diatrack
docker compose up -d --build
```

The app will be available at the host configured in your Traefik setup (default: `https://diatrack.pdcd.net`).

### 3. Create your first user

If `ALLOW_REGISTRATION=true`, open the app and click "Registrieren". After creating your account, set `ALLOW_REGISTRATION=false` and restart to lock down registration:

```bash
docker compose up -d
```

## Data Persistence

- **Production (Fly.io):** Set `DATABASE_URL` to your Neon PostgreSQL connection string (e.g. from the [Neon](https://neon.tech) dashboard or Cursor plugin). Data is stored in Neon; no volume is required.
- **Local / Docker Compose:** If `DATABASE_URL` is not set, the app uses SQLite at `./data/diatrack.db`. With Docker Compose you can mount a volume for that path if you want to persist local data.

**Backup (Neon):** Use Neon’s backup/export tools or `pg_dump` against your Neon connection string. For local SQLite, copy the `./data/diatrack.db` file (or from the container: `docker cp diatrack:/app/data/diatrack.db ./diatrack-backup.db` if you run with a volume).

## API Endpoints

### Auth (`/api/auth/`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Login (form-urlencoded: `username`, `password`) |
| `POST` | `/api/auth/logout` | Logout (clears session cookie) |
| `POST` | `/api/auth/register` | Register new user (if enabled) |
| `GET` | `/api/auth/registration-enabled` | Check if registration is open |
| `GET` | `/api/auth/me` | Current user info |
| `GET` | `/api/auth/me/settings` | Get user settings |
| `PUT` | `/api/auth/me/settings` | Update user settings |

### Devices (`/api/devices/`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/devices` | List devices (`?active_only=true`, `?device_type=sensor`) |
| `POST` | `/api/devices` | Create device |
| `GET` | `/api/devices/{id}` | Get device details |
| `PUT` | `/api/devices/{id}/end` | Mark device as completed |
| `POST` | `/api/devices/{id}/failure` | Report device failure |
| `DELETE` | `/api/devices/{id}` | Delete device |

### Statistics (`/api/stats/`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/stats/overview` | Totals, failure rates, average durations |
| `GET` | `/api/stats/failures` | Failure breakdown by reason, location, MTBF |
| `GET` | `/api/stats/history` | Device history (`?days=90`, `?device_type=sensor`) |

### Admin (`/api/admin/`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/settings` | Get app-wide settings (SMTP) |
| `PUT` | `/api/admin/settings` | Update app-wide settings |
| `POST` | `/api/admin/settings/test-smtp` | Send test email |

### Utility

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/enums/body-locations` | Body location options |
| `GET` | `/api/enums/failure-reasons` | Failure reason options |
| `GET` | `/api/enums/device-types` | Device type options |

## User Settings

Each user can configure (via Settings page or API):

| Setting | Default | Description |
|---------|---------|-------------|
| `sensor_default_hours` | `240` (10 days) | Default sensor lifetime |
| `catheter_default_hours` | `72` (3 days) | Default catheter lifetime |
| `reminder_intervals_hours` | `[24, 6]` | Hours before expiry to send email reminders |

## SMTP / Email Reminders

Configure SMTP in the web UI under **Einstellungen → E-Mail-Einstellungen (SMTP)**. The background scheduler checks every 15 minutes for devices approaching expiry and sends email reminders based on each user's configured intervals.

## Development

### Local development (without Docker)

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

The Vite dev server proxies `/api` requests to `http://localhost:8000`.

## Project Structure

```
diatrack/
├── Dockerfile              # Multi-stage build (Node + Python)
├── docker-compose.yml      # Single-service compose with Traefik labels
├── backend/
│   ├── requirements.txt
│   └── app/
│       ├── main.py         # FastAPI app, lifespan, static file serving
│       ├── auth.py         # FastAPI-Users config (cookie JWT)
│       ├── config.py       # Environment settings
│       ├── database.py     # SQLAlchemy engine + session
│       ├── models/         # SQLAlchemy models
│       │   ├── user.py     # User (fastapi-users) + JSON settings
│       │   ├── device.py   # Device, enums (type, status, body location)
│       │   ├── failure_log.py  # Failure reasons + log
│       │   └── app_settings.py # Singleton SMTP config
│       ├── routers/        # API route handlers
│       │   ├── auth.py     # Auth + user settings endpoints
│       │   ├── devices.py  # Device CRUD + progress calculation
│       │   ├── stats.py    # Statistics + history
│       │   └── admin.py    # App-wide settings (SMTP)
│       ├── schemas/        # Pydantic request/response models
│       └── tasks/          # APScheduler background jobs
│           └── notifications.py  # Email reminders
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── App.tsx         # Router setup
        ├── main.tsx        # Entry point
        ├── index.css       # Atlassian Design System styles
        ├── components/     # Layout with responsive hamburger menu
        ├── context/        # AuthContext (cookie-based session)
        ├── pages/          # Dashboard, Statistics, History, Settings, Login
        └── services/       # API client
```
