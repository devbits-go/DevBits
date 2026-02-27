Dev Environment Standardization — Implementation Plan for Copilot

Goal

Create cross-platform developer scripts and configs so a fresh clone can run the frontend (Expo) and backend (Docker) for local development. Scripts must work on Windows (PowerShell) and Arch Linux (bash/zsh) and must not require manual .env editing.

Overview — files to add or verify

- run-front.ps1 (exists) — PowerShell script to launch Expo and choose backend (local LAN or production).
- run-front.sh (old) — Bash script equivalent to `run-front.ps1` (needs review/update).
- run-dev.ps1 (missing) — PowerShell script that brings up the dev DB, backend, then runs Expo (local mode).
- run-dev.sh (missing) — Bash equivalent.
- run-db-tests.ps1 (missing) — PowerShell script to rebuild dev DB, wait for readiness, then run DB tests.
- run-db-tests.sh (missing) — Bash equivalent.
- backend/docker-compose.dev.yml (old) — Docker Compose file for an isolated dev DB + backend stack (maps ports, persistent volume); existing version needs review.
- .env.test (old) — Example env for contributors (never commit .env); existing file present but should be reviewed/renamed to `.env.example`.

Current repo status (quick verification)

- `run-front.ps1`: PRESENT at repository root (already updated to auto-inject local API).
- `run-front.sh` : old
- `run-dev.ps1`: MISSING
- `run-dev.sh`: MISSING
- `run-tests.ps1`: old
- `run-tests.sh`: old
- `backend/docker-compose.dev.yml`: old
- `.env.test`: old

If any of the "MISSING" files already exist when you open this with Copilot, skip creating them and verify contents match the specs below.

Implementation instructions for Copilot (step-by-step)

1. `run-front.sh` (bash, cross-platform for Linux/macOS)

- Prompt the user: "Select backend: 1) Production (devbits.ddns.net) 2) Local (LAN IP:8080)"
- If user selects Local:
  - Detect LAN IP: run `hostname -I | awk '{print $1}'` and filter to the first IPv4 that matches `^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.`.
  - If detection fails, fall back to `127.0.0.1` and print a warning.
  - Export:
    - `EXPO_PUBLIC_USE_LOCAL_API=1`
    - `EXPO_PUBLIC_LOCAL_API_URL=http://<LAN-IP>:8080`
- If user selects Production:
  - Export `EXPO_PUBLIC_USE_LOCAL_API=0`
- Also export `REACT_NATIVE_PACKAGER_HOSTNAME` to the detected local IP for Metro bundler.
- Run `npx expo start --dev-client` (or `npm run frontend` if repo uses npm script). Use `--clear` when a `--clear` argument is passed.
- Make the script executable (`chmod +x`).

2. `run-front.ps1` (verify/adjust) — PowerShell version should mirror `run-front.sh` behavior (prompt, detect LAN IP, set env vars, start `npx expo start`). If the existing `run-front.ps1` already behaves this way, ensure it prompts and allows explicit selection.

3. `backend/docker-compose.dev.yml`

