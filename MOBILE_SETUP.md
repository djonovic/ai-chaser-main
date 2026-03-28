# Mobile App Setup (Capacitor)

This project now supports iOS and Android builds via Capacitor.

## Included in repo

- Capacitor dependencies and config
- Native projects:
  - `ios/`
  - `android/`
- Mobile scripts:
  - `npm run mobile:sync`
  - `npm run mobile:ios`
  - `npm run mobile:android`
- Mobile-aware auth redirect handling (Supabase)
- Mobile-aware Stripe checkout opening

## One-time local requirements

### iOS

- Install Xcode from App Store
- Install CocoaPods:
  - `sudo gem install cocoapods`
- Apple Developer account for App Store distribution

### Android

- Install Android Studio
- Install Java 17+ (required for Gradle)
- Configure Android SDK in Android Studio

## Environment setup

1. Copy `.env.example` to `.env`
2. Set `VITE_MOBILE_DEEP_LINK_BASE` (default is fine):
   - `VITE_MOBILE_DEEP_LINK_BASE=chaseai://auth`
3. Ensure Supabase auth redirects include:
   - `chaseai://auth`
   - `chaseai://auth/reset-password`
   - your web URL (existing)

## Deep link native config (required)

Capacitor JavaScript is wired, but native deep links still need URL scheme setup:

### iOS

1. Run `npm run mobile:ios`
2. In Xcode, open target settings for `App`
3. Add URL Type with scheme: `chaseai`
4. Rebuild and test email magic link / reset flow

### Android

1. Run `npm run mobile:android`
2. In Android Studio, set intent filter in `AndroidManifest.xml` for scheme `chaseai`
3. Rebuild and test deep links

## Build flow

1. Build and sync web assets:
   - `npm run mobile:sync`
2. Open platform projects:
   - iOS: `npm run mobile:ios`
   - Android: `npm run mobile:android`
3. Build signed artifacts:
   - iOS archive (`.ipa`) from Xcode
   - Android App Bundle (`.aab`) from Android Studio

## Store submission

### App Store

- Create app in App Store Connect
- Upload archive from Xcode Organizer
- Fill privacy details, screenshots, and metadata
- Submit for review

### Google Play

- Create app in Play Console
- Upload `.aab`
- Complete Data Safety and app content forms
- Submit to internal testing then production
