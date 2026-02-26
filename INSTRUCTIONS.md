# DevBits Application Instructions

This document provides the essential commands for managing the backend services with Docker and for building and deploying the frontend application.

## Backend Management (Docker)

Use separate command sets for each environment.

### Local DB + Backend (your dev machine)

Run from project root (`c:\Users\eligf\DevBits`):

```bash
docker compose -f backend/docker-compose.yml up -d
```

Rebuild local backend image:

```bash
docker compose -f backend/docker-compose.yml up -d --build
```

Stop local stack:

```bash
docker compose -f backend/docker-compose.yml down
```

Restart local stack:

```bash
docker compose -f backend/docker-compose.yml restart
```

View local logs:

```bash
docker compose -f backend/docker-compose.yml logs -f backend
docker compose -f backend/docker-compose.yml logs -f db
docker compose -f backend/docker-compose.yml logs -f nginx
```

### Live/Deployed DB + Backend (your server)

Run these only on your deployed host where DevBits is installed.

Create backend environment file once (required):

```bash
cd /path/to/DevBits/backend
cp .env.example .env
# edit .env and set a strong POSTGRES_PASSWORD before first deploy
```

```bash
cd /path/to/DevBits/backend
docker compose up -d
docker compose logs -f db
```

Rebuild and restart deployment containers:

```bash
cd /path/to/DevBits/backend
docker compose up -d --build
```

Stop deployment stack:

```bash
cd /path/to/DevBits/backend
docker compose down
```

Important safety note:

- Deployment reset/restore scripts in `backend/scripts` are destructive and should only be run in the environment you intend to modify.
- Never run reset commands against live DB unless you explicitly want a full wipe.

### Deployment DB scripts

All deployment database script usage is documented in:

- `backend/scripts/README.md`

## Local Development & Testing

This section covers running the full application locally with a PostgreSQL test database and running tests.

### Quick Start (Recommended)

The easiest way to run the entire local development environment:

```bash
./run-front.sh
```

This starts:
1. Test PostgreSQL database (auto-seeds with test data)
2. Local Go backend on port 8080
3. Frontend with QR code for Expo Go

Scan the QR code with Expo Go on your phone. The app will automatically connect to your local backend.

**Press Ctrl+C** to stop everything and restore production Docker containers.

---

### Prerequisites

1. Install Docker and Docker Compose
2. Copy the test environment file:

```bash
cd backend
cp .env.test.example .env.test
```

---

### Manual Commands

**Start test database only:**
```bash
cd backend
docker compose -f docker-compose.test.yml up -d
```

**Run backend only:**
```bash
cd backend
USE_TEST_DB=true go run ./api
```

**Run tests:**
```bash
./run-tests.sh
```

**Reset test data (delete and recreate):**
```bash
docker compose -f backend/docker-compose.test.yml down -v
docker compose -f backend/docker-compose.test.yml up -d
```

---

### Production Docker (Regular Dev)

To switch back to production Docker:

```bash
cd backend
docker compose up -d
```

---

### CI/CD

Tests run automatically on GitHub Actions for every push and pull request. See `.github/workflows/test.yml` for details.

## Frontend Management (EAS)

All frontend commands should be run from the `frontend` directory (`c:\Users\eligf\DevBits\frontend`).

### Install Dependencies

If you haven't already, or if you've pulled new changes, install the necessary Node.js packages:

```bash
npm install
```

### Build the Android App

To create a production build of the Android application for the Google Play Store:

```bash
npx eas build -p android --profile production
```

This will generate an `.aab` file and upload it to your Expo account.

### Submit to Google Play Store

After a successful build, you can submit the latest build to the Google Play Store for internal testing:

```bash
npx eas submit -p android --latest --profile production
```

This command will automatically find the latest build, download it, and upload it to the Google Play Console.
