import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for the Dew of Hermon native wrappers (iOS + Android).
 *
 * The web app is a server-rendered Next.js app deployed on Vercel, so it cannot
 * be bundled as static files. Instead the native shells load the LIVE site via
 * `server.url`. This means most web changes ship instantly to the installed apps
 * without a new store submission — only native-level changes (icons, splash,
 * plugins, native code) require a rebuild and re-submit.
 *
 * IMPORTANT:
 *  - `appId` is your permanent bundle identifier on both stores. Changing it
 *    later means creating new store listings, so set it now if you want a
 *    different one (e.g. tied to a domain you own).
 *  - When you move to a custom domain, update `server.url` and `allowNavigation`.
 */
const APP_URL = "https://dew-of-hermon-xy9h.vercel.app";

const config: CapacitorConfig = {
  appId: "com.dewofhermon.app",
  appName: "Dew of Hermon",
  // Local fallback shell shown only if the live site can't be reached.
  webDir: "mobile",
  backgroundColor: "#FFF8F0",
  server: {
    url: APP_URL,
    cleartext: false,
    // Keep auth and Firebase flows inside the app instead of bouncing to a
    // system browser. Add any other domains your sign-in flow touches.
    allowNavigation: [
      "dew-of-hermon-xy9h.vercel.app",
      "potterswheel.firebaseapp.com",
      "*.firebaseapp.com",
      "*.googleapis.com",
      "accounts.google.com",
    ],
  },
  ios: {
    contentInset: "always",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#FFF8F0",
      showSpinner: false,
      androidSpinnerStyle: "small",
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
