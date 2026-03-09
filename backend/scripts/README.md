# DevBits Backend Scripts

Run scripts from `backend/`.

## 1) Update backend on AWS

Build locally, then copy binary to EC2 (recommended):

```bash
# local machine
cd /home/ws-73/OldFiles/projects/DevBits/backend
TARGET_GOOS=linux TARGET_GOARCH=amd64 ./scripts/build-backend-linux.sh
scp -i <key.pem> ./bin/devbits-api ec2-user@<EC2_PUBLIC_IP>:/tmp/devbits-api
```

On the EC2 host:

```bash
cd /opt/devbits
# Save any local EC2 edits before pulling
git stash push -u -m "ec2-local-before-pull-$(date +%Y%m%d-%H%M%S)"
git pull origin aws-ready-main
cd backend
sudo mv /tmp/devbits-api ./bin/devbits-api
sudo chown ec2-user:ec2-user ./bin/devbits-api
sudo chmod +x ./bin/devbits-api
sudo ./scripts/install-aws-systemd-service.sh
```

If you intentionally want to discard local EC2 changes instead:

```bash
cd /opt/devbits
git reset --hard
git clean -fd
git pull origin aws-ready-main
cd backend
./scripts/deploy-aws-native.sh
```

Verify:

```bash
sudo systemctl status devbits-api --no-pager
curl -i http://127.0.0.1:8080/health
```

## 1.1) Extra AWS checks

Run on EC2:

```bash
# Service state
sudo systemctl is-active devbits-api
sudo systemctl status devbits-api --no-pager

# Process is listening on 8080
sudo ss -ltnp | grep ':8080'

# Recent service logs
sudo journalctl -u devbits-api -n 150 --no-pager

# Follow logs live while testing app traffic
sudo journalctl -u devbits-api -f
```

Database connectivity check (from EC2):

```bash
# Ensure PostgreSQL client tools are installed
sudo dnf install -y postgresql15

# Uses DATABASE_URL from backend/.env
cd /opt/devbits/backend
set -a; . ./.env; set +a
psql "$DATABASE_URL" -c "select current_user, current_database();"
```

DNS/public checks (from local machine or EC2):

```bash
dig +short devbits.app
curl -i https://devbits.app/health
curl -i https://devbits.app/privacy-policy
curl -i https://devbits.app/.well-known/assetlinks.json
curl -i https://devbits.app/apple-app-site-association
```

Target group health check path should return 200:

```bash
curl -i http://127.0.0.1:8080/health
```

## 2) Script usage

Deploy/build:

- `scripts/build-backend-linux.sh`
  - Build backend binary to `bin/devbits-api`.
- `scripts/install-aws-systemd-service.sh`
  - Install/restart `devbits-api` systemd service.
- `scripts/deploy-aws-native.sh`
  - Build + install/restart in one command.
- `scripts/update-live.sh`
  - Wrapper for `deploy-aws-native.sh`.

Database scripts (use `DATABASE_URL` in `backend/.env`):

- `scripts/reset-deployment-db.sh`
- `--keep-uploads` to keep uploads.
- `scripts/backup-deployment-db.sh`
- `scripts/restore-deployment-db.sh`
- restores latest `devbits-db-*.sql` and matching uploads archive if present.

Required tools for DB scripts:

- Linux: `postgresql` client package (`psql`, `pg_dump`)
