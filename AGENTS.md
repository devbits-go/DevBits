# DevBits Agent Guidelines

This document provides essential information for AI coding agents working on the DevBits codebase.

## Project Overview

DevBits is a social media mobile application for developers, built with:
- **Backend**: Go 1.24 + Gin framework + PostgreSQL/SQLite
- **Frontend**: React Native 0.81.5 + Expo SDK 54 + TypeScript 5.3
- **Architecture**: Monorepo with separate `/backend` and `/frontend` directories

## Build, Lint, and Test Commands

### Frontend (run from `/frontend` directory)

```bash
# Development
npm run frontend              # Start Expo dev server
npm run android              # Start on Android device/emulator
npm run ios                  # Start on iOS device/simulator

# Testing
npm test                     # Run Jest tests
npm test -- ComponentName    # Run tests for specific component

# Linting
npm run lint                 # Run ESLint with Expo config

# Building
npx eas build -p android --profile production    # Build Android APK/AAB
npx eas build -p ios --profile production        # Build iOS app
```

### Backend (run from `/backend` directory)

```bash
# Development
go run ./api                 # Start API server locally

# Testing
cd backend
go test ./api/internal/tests/              # Run all tests
go test ./api/internal/tests/ -v           # Run with verbose output
go test ./api/internal/tests/ -run TestUsers  # Run specific test

# Building
go build -o bin/api ./api    # Build binary

# Docker
docker compose up -d          # Start all services (Postgres, API, Nginx)
docker compose up -d --build  # Rebuild and restart
docker compose logs -f backend # View backend logs
```

## Code Style Guidelines

### TypeScript/React Native (Frontend)

#### File Organization
- Use PascalCase for component files: `Post.tsx`, `UserCard.tsx`
- Use camelCase for utility/hook files: `useAppColors.ts`, `api.ts`
- Components go in `/frontend/components/`
- Pages use Expo Router file-based routing in `/frontend/app/`
- Custom hooks in `/frontend/hooks/`
- API services in `/frontend/services/`

#### Imports
- Group imports: React/React Native → third-party → local
- Use path alias `@/` for imports: `import { useAppColors } from "@/hooks/useAppColors"`
- Order: components, hooks, contexts, services, types, constants

```typescript
import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { useAppColors } from "@/hooks/useAppColors";
import { getPostsFeed } from "@/services/api";
import { UiPost } from "@/constants/Types";
```

#### TypeScript Types
- Define interfaces in `/frontend/constants/Types.ts` for API models
- Use type inference where obvious: `const [count, setCount] = useState(0)`
- Explicit types for function parameters and returns:
  ```typescript
  const mapPostToUi = (post: PostProps): UiPost => { ... }
  ```
- Use `interface` for object shapes, `type` for unions/intersections

#### Component Style
- Functional components with hooks
- Export default for page components, named exports for reusable components
- Use `useMemo` and `useCallback` for performance optimization
- Prefer StyleSheet.create() for styles at bottom of file
- Use Reanimated for complex animations, Animated API for simple ones

#### Naming Conventions
- Components: PascalCase (`Post`, `UserCard`)
- Hooks: camelCase with `use` prefix (`useAppColors`, `useMotionConfig`)
- Functions/variables: camelCase (`getCachedCommentCount`, `postData`)
- Constants: UPPER_SNAKE_CASE or camelCase for config objects
- Event handlers: `onPress`, `handleSubmit`, etc.

#### Error Handling
- Use try/catch for async operations
- Show user-friendly error messages via Alert.alert()
- Log errors for debugging: `console.error("Failed to fetch:", error)`
- Handle loading and error states in UI

### Go (Backend)

#### File Organization
- Package per feature: `handlers/`, `database/`, `auth/`, `logger/`
- Route handlers in `/backend/api/internal/handlers/*_routes.go`
- Database queries in `/backend/api/internal/database/*_queries.go`
- Test files in `/backend/api/internal/tests/`

#### Imports
- Group: standard library → third-party → local
- Use explicit package names for local imports:
  ```go
  import (
      "database/sql"
      "fmt"
      "net/http"
      
      "github.com/gin-gonic/gin"
      
      "backend/api/internal/database"
      "backend/api/internal/logger"
  )
  ```

#### Naming Conventions
- Exported functions/types: PascalCase (`GetUserById`, `ApiUser`)
- Unexported: camelCase (`setupTestRouter`, `respondWithError`)
- Interfaces: PascalCase, often with `-er` suffix (`Handler`, `Querier`)
- Constants: PascalCase or ALL_CAPS for package-level

#### Error Handling
- Return errors explicitly: `func GetUser(id int) (*User, error)`
- Use `fmt.Errorf` with `%w` for error wrapping: `fmt.Errorf("failed to parse: %w", err)`
- Check errors immediately: `if err != nil { return err }`
- Use `RespondWithError(context, status, message)` in handlers
- Log errors using the logger package

#### Types and Structs
- Use struct tags for JSON/DB mapping:
  ```go
  type ApiUser struct {
      Id       int    `json:"id"`
      Username string `json:"username" binding:"required"`
  }
  ```
- Pointer receivers for methods that modify state
- Value receivers for read-only methods

#### Database
- Use parameterized queries with `$1, $2, ...` placeholders (PostgreSQL style)
- Always check `sql.ErrNoRows` when expecting single results
- Use `json.Marshal/Unmarshal` for JSON columns (links, settings)
- Transaction handling for multi-step operations

#### Testing
- Use table-driven tests with `TestCase` structs
- Test setup: create in-memory SQLite DB, initialize tables
- Use `httptest.NewServer` for HTTP testing (no external network)
- Use `testify/assert` for assertions: `assert.Equal(t, expected, actual)`
- Sequential test execution to avoid race conditions

## Common Patterns

### Frontend
- Context for global state (Auth, Notifications, Preferences, Saved)
- Custom hooks for reusable logic (colors, motion, auto-refresh)
- Event emitters for real-time updates (`postEvents.ts`, `projectEvents.ts`)
- Caching strategies for performance (comment counts, media URLs)

### Backend
- JWT middleware: `handlers.RequireAuth()` protects routes
- CORS configured for local and production origins
- File uploads to `/uploads` directory with media ingestion
- WebSocket support for real-time features
- Health check endpoint: `/health`

## Testing Guidelines

- **Write tests** for new API endpoints and database queries
- **Frontend**: Test components with Jest + React Test Renderer
- **Backend**: Use table-driven tests, test both success and error cases
- **Run tests** before committing significant changes
- Test file naming: `*_test.go` (Go), `*-test.tsx` (TypeScript)

## Important Notes

- **Never commit** `.env` files or credentials
- **Database migrations**: Schema in `create_tables.sql`
- **Media files**: Images/videos go to `/backend/uploads/`
- **API base URL**: Production uses `https://devbits.ddns.net`
- **Deep linking**: Custom scheme `devbits://`
- **Version**: Frontend v1.0.2, Android versionCode 14

## Documentation

- Main instructions: `/INSTRUCTIONS.md`
- Database scripts: `/backend/scripts/README.md`
- Publishing guide: `/README_PUBLISHING.md`
