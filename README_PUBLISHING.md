# DevBits — Publishing & Current Status

This file summarizes what I changed in the repo to prepare for App Store / Play Store publishing, and the remaining steps to finish iOS release (TestFlight/App Store) and Android (Play Store).

---

## What I changed (completed)

- Frontend
  - `frontend/app.json`
    - Set `bundleIdentifier` to `com.devbits.frontend`.
    - Added `ios.associatedDomains` with `applinks:devbits.ddns.net`.
  - `frontend/eas.json`
    - Added production envs: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_API_FALLBACK_URL`, `EXPO_PUBLIC_SITE_URL` (all pointing to `https://devbits.ddns.net`).
    - Set `credentialsSource` to `remote` so EAS will use Expo-stored iOS credentials.
  - `frontend/public/apple-app-site-association` and `frontend/public/.well-known/assetlinks.json` — templates added for Universal Links / App Links.
  - `frontend/DEEP_LINK_SETUP.md` — instructions for extracting Android keystore fingerprints and deep link setup.

- Backend
  - `backend/nginx/nginx.conf` — added explicit locations to serve `/apple-app-site-association` and `/.well-known/assetlinks.json` as JSON.
  - `backend/Dockerfile` + `backend/docker-entrypoint.sh` — added entrypoint to auto-generate `DEVBITS_JWT_SECRET` if not provided at runtime.
  - `backend/.env.example` — documented `DEVBITS_JWT_SECRET` and APNs environment hints.

- Repo security/devops
  - Root and `frontend` `.gitignore` updated to ignore keystores, service accounts, `.env`, and other secrets.
  - `.githooks/pre-commit` added to scan staged files for secrets; enable scripts included.

---

## What remains (high-priority)

1. Verify TLS for `https://devbits.ddns.net` (Universal Links require a valid public CA certificate).
2. Set a persistent `DEVBITS_JWT_SECRET` in production environment (entrypoint generates a secret if missing, but persist it).
3. Apple Developer / App Store setup:
   - Create App ID with bundle id `com.devbits.frontend` and enable capabilities: Associated Domains, Push Notifications, (Sign in with Apple if needed).
   - Create an APNs Key (`AuthKey_*.p8`) in developer.apple.com and store it securely.
   - Create an App Store Connect API Key (Team/Individual key) and upload the `.p8`, record Key ID + Issuer ID.
4. Upload App Store Connect API Key to the Expo account (Dashboard → Account → Credentials → App Store Connect API Keys) — optional but required for non-interactive CI submission.
5. Upload APNs `.p8` to Expo (optional) and store a copy in your backend secret manager (recommended env: `DEVBITS_APNS_KEY_BASE64`, `DEVBITS_APNS_KEY_ID`, `DEVBITS_APPLE_TEAM_ID`, `DEVBITS_APP_BUNDLE_ID`).
6. Build iOS with EAS and upload to TestFlight. (You can build now and upload manually if you prefer.)
7. Prepare App Store listing (screenshots, descriptions, privacy answers, support URL) and submit to review.

---

## Commands to run now (build & upload flow)

- Login & check credentials:

```bash
cd frontend
eas login
eas credentials --platform ios
```

- Start an interactive iOS build (will use Expo remote credentials if uploaded):

```bash
eas build -p ios --profile production
```

- Download an artifact and submit manually (or let EAS submit):

```bash
eas build:list --platform ios
eas build:download --platform ios --id <BUILD_ID>
# then upload `.ipa` via Transporter (macOS) or use `eas submit` with proper keys
```

---

## APNs & server push (what to store and where)

- The backend (Go service) is the component that sends push notifications. The mobile frontend only receives device tokens.
- Store the APNs `.p8` in your production secrets; do not commit to git.
- Recommended env variables:
  - `DEVBITS_APNS_KEY_BASE64` — base64 encoding of the `.p8` file
  - `DEVBITS_APNS_KEY_ID` — the App Store key id
  - `DEVBITS_APPLE_TEAM_ID` — your Apple Team ID
  - `DEVBITS_APP_BUNDLE_ID` — `com.devbits.frontend`

Example to create `DEVBITS_APNS_KEY_BASE64`:

```bash
base64 AuthKey_ABC123.p8 > authkey_b64.txt
export DEVBITS_APNS_KEY_BASE64="$(cat authkey_b64.txt)"
```

I can add backend code to decode `DEVBITS_APNS_KEY_BASE64` and initialize an APNs client when you want.

---

## Notes / FAQs

- Do you need APNs `.p8` to build the iOS .ipa? No — APNs `.p8` is not required to produce a signed build. It's required for server push functionality later, and sometimes for provisioning when manually managing certs.
- Will the bundle show up in App Store Connect automatically after uploading the App Store Connect API key to Expo? No. Uploading the API key to Expo allows EAS/Expo to authenticate to App Store Connect and submit builds. The App ID in Apple Developer either needs to be created manually, or EAS can create it for you during the credential provisioning step if you allow it.
- Can you test in Expo Go? Expo Go runs JS bundles in a shared native app and is not a signed standalone app — Universal Links, push notifications and any custom native code require building a standalone app via EAS.

---

If you want, I can:

- Run the interactive CLI flow and upload the App Store Connect `.p8` to your Expo account (you'll need to provide the `.p8` path and Key ID + Issuer ID when prompted).
- Start an `eas build -p ios --profile production` now.
- Add backend code to initialize APNs from `DEVBITS_APNS_KEY_BASE64`.

Tell me which of the three you want next.
