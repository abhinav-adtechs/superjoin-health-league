# Office Health League – iOS App

Native iOS wrapper for the Office Health League webapp using **Capacitor**. The app loads the deployed webapp in a WebView and uses native plugins (e.g. **Apple HealthKit**) for device features.

## Prerequisites

- **Xcode** 15+ (with iOS 14+ SDK)
- **Node.js** 18+
- **CocoaPods** (`gem install cocoapods` or `brew install cocoapods`)
- **Apple Developer account** (for HealthKit on a real device)

## Setup

### 1. Install dependencies

From the **project root** (not `ios/`):

```bash
npm install
```

> The project uses `.npmrc` with `legacy-peer-deps=true` because `@perfood/capacitor-healthkit` declares a Capacitor 4 peer dependency while the project uses Capacitor 7. This allows both Vercel deployments and local iOS development to work.

### 2. Sync Capacitor to iOS

```bash
npm run cap:sync
# or: npx cap sync ios
```

This will:

- Copy web assets from `public/` to `ios/App/App/public`
- Generate `capacitor.config.json` in the iOS app
- Update native plugin dependencies (including HealthKit)

### 3. Install CocoaPods

```bash
cd ios/App
pod install
cd ../..
```

### 4. Open in Xcode

```bash
npm run ios
# or: npx cap open ios
```

Or open `ios/App/App.xcworkspace` in Xcode (use the workspace, not the `.xcodeproj`).

## HealthKit

- **Info.plist** already includes `NSHealthShareUsageDescription` and `NSHealthUpdateUsageDescription`.
- **App.entitlements** enables the HealthKit capability.
- **Apple Developer Portal**: ensure the HealthKit capability is enabled for the App ID `ai.superjoin.officehealth` and that your provisioning profile includes it.

## App configuration

- **Web URL**: The app loads the URL from `NEXT_PUBLIC_APP_URL` or `CAPACITOR_SERVER_URL` (see `capacitor.config.ts`). Defaults to `http://localhost:3003` for local dev.
- **Local dev**: Set `CAPACITOR_SERVER_URL=http://localhost:3003` and `CAPACITOR_CLEARTEXT=true`, then run `cap sync ios` and rebuild.
- **Recovery gestures**: The iOS shell enables pull-to-refresh and the native swipe gesture for back/forward navigation in the WebView.

## Build & run

1. Open `ios/App/App.xcworkspace` in Xcode.
2. Select a simulator or a connected device.
3. Build and run (⌘R).

## Troubleshooting

- **“Sandbox not in sync with Podfile.lock”** → Run `pod install` in `ios/App`.
- **HealthKit permission denied** → Confirm HealthKit is enabled for your App ID in the Apple Developer Portal and that the provisioning profile includes it.
- **WebView shows blank** → Check the server URL in `capacitor.config.ts` and that the webapp is reachable.
