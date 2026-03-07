Deep link setup — DevBits

Purpose

- Host files for Universal Links (iOS) and App Links (Android):
  - /apple-app-site-association
  - /.well-known/assetlinks.json
- assetlinks.json needs your Android app's SHA-256 certificate fingerprint.

Steps (recommended, minimal)

1. Let EAS generate an Android keystore (if you don't have one)

- Install eas-cli if not already:

```bash
npm install -g eas-cli
```

- Login and run credential flow (this will prompt you and can generate a keystore):

```bash
eas login
# follow prompts
eas build:configure # if not configured already
eas credentials -p android
```

- In the interactive `eas credentials` UI choose to generate a new keystore (or let EAS manage it). To download the keystore file use the `eas credentials` commands or `eas cli` prompts.

2. Download the keystore (if EAS generated it)

- Use `eas credentials` to list and download the keystore. Example:

```bash
# show credentials
eas credentials -p android --profile production
# follow prompts to download the keystore (if available)
```

3. Get the SHA-256 fingerprint (requires Java keytool)

- If `keytool` is missing on Windows, install OpenJDK (temurin/adoptopenjdk) and add to PATH.
- Then run (replace values):

```bash
keytool -list -v -keystore ./path/to/keystore.jks -alias <alias>
```

- Look for the `SHA256` fingerprint in the output.

Alternative (if you use Play App Signing)

- If you already uploaded an app to Play and enabled Play App Signing, the Play Console shows the App Signing key certificate SHA-256 under Release > Setup > App integrity. Use that fingerprint for `assetlinks.json`.

4. Update `assetlinks.json`

- Open `backend/api/static/assetlinks.json` and replace `<SHA256_CERT_FINGERPRINT>` with the SHA-256 fingerprint (format: uppercase hex with colons or without; either is accepted by Android).

5. Deploy static files to your server/domain

- The Go backend now serves these files directly from `backend/api/static/`. No separate static hosting is needed.
  - `https://devbits.app/apple-app-site-association` → served from `backend/api/static/apple-app-site-association` (also available at `/.well-known/apple-app-site-association`)
  - `https://devbits.app/.well-known/assetlinks.json` → served from `backend/api/static/assetlinks.json`
- To update these files, edit them in `backend/api/static/` and redeploy the backend.

6. Verify

- iOS: use Apple's AASA validator or check device logs when opening a Universal Link.
- Android: open `https://devbits.app/.well-known/assetlinks.json` and use `adb shell am start -a android.intent.action.VIEW -d "https://devbits.app/some/path"` on a device with the app installed, or check Play Console URL handling tests.

Notes

- These files are public and do not contain secrets — only app identifiers and allowed paths.
- I added the AASA file with your Team ID already. The only missing piece is the Android SHA-256 fingerprint (or use Play Console App Signing fingerprint).

If you want, I can:

- A) Patch `assetlinks.json` with the fingerprint if you provide it (or the Play Console fingerprint).
- B) Provide exact `eas credentials` interactive steps in a single command sequence for you to run and copy the keystore here so I can inspect it (optional, but be careful with keystore secrets).

Which option do you prefer?
