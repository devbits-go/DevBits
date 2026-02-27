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

`Workflow: Backend Setup → EAS Build → EAS Submit`
