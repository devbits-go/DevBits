# Deployment Process

## Backend

> **Live/Deployed Stack**
>
> ```bash
> cd /path/to/DevBits/backend
> docker compose up -d
> docker compose logs -f db
> ```

> Rebuild and restart:
>
> ```bash
> docker compose up -d --build
> ```

> [!TIP]
> Check `backend/scripts/README.md` for database operations.

## Build

> **Android Production Build**
>
> ```bash
> npx --yes eas-cli build -p android --profile production
> ```

> [!NOTE]
> This generates an `.aab` file and uploads to your Expo account.

> **iOS Production Build**
>
> Replace `android` with `ios` and fill out proper credentials.
>
> ```bash
> npx --yes eas-cli build -p ios --profile production
> ```

> [!NOTE]
> If iOS build fails with Apple 403 / PLA message, accept the latest Apple Developer Program License Agreement first:
> https://developer.apple.com/account

## Submit

> **Android to Google Play Store**
>
> Copy file out of expo and create new release on Google Play Console.

> [!NOTE]
> Use:
> ```bash
> npx --yes eas-cli submit -p android --latest --profile production
> ```
> If it fails, verify the service account key path in `frontend/eas.json` points to `../devbits-play-service-account.json` and that Google Play API access is enabled for the linked service account.

> **iOS to App Store**
>
> ```bash
> npx --yes eas-cli submit -p ios --latest --profile production
> ```

---

`Workflow: Backend Setup → EAS Build → EAS Submit`
