# DevBits AWS Transfer (Native Backend, No Docker, No Nginx)

This runbook deploys the Go backend as a native Linux service on EC2.

## Target architecture

- Route 53 (`devbits.app`, optional `www.devbits.app`)
- ACM certificate
- Application Load Balancer (HTTPS 443)
- EC2 instance running `devbits-api` via `systemd`
- PostgreSQL on AWS RDS (recommended) or another managed Postgres

## What changed in this branch

- `devbits.ddns.net` defaults moved to `devbits.app`.
- nginx runtime dependency removed from deployment path.
- Backend serves:
  - `/apple-app-site-association`
  - `/.well-known/assetlinks.json`
  - `/privacy-policy`
  - `/account-deletion`
- Upload absolute URLs now honor `X-Forwarded-Proto` (correct behind ALB).
- Added native deploy scripts:
  - `backend/scripts/build-backend-linux.sh`
  - `backend/scripts/install-aws-systemd-service.sh`
  - `backend/scripts/deploy-aws-native.sh`
  - `backend/scripts/update-live.sh` (wrapper)

## What you give the AWS account owner

1. Repo URL + branch name.
2. Domain: `devbits.app` (+ optional `www.devbits.app`).
3. Region (example: `us-east-1`).
4. These env values for `backend/.env`:
   - `DATABASE_URL=postgres://...` (RDS endpoint, db, user, password, sslmode=require)
   - `DEVBITS_JWT_SECRET`
   - `DEVBITS_ADMIN_KEY`
   - `DEVBITS_ADMIN_LOCAL_ONLY=0` (or `1` for localhost-only admin)
   - `DEVBITS_CORS_ORIGINS=https://devbits.app,https://www.devbits.app`
   - `DEVBITS_API_ADDR=0.0.0.0:8080`
5. Optional data migration files:
   - DB dump (`devbits-db-*.sql`)
   - uploads archive

## AWS setup steps (admin)

1. Create Route 53 records for `devbits.app` and `www.devbits.app`.
2. Request ACM cert for both names.
3. Create ALB:
   - Listener `80` -> redirect to `443`
   - Listener `443` -> target group on EC2 `:8080`
   - Health check path `/health`
4. Create EC2 (Amazon Linux 2023 recommended).
5. Security groups:
   - ALB SG: inbound `80/443` from internet
   - EC2 SG: inbound `8080` from ALB SG only, `22` from admin IP only
6. Provision EC2:
   - Install `git` and `tar`: `sudo dnf install -y git tar`
   - Install Go `1.24.x` from `go.dev` tarball to `/usr/local/go`
   - Clone repo to `/opt/devbits` (typically as `ec2-user`)
   - `cd /opt/devbits/backend`
   - `cp .env.example .env` and fill real values
   - `./scripts/deploy-aws-native.sh`
7. Verify:
   - `https://devbits.app/health`
   - `https://devbits.app/privacy-policy`
   - `https://devbits.app/account-deletion`
   - `https://devbits.app/apple-app-site-association`
   - `https://devbits.app/.well-known/assetlinks.json`

## Updating backend after code changes

On EC2:

```bash
cd /opt/devbits
git pull origin <branch>
cd backend
./scripts/update-live.sh
```

Amazon Linux notes:

- Default SSH user is usually `ec2-user`.
- Use `dnf` (not `apt`) for packages.
- Keep `/opt/devbits` owned by the deploy user so build/deploy scripts can run without permission issues.

## Notes

- Docker is still available in this repo for local workflows, but AWS deployment in this runbook is native (`systemd`) and does not require Docker or nginx.