- Compose file that defines two services: `db` (Postgres) and `backend` (builds from repository's `backend/Dockerfile`).
- `db`:
  - image: `postgres:15`
  - environment: `POSTGRES_DB=devbits_dev`, `POSTGRES_USER=devbits_dev`, `POSTGRES_PASSWORD=devbits_dev_password`
  - ports: `5433:5432` (host 5433 to avoid colliding with local PG)
  - volume: `postgres-dev-data:/var/lib/postgresql/data`
  - healthcheck: use `pg_isready`
- `backend`:
  - build: context `.` (backend folder) or adjust path so it builds the existing Go backend
  - depends_on: `db` (service_healthy)
  - environment: set `DATABASE_URL=postgres://devbits_dev:devbits_dev_password@db:5432/devbits_dev?sslmode=disable`
  - ports: `8080:8080`
  - volumes: mount `./uploads:/root/uploads` (optional)
- volumes: `postgres-dev-data` persisted locally

4. `run-dev.sh` and `run-dev.ps1`

- Behavior:
  - `cd backend`
  - `docker compose -f docker-compose.dev.yml down --volumes --remove-orphans`
  - `docker compose -f docker-compose.dev.yml up -d --build`
  - Wait for DB healthcheck (poll `docker compose -f docker-compose.dev.yml ps` or `docker exec` into the DB container and use `pg_isready`). Timeout after 60s with an error.
  - Ensure backend container is up and listening (wait for `docker compose -f docker-compose.dev.yml logs backend --since 1s` to show a startup message or poll `curl http://localhost:8080/health`).
  - Launch frontend by invoking `run-front.sh` / `run-front.ps1` in Local mode (i.e., set `EXPO_PUBLIC_USE_LOCAL_API=1` and `EXPO_PUBLIC_LOCAL_API_URL` to detected LAN IP:8080).

5. `run-db-tests.sh` and `run-db-tests.ps1`

- Behavior:
  - Recreate the dev DB: `docker compose -f backend/docker-compose.dev.yml down --volumes --remove-orphans`
  - `docker compose -f backend/docker-compose.dev.yml up -d --build`
  - Wait for DB to be healthy
  - Run backend tests in a temporary container using the repo sources (no host Go required):
    - `docker run --rm -v "$(pwd)/backend:/app" -w /app/api golang:1.24 bash -c "go test ./..."`
  - Capture and exit with the test result code.
- Cross-platform notes:
  - Use POSIX `$(pwd)` in bash; in PowerShell use `$(pwd).Path` and pass as volume to Docker.
  - Use `--network host` only on Linux if needed; prefer using mapped ports and `localhost` when possible.

6. `.env.example`

- Provide keys used by scripts/development only (example values):
  - EXPO_PUBLIC_USE_LOCAL_API=1
  - EXPO_PUBLIC_LOCAL_API_URL=http://192.168.76.129:8080
  - EXPO_PUBLIC_API_URL=https://devbits.ddns.net
  - EXPO_PUBLIC_LOCAL_API_PORT=8080
  - POSTGRES_DB=devbits_dev
  - POSTGRES_USER=devbits_dev
  - POSTGRES_PASSWORD=devbits_dev_password

7. IP detection logic (implement and validate in scripts)

- Linux (bash): `hostname -I | tr ' ' '\n' | grep -E '^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.' | head -n1`
- Windows (PowerShell):
  - `Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -eq 'Dhcp' -and $_.IPAddress -match '^10\.|^192\.168\.|^172\.' } | Select-Object -First 1 -ExpandProperty IPAddress`
- Fallback: print clear message and use `127.0.0.1`.

8. Verification checklist for Copilot to run after implementing scripts

- Fresh clone test (on Arch):
  - git clone ...
  - cd DevBits
  - chmod +x run-front.sh run-dev.sh run-db-tests.sh
  - ./run-front.sh → choose Production; Expo should start and the app should use `https://devbits.ddns.net` (verify console logs).
- Local dev full stack test:
  - ./run-dev.sh → should bring up DB + backend and then open Expo configured to use local backend at `http://<LAN-IP>:8080`
  - On phone (same WiFi) open Expo Go and confirm API calls succeed (visit `http://<LAN-IP>:8080/health` on phone browser).
- DB tests:
  - ./run-db-tests.sh → should build the dev stack and run `go test ./...` against the dev DB. Tests should run and exit with code 0.

9. Edge cases & troubleshooting (include in README or the generated scripts' header comments)

- Docker Desktop on Windows: ensure file sharing and host ports are allowed.
- If port conflicts occur (host already using 8080/5433), scripts should detect the conflict and prompt to choose alternate ports or exit with instructions.
- If contributors use WSL, Docker Desktop, or Docker Engine, document known differences in a short troubleshooting section.

10. Deliverables (what to commit)

- `run-front.sh` (new)
- `run-front.ps1` (verify, update if needed)
- `run-dev.sh` (new)
- `run-dev.ps1` (new)
- `run-db-tests.sh` (new)
- `run-db-tests.ps1` (new)
- `backend/docker-compose.dev.yml` (new)
- `.env.example` (new)
- Update `README.md` with a short "Getting started" section pointing to these scripts and the verification checklist.

Notes for Copilot: keep scripts simple and robust. Prefer clear console output and short timeouts for health checks (with sensible retries). Avoid assumptions about host tooling beyond Docker and Node.js for the frontend.

---

If you want, I can now implement these scripts for you. Tell me which platform you want me to prioritize first (Windows PowerShell or POSIX shells), or I can add both sets at once.
