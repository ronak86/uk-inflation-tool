# UK Inflation iPhone App

This folder contains the native Expo/React Native version of the UK Inflation Tool. It is a separate client from the desktop website, but uses the same exported data and calculation methodology.

## Current first build

- Native iPhone navigation with Explorer, Definitions, Errors and About tabs.
- CPI, CPIH and RPI support.
- MoM/YoY contribution, price-change and weight views.
- Single-month navigation designed for a phone screen.
- Basket hierarchy drill-down, search and sector filters.
- Live data refresh from `chitroda.com`, cached on the device.
- Bundled data fallback for first launch or offline use.

## Run locally

Install Node.js, then from this folder run:

```powershell
pnpm install
pnpm start
```

Install **Expo Go** on an iPhone and scan the QR code shown by Expo. The phone and computer should be on the same network.

## Data updates

Running `scripts/export_inflation_data.py` from the repository root now writes the same compact payload to:

- `web/data/inflation.json` for the website and live mobile refresh.
- `mobile/assets/data/inflation.json` as the app's offline fallback.

The live app normally receives new data from the website without an App Store release. A new iPhone build is only needed when code, design or the bundled fallback should change.

## Validation

Run the native type checks and calculation regression suite before creating a build:

```powershell
pnpm typecheck
pnpm test
```

The same checks run in GitHub Actions and before the scheduled inflation-data workflow publishes a changed dataset.

## TestFlight and App Store

The app is configured for EAS Build in `eas.json`. Publishing an iPhone build requires an Apple Developer account and an Expo account:

```powershell
npx eas-cli login
npx eas-cli build --platform ios --profile preview
```

Production builds are signed for App Store Connect and can be distributed through TestFlight:

```powershell
pnpm dlx eas-cli build --platform ios --profile production --auto-submit
```
