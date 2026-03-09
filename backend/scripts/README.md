# DevBits Backend Scripts

Run scripts from `backend/`.

## 1) Update backend on AWS

On the EC2 host:

```bash
cd /opt/devbits
git pull origin aws-ready-main
cd backend
./scripts/update-live.sh
```

Verify:

```bash
sudo systemctl status devbits-api --no-pager
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
