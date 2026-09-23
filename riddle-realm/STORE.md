# Riddle Realm — App Store Path

The game is a **Progressive Web App (PWA)** first. That keeps one codebase for web + installable mobile.

## Today (PWA)
- Install from Chrome / Edge / Safari (Add to Home Screen)
- Offline shell via service worker
- Standalone display (no browser chrome)

## Google Play Store
Recommended path: **Trusted Web Activity (TWA)** with [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) or **Capacitor**.

1. Host the site on HTTPS (Netlify / Vercel / Cloudflare Pages).
2. Verify Digital Asset Links.
3. Build an Android package that opens your PWA fullscreen.
4. Submit the AAB to Play Console.

Alternative: Capacitor Android project wrapping the same `www` folder.

## Apple App Store (iOS)
Apple does not list pure PWAs on the App Store. Use a native wrapper:

1. **Capacitor** (recommended for one person):
   - `npm init @capacitor/app`
   - Point `webDir` at this project build folder
   - `npx cap add ios` → open in Xcode → Archive → App Store Connect
2. Or **PWABuilder** iOS package.

Requirements you will need later:
- Apple Developer account ($99/year)
- Privacy policy URL
- App icons (use `/icons` set as a base)
- Screenshots for phone/tablet

## One codebase rule
Do **not** fork gameplay for stores. Keep:
- HTML / CSS / vanilla JS as source of truth
- Capacitor / TWA as thin shells only
- Real payments only through store IAP or Stripe when monetizing

## Social leaderboard (future server)
Local + friend challenges work offline.
Global / social ranks need a small backend (scores API + auth).
Do not ship fake global players.
