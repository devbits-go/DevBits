# DevBits Backend Scripts

Run scripts from `backend/`.

## Native AWS deploy scripts (recommended)

- `scripts/build-backend-linux.sh`
  - Builds `bin/devbits-api` for Linux.
- `scripts/install-aws-systemd-service.sh`
  - Installs/restarts `devbits-api` systemd service.
- `scripts/deploy-aws-native.sh`
  - Build + install/restart service in one command.
- `scripts/update-live.sh`
  - Wrapper around native deploy script.
- `scripts/update-live.ps1`
  - Runs the Linux deploy script remotely over SSH from Windows.

See: `backend/docs/AWS_TRANSFER_NO_NGINX.md`

Amazon Linux defaults:

- SSH user is typically `ec2-user`.
- Package manager is `dnf`.
- Native deploy scripts install/run `devbits-api` as a `systemd` service.

## Database backup/reset scripts (Docker-based)

These scripts are for environments where Postgres runs via `docker compose`:

- `scripts/reset-deployment-db.ps1` / `scripts/reset-deployment-db.sh`
- `scripts/backup-deployment-db.ps1` / `scripts/backup-deployment-db.sh`
- `scripts/restore-deployment-db.ps1` / `scripts/restore-deployment-db.sh`
- `scripts/setup-daily-backup-task.ps1`
- `scripts/disable-daily-backup-task.ps1`

If production uses RDS/native Postgres, use `pg_dump`/`psql` against RDS instead of these Docker-targeted scripts.
