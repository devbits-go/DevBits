# DevBits Database Scripts

All deployment database scripts are in this folder.

## Environment separation (important)

### Local DB (development machine)

Run from project root:

```powershell
cd c:\Users\eligf\DevBits
```

Use compose file path explicitly:

```powershell
docker compose -f backend/docker-compose.yml up -d
docker compose -f backend/docker-compose.yml logs -f db
```

### Live DB (deployed server)

Run on server in backend directory:

```bash
cd /path/to/DevBits/backend
docker compose up -d
docker compose logs -f db
```

Only run reset/restore in the environment you mean to modify.

## Script location

Run script commands from `backend`:

```powershell
cd backend
```

## Required env file

Before running deploy/reset/update scripts, ensure `backend/.env` exists:

```powershell
Copy-Item .env.example .env
```

Set a strong `POSTGRES_PASSWORD` value in `.env`.

## Scripts

- `scripts/reset-deployment-db.ps1` / `scripts/reset-deployment-db.sh`
- `scripts/backup-deployment-db.ps1` / `scripts/backup-deployment-db.sh`
- `scripts/restore-deployment-db.ps1` / `scripts/restore-deployment-db.sh`
- `scripts/setup-daily-backup-task.ps1`
- `scripts/disable-daily-backup-task.ps1`

## 1) Reset DB (blank slate)

Warning: this wipes all app data in that environment.

PowerShell:

```powershell
./scripts/reset-deployment-db.ps1
```

Keep uploads while resetting only DB volume:

```powershell
./scripts/reset-deployment-db.ps1 -KeepUploads
```

Bash:

```bash
./scripts/reset-deployment-db.sh
./scripts/reset-deployment-db.sh --keep-uploads
```

## 2) Backup DB (single-backup retention)

Safe for both local and live. Run it in the target environment.

PowerShell:

```powershell
./scripts/backup-deployment-db.ps1
```

Bash:

```bash
./scripts/backup-deployment-db.sh
```

Backup location:

- `backend/backups/db`

Retention policy:

- keeps only the newest `devbits-*.sql`
- deletes older backup files automatically

Backup type:

- Logical SQL dump created with `pg_dump` from the running DB container
- Not a Docker volume snapshot/image snapshot

## 3) Restore DB from latest backup

Warning: restore terminates sessions and recreates DB in that environment.

PowerShell:

```powershell
./scripts/restore-deployment-db.ps1
```

Bash:

```bash
./scripts/restore-deployment-db.sh
```

Restore behavior:

- picks latest backup file from `backend/backups/db`
- terminates active DB sessions
- drops and recreates `devbits`
- applies SQL dump

## 4) Enable daily auto backup (Windows)

Create a scheduled task at 03:00 daily:

```powershell
./scripts/setup-daily-backup-task.ps1
```

Custom time:

```powershell
./scripts/setup-daily-backup-task.ps1 -RunAt "01:30"
```

Notes:

- Script tries `SYSTEM` first.
- If shell is not elevated, it falls back to current-user mode.

Verify task:

```powershell
schtasks /Query /TN DevBitsDailyDbBackup /V /FO LIST
```

## 5) Disable daily auto backup (Windows)

```powershell
./scripts/disable-daily-backup-task.ps1
```
