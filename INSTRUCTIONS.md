# Deployment Process

## Backend

> **AWS EC2 (Amazon Linux) Native Deploy**
>
> ```bash
> # On your EC2 instance
> sudo dnf update -y
> sudo dnf install -y git tar
> ```
>
> Install Go 1.24.x (required by `backend/go.mod`):
>
> ```bash
> curl -LO https://go.dev/dl/go1.24.2.linux-amd64.tar.gz
> sudo rm -rf /usr/local/go
> sudo tar -C /usr/local -xzf go1.24.2.linux-amd64.tar.gz
> echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
> source ~/.bashrc
> go version
> ```
>
> Clone and deploy:
>
> ```bash
> sudo mkdir -p /opt/devbits
> sudo chown -R "$USER":"$USER" /opt/devbits
> cd /opt/devbits
> git clone https://github.com/devbits-go/DevBits.git .
> git checkout aws-ready-main
> cd backend
> cp .env.example .env
> # edit .env with production values (DATABASE_URL, secrets, CORS, etc.)
> ./scripts/deploy-aws-native.sh
> ```
>
> Verify service:
>
> ```bash
> sudo systemctl status devbits-api --no-pager
> sudo journalctl -u devbits-api -n 120 --no-pager
> curl -i http://127.0.0.1:8080/health
> ```
>
> [!TIP]
> AWS deploy uses native `systemd` (no Docker or nginx required in production).
> See `backend/docs/AWS_TRANSFER_NO_NGINX.md` for full runbook.

## Build

> **Android Production Build**
>
> ```bash
> npx eas build -p android --profile production
> ```

> [!NOTE]
> This generates an `.aab` file and uploads to your Expo account.

> **iOS Production Build**
>
> Replace `android` with `ios` and fill out proper credentials.
>
> ```bash
> npx eas build -p ios --profile production
> ```

> [!NOTE]
> Currently requires MY credentials. Need to add team credentials.

## Submit

> **Android to Google Play Store**
>
> Copy file out of expo and create new release on Google Play Console.

> [!NOTE]
> `npx eas submit -p android` failed, so manual submission is required until fix is in place. Im not sure what is happening.

> **iOS to App Store**
>
> ```bash
> npx eas submit -p ios --latest --profile production
> ```

---

`Workflow: AWS Backend Deploy → EAS Build → EAS Submit`
