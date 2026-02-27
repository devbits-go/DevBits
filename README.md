# DevBits

## Goal: Create an X and LinkedIn crossover for posting real content about your projects, semi-formally

### Outline

Projects are the baseline of the app, you must have a project to post.

Anyone can comment, like, follow, despite their project count.

Some quirky names for things (frontend only)

- Projects are called 'Stream's
- Posts about projects are called 'Byte's
- Comments are called 'Bit's

### Tech Stack

- Backend/API in Go, Elixir/Scala if need big data processing
- Frontend: ReactNative and Expo
- Database: PostgreSQL or MySQL
- Host: On AWS, full system design pending

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

## Deployment DB scripts

All deployment database script commands and usage are documented in:

- [backend/scripts/README.md](backend/scripts/README.md)
