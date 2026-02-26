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

The easiest way to run the full local development environment:

```bash
./run-front.sh
```

This starts:
- Test PostgreSQL database (auto-seeds with test data)
- Local Go backend on port 8080
- Frontend with QR code for Expo Go

Scan the QR code with Expo Go on your phone. The app will automatically connect to your local backend.

**Press Ctrl+C** to stop everything and restore production Docker containers.

### Prerequisites

1. Install Docker and Docker Compose
2. Copy the test environment file:

```bash
cd backend
cp .env.test.example .env.test
```

For detailed instructions, see [INSTRUCTIONS.md](INSTRUCTIONS.md).

## Deployment DB scripts

All deployment database script commands and usage are documented in:

- [backend/scripts/README.md](backend/scripts/README.md)
