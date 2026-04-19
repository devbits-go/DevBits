# DevBits Mobile Release Checklist

This checklist is for production release readiness on iOS App Store and Google Play.

## 1) Build configuration status

- Expo Doctor: PASS (17/17)
- Bundle identifier: com.devbits.frontend
- Android package: com.devbits.frontend
- iOS associated domains: applinks:devbits.ddns.net
- Android app links file: backend/api/static/assetlinks.json
- iOS AASA file: backend/api/static/apple-app-site-association
- Production API URL: https://devbits.ddns.net

## 2) Security and production readiness checks

- Verify backend health endpoint returns 200:
  - https://devbits.ddns.net/health
- Confirm TLS certificate validity for devbits.ddns.net.
- Confirm DEVBITS_JWT_SECRET is set to a long random secret in deployment env.
- Confirm DEVBITS_ADMIN_KEY is strong and not reused.
- Confirm DEVBITS_ADMIN_LOCAL_ONLY is set based on your intended exposure model.
- Confirm upload routes and auth-required routes require JWT as expected.
- Confirm no debug or development secrets are committed.

## 3) App Store metadata and compliance checklist

Prepare/verify in App Store Connect:

- App name, subtitle, keywords, description.
- Support URL and marketing URL.
- Privacy Policy URL (must be live).
- Account deletion URL (must be live and actionable).
- Age rating questionnaire.
- Export compliance (ITSAppUsesNonExemptEncryption is false in config).
- Sign in required disclosures (if account-based app).
- Screenshots for all required device sizes.
- App preview video (optional but recommended).
- App privacy nutrition labels.

## 4) Google Play metadata and compliance checklist

Prepare/verify in Play Console:

- App name, short description, full description.
- Privacy Policy URL.
- Data safety form completed accurately.
- App access instructions (if login-gated).
- Content rating questionnaire.
- Target audience and content declarations.
- Ads declaration.
- Screenshots, feature graphic, and optional promo video.
- Testers and testing track setup.

## 5) Functional QA before submission

Test on at least one physical iOS device and one physical Android device:

- Sign up, sign in, sign out, token refresh behavior.
- Create/edit/delete stream and byte flows.
- Media upload and rendering.
- Notifications behavior.
- Deep links open correct routes.
- Background/foreground resume without session corruption.
- Bad-network behavior (timeouts, retries, user-facing errors).
- App upgrade from previous version keeps user data/session sane.

## 6) Exact EAS commands (production)

Run from frontend directory.

Install/upgrade EAS CLI globally (recommended):

- npm i -g eas-cli

Login and verify project:

- eas login
- eas whoami

Build Android production artifact:

- eas build -p android --profile production

Build iOS production artifact:

- eas build -p ios --profile production

Submit Android to Play Console (closed track, per eas.json):

- eas submit -p android --profile production

Submit iOS to App Store Connect:

- eas submit -p ios --profile production

If iOS submit needs explicit params in your environment, use:

- eas submit -p ios --profile production --apple-id YOUR_APPLE_ID --asc-app-id YOUR_ASC_APP_ID --apple-team-id YOUR_TEAM_ID

## 7) Release sequencing recommendation

- Submit Android first to closed/internal testing.
- Submit iOS to TestFlight and validate with external testers.
- Monitor crash and API error rates for 24-48 hours.
- Promote both platforms to public release after validation.
