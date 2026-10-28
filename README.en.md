# Maddox Quant

**Language / 语言:** [中文](./README.md) | **English**

A research-oriented quant platform that closes the loop from industry reports: collect → store → search → analyze → watch → notify.

## Features

1. **Research reports** — Manual import / automated collection, search and filters, list and detail views
2. **Analysis** — LLM structured analysis, aggregation dashboards, extracted metrics and factors
3. **Watchlist and notifications** — Watch industries, boards, and stocks; in-app alerts for material events
4. **Automated collection** — RSS source configuration, scheduled or manual PDF ingest

## Stack

| Layer | Tech |
|------|------|
| Frontend | Next.js, TypeScript, Tailwind CSS |
| Backend | FastAPI, SQLAlchemy, Alembic |
| Database | PostgreSQL (full-text search + JSONB) |
| File storage | Local directory `storage/reports/` |
| Auth | No login; public access |

## Docs

- [Development steps (DEVELOPMENT.md)](./docs/DEVELOPMENT.md)
- [Implementation plan (Superpowers)](./docs/superpowers/plans/2026-08-31-maddox-quant-mvp.md)

## Requirements

- Docker & Docker Compose
- Node.js 20+ (local frontend)
- Python 3.11+ (local backend)
- PostgreSQL 16 (Docker or local)

## Quick start

### One-command start (Docker)

```bash
git clone https://github.com/guomu-del/maddox-quant.git
cd maddox-quant
cp .env.example .env
docker compose up --build
```

URLs:

- Frontend: http://localhost:4321
- Backend health: http://localhost:8765/health

Run database migrations after the first start:

```bash
docker compose exec backend alembic upgrade head
```

### Local development

**1. Start PostgreSQL** (or run only the database with Docker)

```bash
docker compose up postgres -d
```

**2. Backend**

```bash
cd backend
pip install -r requirements.txt
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/maddox_quant
export STORAGE_PATH=../storage/reports
alembic upgrade head
PYTHONPATH=. uvicorn app.main:app --reload --port 8765
```

**3. Frontend**

```bash
cd frontend
npm install
npm run dev
```

**4. Tests**

```bash
cd backend
PYTHONPATH=. pytest tests/ -v
```

## Seed data

Import industry and stock reference dictionaries (used later for autocomplete, etc.):

```bash
cd backend
PYTHONPATH=. alembic upgrade head
PYTHONPATH=. python scripts/seed.py
```

Data files live in `backend/data/industries.csv` and `backend/data/stocks.csv`.

## Backup and restore

**Backup** (database + PDF files):

```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/maddox_quant
./scripts/backup.sh
```

Default output: `backups/maddox_quant_<timestamp>/`.

**Restore**:

```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/maddox_quant
./scripts/restore.sh backups/maddox_quant_<timestamp>
```

## Production

### Docker Compose

`docker-compose.yml` already sets `restart: unless-stopped` and persistent volumes (`pgdata`, `storage/`).

For production:

1. Change the database password and `LLM_API_KEY` in `.env`
2. Set `COLLECT_ENABLED=true` to enable scheduled collection (optional)
3. Put Nginx in front, for example:

```nginx
server {
    listen 80;
    server_name quant.example.com;

    location / {
        proxy_pass http://127.0.0.1:4321;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8765;
        proxy_set_header Host $host;
        client_max_body_size 50m;
    }
}
```

### Security

The app has no login by default. **Do not expose it to the public internet.** Deploy on a private network, or add Basic Auth at Nginx.

## Environment variables

| Variable | Required | Description |
|------|------|------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `STORAGE_PATH` | Yes | PDF storage directory |
| `CORS_ORIGINS` | No | Frontend origins (comma-separated); defaults include local and `https://maddox-quant.vercel.app` |
| `NEXT_PUBLIC_API_URL` | Frontend prod | Backend API root, e.g. `https://maddox-quant-cdet.vercel.app` |
| `INTERNAL_API_URL` | Frontend SSR | Server-side backend URL; can match the public API in production |
| `LLM_API_KEY` | Analysis | DeepSeek or compatible API key |
| `LLM_API_BASE` | No | Default `https://api.deepseek.com/v1` |
| `LLM_MODEL` | No | Default `deepseek-chat` |
| `AUTO_ANALYZE` | No | Analyze after parse; default `false` |
| `COLLECT_ENABLED` | No | Enable scheduled collection; default `false` |
| `MAX_UPLOAD_MB` | No | PDF upload size limit; default `50` |

See `.env.example` for a full sample.

## Development phases

| Phase | Scope | Status |
|-------|------|------|
| P0 | Project skeleton | ✅ Done |
| P1 | Report import and search | ✅ Done |
| P2 | AI single-report analysis | ✅ Done |
| P3 | Aggregation dashboard | ✅ Done |
| P4 | Watchlist and notifications | ✅ Done |
| P5 | Automated collection | ✅ Done |
| P6 | Polish and launch | ✅ Done |

## License

Private — internal use
