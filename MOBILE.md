# Shipping Dew of Hermon to the App Store & Google Play

This app is a server-rendered Next.js site hosted on Vercel. Rather than
rewriting it, we wrap it with [Capacitor](https://capacitorjs.com): thin native
iOS and Android apps that load the **live site** and add native capabilities
(splash screen, push, status bar). This document is the end-to-end runbook.

---

## 1. How it works

```
┌──────────────┐     loads      ┌─────────────────────────────┐
│  iOS app     │ ─────────────▶ │  https://dew-of-hermon-     │
│  Android app │     (live)     │  xy9h.vercel.app  (Vercel)  │
└──────────────┘                └─────────────────────────────┘
   Capacitor shell                  your existing Next.js app
```

- The native shells point at your live Vercel URL (`server.url` in
  `capacitor.config.ts`).
- **Web/UI/logic changes ship instantly** — deploy to Vercel and the installed
  apps pick them up on next launch. No re-submission needed.
- Only **native-level changes** (app icon, splash, plugins, bundle id, native
  code) require a rebuild and a new store submission.
- If the phone is offline, the small shell in `mobile/index.html` shows a
  branded "you're offline" screen instead of a blank page.

---

## 2. What is already set up in this repo

| Item | Location | Notes |
|------|----------|-------|
| Capacitor + plugins | `package.json` | core, cli, ios, android, app, splash-screen, status-bar, push-notifications |
| Capacitor config | `capacitor.config.ts` | appId, app name, live URL, splash + push config |
| Offline shell | `mobile/index.html` | shown only when the live site is unreachable |
| App icons (web/PWA) | `public/icons/` | 192, 512, apple-touch, favicon |
| Icon/splash sources | `resources/` | `icon.png`, `splash.png`, `splash-dark.png` for native generation |
| Fixed PWA manifest | `public/manifest.json` | now points at real icons + full metadata |
| Metadata wiring | `src/app/layout.tsx` | manifest link, apple-web-app, theme color |

Everything above is committed. The `ios/` and `android/` native projects are
**not** in the repo yet — you generate those on your Mac in step 4.

---

## 3. Prerequisites (one time)

**Accounts**
- [ ] Apple Developer Program — **$99/year** — https://developer.apple.com/programs/
- [ ] Google Play Console — **$25 one-time** — https://play.google.com/console/signup

**Tools on your Mac**
- [ ] Node 18+ (you already use this)
- [ ] **Xcode** (from the Mac App Store) + command line tools:
      `xcode-select --install`
- [ ] **CocoaPods**: `sudo gem install cocoapods`
- [ ] **Android Studio** (https://developer.android.com/studio) + a JDK 17
- [ ] Accept Android SDK licenses inside Android Studio

**Decide your bundle identifier NOW**
- Currently `com.dewofhermon.app` in `capacitor.config.ts`.
- This is **permanent** per store — changing it later means new listings.
- If you want a different one (e.g. tied to a domain you own), change it in
  `capacitor.config.ts` before step 4.

---

## 4. One-time project setup (on your Mac)

```bash
# get this branch and install
git pull origin claude/serene-euler-dv27b6
npm install

# create the native projects
npx cap add ios
npx cap add android

# generate all native app icons + splash screens from resources/
npx capacitor-assets generate

# copy config + assets into the native projects
npx cap sync
```

After this you'll have `ios/` and `android/` folders. Commit them — they hold
native config you'll tweak (signing, capabilities). Build *output* is already
git-ignored.

---

## 5. Run it on a device / simulator

```bash
npx cap run ios          # pick a simulator, or a connected iPhone
npx cap run android      # pick an emulator, or a connected phone

# or open the native IDE to run/debug:
npx cap open ios         # Xcode
npx cap open android     # Android Studio
```

You should see the splash, then your live app load. Test sign-in, navigation,
and a few flows.

---

## 6. Push notifications

Your backend already stores **FCM tokens** (`/api/fcm-tokens`) and sends via
`firebase-admin`. Native push reuses that exact backend — each device just needs
to register its token to the same endpoint.

### Android (works with what's installed)
The `@capacitor/push-notifications` plugin returns an **FCM token** on Android,
which your backend already understands.
1. In the [Firebase console](https://console.firebase.google.com) → your
   `potterswheel` project → add an **Android app** with package
   `com.dewofhermon.app`.
2. Download `google-services.json` → place in `android/app/`.
3. Run `npx cap sync android`.

### iOS (needs one follow-up — see note)
On iOS the core plugin returns a raw **APNs** token, which your FCM-based backend
**cannot** send to directly. To get an FCM token on iOS you need the
`@capacitor-firebase/messaging` plugin — but its current version requires
**`firebase@^12`**, and this app is on `firebase@^10`. That upgrade should be
done and tested deliberately, not as part of store setup.

**Recommendation:** ship Android push now; treat iOS push as a separate task
(upgrade `firebase` 10→12, add `@capacitor-firebase/messaging`, wire the iOS
APNs key in Firebase). Claude can do this with you in a focused change.

### Client registration (small branch to add)
When you're ready, add a helper that registers the device token on login. On
native it posts to your existing endpoint:

```ts
// src/lib/native-push.ts  (illustrative — wire into your login flow)
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

export async function registerNativePush(userId: string) {
  if (!Capacitor.isNativePlatform()) return; // web keeps using your web-FCM flow

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt") perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return;

  await PushNotifications.register();

  PushNotifications.addListener("registration", async ({ value: token }) => {
    await fetch("/api/fcm-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token, userId }),
    });
  });

  PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
    window.location.href = notification.data?.url || "/notifications";
  });
}
```

In Xcode also enable the **Push Notifications** and **Background Modes → Remote
notifications** capabilities.

---

## 7. Submit to Google Play (easier — do this first)

1. `npx cap open android` → Android Studio.
2. Set `versionCode` / `versionName` in `android/app/build.gradle`.
3. **Build → Generate Signed Bundle / APK → Android App Bundle (.aab)**.
   Create an upload keystore when prompted and **back it up safely** — losing it
   means you can't update the app.
4. In [Play Console](https://play.google.com/console): create the app, upload
   the `.aab` to **Internal testing** first.
5. Complete: store listing, screenshots, **privacy policy URL**, content
   rating, and the **Data safety** form (declare that you collect account info,
   and that you use Firebase).
6. Promote Internal testing → Production when happy.

Google is lenient about web-backed apps; this usually passes quickly.

---

## 8. Submit to the App Store (stricter — plan for a review round)

1. `npx cap open ios` → Xcode.
2. Select the **App** target → **Signing & Capabilities** → choose your Team
   (enables automatic signing). Set the bundle id to match `com.dewofhermon.app`.
3. Set **Version** and **Build** numbers.
4. In [App Store Connect](https://appstoreconnect.apple.com) create the app
   record (same bundle id).
5. In Xcode: **Product → Archive** → when done, **Distribute App → App Store
   Connect → Upload**.
6. Back in App Store Connect: attach the build, add screenshots (you need a few
   device sizes), description, keywords, **privacy policy URL**, and fill the
   **App Privacy** questionnaire (account info, usage data via Firebase).
7. Submit for review.

### Avoiding the classic rejection (Guideline 4.2 "minimum functionality")
Apple rejects apps that feel like "just a website in a wrapper." You're well
positioned because this is a genuine organizational tool, but reinforce it:
- Ship the **native splash screen and proper app icon** (already set up).
- Add **native push notifications** (high-value signal — see §6).
- Make sure nothing in the app links out to a mobile browser for core tasks.
- In the review notes, provide a **demo login** and one line describing that
  this is the internal ministry-management app for your organization.

---

## 9. The update workflow (after launch)

| You changed… | What to do |
|--------------|-----------|
| Pages, components, API, styling, content | Deploy to Vercel. Done — live in the apps. |
| App icon / splash | Replace `resources/*`, `npx capacitor-assets generate`, `npx cap sync`, rebuild, resubmit. |
| A Capacitor plugin / native config / bundle id | `npx cap sync`, rebuild, resubmit. |

Most of your day-to-day edits fall in the first row — no store round-trip.

---

## 10. Quick command reference

```bash
npx cap sync            # copy web config + plugins into native projects
npx cap open ios        # open Xcode
npx cap open android    # open Android Studio
npx cap run ios         # build + run on simulator/device
npx cap run android
npx capacitor-assets generate   # regenerate icons + splash from resources/
```

---

## 11. Costs & timeline at a glance

- Apple Developer: **$99/yr** · Google Play: **$25 once**.
- Google Play review: usually hours to ~2 days.
- App Store review: usually 1–3 days; budget for one rejection round.
- A custom domain later? Update `server.url` and `allowNavigation` in
  `capacitor.config.ts`, then resubmit.
