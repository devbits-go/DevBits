# DevBits

A place for developers to share their projects.

Goal: Create an X and LinkedIn crossover for posting real content about your projects, semi-formally

### Outline

Projects are the baseline of the app, you must have a project to post.

Anyone can comment, like, follow, despite their project count.

Some quirky names for things (frontend only)

- Projects are called 'Stream's
- Posts about projects are called 'Byte's
- Comments are called 'Bit's

### Tech Stack

- Backend/API in Go using Gin framework
- Frontend: ReactNative (iOS and Android)
- Database: PostgreSQL
- Host: AWS ec2 for backend, AWS RDS for PostgreSQL

## Local Development

### Quick Start

Start only the frontend (choose production or local backend at launch):

```bash
./run-front.sh
```

Start full local stack (dev PostgreSQL + backend + frontend in local API mode):

```bash
./run-dev.sh
```

Run backend tests using dockerized Go against the dev DB stack:

```bash
./run-db-tests.sh
```

PowerShell equivalents:

```powershell
.\run-front.ps1
.\run-dev.ps1
.\run-db-tests.ps1
```

Scan the QR code with Expo Go on your phone. The app will automatically connect to your local backend.

### Verification Checklist

- Fresh clone frontend check: run `chmod +x run-front.sh run-dev.sh run-db-tests.sh`, then `./run-front.sh`, choose `Production`, and confirm Expo starts.
- Full local stack: run `./run-dev.sh`, confirm backend health at `http://<LAN-IP>:8080/health`, then validate app API calls from a phone on same WiFi.
- DB tests: run `./run-db-tests.sh` and confirm it exits with code `0`.

### Prerequisites

1. Install Docker and Docker Compose (v2)
2. Install Node.js/npm for Expo frontend

### Troubleshooting

- Docker Desktop on Windows: ensure file sharing is enabled for the repo path.
- If `8080` or `5433` is occupied, the scripts prompt for alternate ports (or allow exit with guidance).
- WSL/Docker Desktop/Linux engine differences: run scripts from the environment that owns your Docker daemon and ensure localhost port forwarding is enabled.

For detailed instructions, see [INSTRUCTIONS.md](INSTRUCTIONS.md).

## Static file sync

`backend/api/static/` is the source of truth for compliance and deep-linking files
(`apple-app-site-association`, `privacy-policy.html`, `account-deletion.html`).
The same files are mirrored into `frontend/public/` for the Expo web build.

Run `Bash-Scripts/sync-static.sh` after editing any file in `backend/api/static/`
to keep the frontend copy in sync.

## Deployment DB scripts

All deployment database script commands and usage are documented in:

- [backend/scripts/README.md](backend/scripts/README.md)
- [backend/docs/AWS_TRANSFER_NO_NGINX.md](backend/docs/AWS_TRANSFER_NO_NGINX.md)
