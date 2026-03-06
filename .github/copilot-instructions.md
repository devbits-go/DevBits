# Copilot Instructions for DevBits

## Project Overview

DevBits is a social platform for developers to share project updates — a crossover between X (Twitter) and LinkedIn focused on real technical content. Key concepts:

- **Streams** – Projects (the core entity; users must have a project to post)
- **Bytes** – Posts/updates about a project
- **Bits** – Comments on posts or projects
- Anyone can like, comment, and follow regardless of project count.

## Repository Structure

```
DevBits/
├── backend/           # Go REST API (Gin framework)
│   ├── api/
│   │   ├── main.go    # Entry point, router setup
│   │   ├── admin/     # Admin UI (static HTML)
│   │   ├── devbits-api/ # (additional API modules)
│   │   └── internal/
│   │       ├── auth/      # JWT authentication middleware
│   │       ├── database/  # DB connection, migrations, queries
│   │       ├── handlers/  # HTTP handler functions (one file per resource)
│   │       ├── logger/    # Logrus-based structured logging
│   │       ├── spec/      # Shared types/specs
│   │       └── tests/     # Integration tests
│   ├── scripts/       # DB backup/restore/reset scripts
│   ├── docker-compose.yml       # Production stack
│   ├── docker-compose.dev.yml   # Local dev stack
│   └── docker-compose.test.yml  # Test stack
├── frontend/          # React Native + Expo (TypeScript)
│   ├── app/           # Expo Router screens (file-based routing)
│   ├── components/    # Reusable UI components
│   ├── contexts/      # React contexts (auth, theme, etc.)
│   ├── features/      # Feature-specific logic
│   ├── hooks/         # Custom React hooks
│   ├── services/      # API client and service layer
│   └── constants/     # Shared constants and theme values
├── Bash-Scripts/      # Shell convenience scripts (run-dev.sh, etc.)
├── Powershell-Scripts/# PowerShell equivalents for Windows
└── .env.example       # Environment variable template
```

## Tech Stack

### Backend
- **Language**: Go 1.24
- **Framework**: Gin (HTTP router/middleware)
- **Database**: PostgreSQL (production/dev) and SQLite (test/local fallback)
- **Auth**: JWT via `golang-jwt/jwt`
- **Logging**: Logrus (`github.com/sirupsen/logrus`)
- **Testing**: `github.com/stretchr/testify`

### Frontend
- **Language**: TypeScript
- **Framework**: React Native with Expo (~54)
- **Navigation**: Expo Router v6 (file-based routing)
- **Testing**: Jest + jest-expo
- **Linting**: ESLint with eslint-config-expo

## Local Development

### Prerequisites
- Docker and Docker Compose v2
- Node.js / npm
- Go 1.24+

### Starting the stack

```bash
# Frontend only (connects to production API)
./run-front.sh        # or .\run-front.ps1 on Windows

# Full local stack (PostgreSQL + backend + frontend)
./run-dev.sh          # or .\run-dev.ps1 on Windows

# Backend only
cd backend && go run ./api

# Frontend only
cd frontend && npm run frontend
```

### Running tests

```bash
# Backend integration tests (requires PostgreSQL)
./run-db-tests.sh     # or .\run-db-tests.ps1 on Windows
# Direct: cd backend && go test -v ./api/internal/tests/...

# Frontend unit tests
cd frontend && npm test

# Frontend linting
cd frontend && npm run lint
```

### Environment setup

Copy `.env.example` to `.env` and fill in values:
- `EXPO_PUBLIC_USE_LOCAL_API=1` to use local backend
- `EXPO_PUBLIC_LOCAL_API_URL` points to your backend (e.g. `http://192.168.x.x:8080`)
- `POSTGRES_*` vars are used by Docker Compose for the local DB

Backend reads additional env vars at startup: `DEVBITS_DEBUG`, `DEVBITS_CORS_ORIGINS`, `DEVBITS_API_ADDR`, `DEVBITS_ADMIN_KEY`, `DEVBITS_ADMIN_LOCAL_ONLY`.

## Code Conventions

### Backend (Go)
- One handler file per resource (e.g. `handlers/users.go`, `handlers/posts.go`)
- Middleware is applied at the router level in `main.go`; per-route middleware is chained inline: `handlers.RequireAuth(), handlers.RequireSameUser(), handlers.Handler`
- Use `context` (Gin's `*gin.Context`) as the parameter name for handler functions
- Return JSON responses with `context.JSON(statusCode, gin.H{...})` or a typed struct
- Database queries live in `internal/database/`; handlers call DB functions, not raw SQL
- Use logrus for structured logging; avoid bare `fmt.Println` in production paths
- Error responses use the pattern `context.JSON(http.StatusXxx, gin.H{"error": "message"})`

### Frontend (TypeScript / React Native)
- File-based routing via Expo Router; screens live in `app/`
- Reusable components in `components/`; feature-specific logic in `features/`
- Use custom hooks from `hooks/` for shared state/logic (e.g. `useAppColors`, `useAuth`)
- Access the API through `services/api.ts`; do not make fetch calls directly from components
- Use `ThemedText`, `useAppColors`, and other theme-aware primitives for consistent styling
- `StyleSheet.create({})` for component styles; keep styles at the bottom of each file

## API Patterns

- Auth-required routes use `handlers.RequireAuth()` middleware
- Owner-only routes additionally use `handlers.RequireSameUser()`
- Route parameters: `:username`, `:user_id`, `:project_id`, `:post_id`, `:comment_id`
- Base URL: `http://localhost:8080` (local), `https://devbits.ddns.net` (production)
- Health check endpoint: `GET /health`

## Deployment

See [INSTRUCTIONS.md](../INSTRUCTIONS.md) for full deployment steps.

- **Backend**: Docker Compose (`docker compose up -d --build` in `backend/`)
- **Mobile**: EAS Build (`npx eas build -p android --profile production`)
- **DB operations**: See `backend/scripts/README.md`
