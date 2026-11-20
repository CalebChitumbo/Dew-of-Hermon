"use client";

import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type Messaging,
} from "firebase/messaging";
import type { User as FirebaseUser } from "firebase/auth";
import app from "@/lib/firebase";

let messagingInstance: Messaging | null = null;

/**
 * Get the FCM messaging instance. Only works in the browser.
 * Returns null during SSR or if the browser doesn't support notifications.
 */
function getMessagingInstance(): Messaging | null {
  if (typeof window === "undefined") return null;
  if (!("Notification" in window)) return null;
  if (!messagingInstance) {
    try {
      messagingInstance = getMessaging(app);
    } catch {
      // Firebase Messaging is not supported on this browser (e.g. older iOS
      // Safari, restricted WebView, or missing Push API / IndexedDB support).
      return null;
    }
  }
  return messagingInstance;
}

/**
 * Register the Firebase messaging service worker and pass it the Firebase config
 * so it can initialise itself in the background.
 */
async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;

  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  // Pass the config on the registration URL so the worker can self-initialise
  // the instant it starts — including when the browser wakes it in the
  // background with no page around to postMessage it.
  const params = new URLSearchParams();
  Object.entries(config).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  const swUrl = `/firebase-messaging-sw.js?${params.toString()}`;

  await navigator.serviceWorker.register(swUrl);

  // Wait until a worker is actually active and controlling before we hand the
  // registration to getToken(). register() resolves while the worker is still
  // "installing"; using it too early is what made the first "Enable" click fail.
  const readyRegistration = await navigator.serviceWorker.ready;

  // Belt-and-braces: also postMessage the config to the active worker.
  readyRegistration.active?.postMessage({ type: "FIREBASE_CONFIG", config });

  return readyRegistration;
}

export type PushPermissionFailureReason =
  | "denied"
  | "dismissed"
  | "unsupported"
  | "ios_not_installed"
  | "sw_failed"
  | "config_missing"
  | "token_failed"
  | "save_failed"
  | "session_expired";

export type PushPermissionResult =
  | { ok: true; token: string }
  | { ok: false; reason: PushPermissionFailureReason };

/** iPhone / iPad (including iPadOS, which reports itself as a Mac). */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Running as an installed (Home Screen) web app rather than in a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Where this device's last successfully saved token is remembered. */
const SAVED_TOKEN_KEY = "fcm-token-saved";

function rememberSavedToken(userId: string, token: string) {
  try {
    localStorage.setItem(SAVED_TOKEN_KEY, `${userId}:${token}`);
  } catch {
    // Storage unavailable (private mode etc.) — not critical.
  }
}

/**
 * Get an FCM token for this device and save it on the server. Assumes
 * notification permission has already been granted.
 */
async function registerDeviceToken(user: FirebaseUser): Promise<PushPermissionResult> {
  // getMessaging() doesn't check browser support itself; isSupported() does
  // (Push API, IndexedDB, service workers, secure context).
  let supported = false;
  try {
    supported = await isSupported();
  } catch {
    supported = false;
  }
  if (!supported) {
    return { ok: false, reason: isIOS() && !isStandalone() ? "ios_not_installed" : "unsupported" };
  }

  const messaging = getMessagingInstance();
  if (!messaging) return { ok: false, reason: "unsupported" };

  // Env vars pasted into a hosting dashboard often pick up stray quotes or
  // whitespace, which makes the key fail to decode and getToken() throw.
  const vapidKey = (process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "")
    .trim()
    .replace(/^["']|["']$/g, "");
  if (!vapidKey) {
    console.error("NEXT_PUBLIC_FIREBASE_VAPID_KEY is not set");
    return { ok: false, reason: "config_missing" };
  }

  let swRegistration: ServiceWorkerRegistration | null;
  try {
    swRegistration = await registerServiceWorker();
  } catch (e) {
    console.error("Service worker registration failed:", e);
    return { ok: false, reason: "sw_failed" };
  }
  if (!swRegistration) return { ok: false, reason: "sw_failed" };

  let token: string;
  try {
    token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swRegistration,
    });
  } catch (e) {
    console.error("FCM getToken failed:", e);
    const code = (e as { code?: string })?.code || "";
    if (code === "messaging/permission-blocked") return { ok: false, reason: "denied" };
    if (code === "messaging/unsupported-browser") return { ok: false, reason: "unsupported" };
    return { ok: false, reason: "token_failed" };
  }
  if (!token) return { ok: false, reason: "token_failed" };

  // Authenticate with a fresh Firebase ID token rather than relying only on
  // the 7-day session cookie: an installed web app keeps the user signed in
  // to Firebase long after that cookie has expired, which made the save fail
  // with 401 even though the user appeared to be logged in.
  let idToken: string | null = null;
  try {
    idToken = await user.getIdToken();
  } catch (e) {
    console.error("Could not get Firebase ID token:", e);
  }

  try {
    const res = await fetch("/api/fcm-tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({ token, userId: user.uid }),
    });
    if (res.status === 401 || res.status === 403) {
      console.error("Saving FCM token was rejected:", res.status);
      return { ok: false, reason: "session_expired" };
    }
    if (!res.ok) {
      console.error("Saving FCM token failed:", res.status);
      return { ok: false, reason: "save_failed" };
    }
  } catch (e) {
    console.error("Saving FCM token failed:", e);
    return { ok: false, reason: "save_failed" };
  }

  rememberSavedToken(user.uid, token);
  return { ok: true, token };
}

/**
 * Request notification permission, get the FCM token, and save it to the server.
 * Must be called directly from a user tap/click — iOS only shows the
 * permission prompt in response to a user gesture.
 * Returns a discriminated result so callers can show an accurate message for
 * each failure mode instead of a generic "blocked" error.
 */
export async function requestPushPermissionAndToken(
  user: FirebaseUser
): Promise<PushPermissionResult> {
  if (typeof window === "undefined") return { ok: false, reason: "unsupported" };
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return { ok: false, reason: isIOS() && !isStandalone() ? "ios_not_installed" : "unsupported" };
  }

  // If the user previously blocked notifications, requestPermission() will
  // resolve immediately with "denied" — surface that without a prompt round-trip.
  if (Notification.permission === "denied") {
    return { ok: false, reason: "denied" };
  }

  // Keep requestPermission() as the very first await so it still counts as
  // part of the user's tap on iOS.
  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission === "denied") return { ok: false, reason: "denied" };
    // "default" means the user closed the prompt without choosing — not blocked,
    // just not granted yet. They can try again.
    if (permission !== "granted") return { ok: false, reason: "dismissed" };
  }

  return registerDeviceToken(user);
}

/**
 * When permission is already granted, quietly (re-)register this device's
 * token. FCM tokens rotate, and an earlier attempt may have failed after the
 * permission prompt — this makes sure the server always has a working token.
 * Returns null when there's nothing to do (permission not granted).
 */
export async function syncPushTokenIfGranted(
  user: FirebaseUser
): Promise<PushPermissionResult | null> {
  if (typeof window === "undefined") return null;
  if (!("Notification" in window) || Notification.permission !== "granted") return null;
  return registerDeviceToken(user);
}

/** Whether this device has successfully saved a push token for the user. */
export function hasSavedPushToken(userId: string): boolean {
  try {
    return localStorage.getItem(SAVED_TOKEN_KEY)?.startsWith(`${userId}:`) ?? false;
  } catch {
    return false;
  }
}

/**
 * Remove the current device's FCM token from the server (e.g. on sign-out or opt-out).
 */
export async function removePushToken(userId: string, token: string): Promise<void> {
  await fetch("/api/fcm-tokens", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, userId }),
  });
}

/**
 * Listen for foreground FCM messages. Returns an unsubscribe function.
 * When a message arrives while the app is in the foreground we dispatch a
 * custom event so the UI can show an in-app toast.
 */
export function onForegroundMessage(
  callback: (payload: { title: string; body: string; link?: string }) => void
): (() => void) | null {
  const messaging = getMessagingInstance();
  if (!messaging) return null;

  return onMessage(messaging, (payload) => {
    const { title, body } = payload.notification || {};
    const link = payload.data?.link;
    if (title) {
      callback({ title, body: body || "", link });
    }
  });
}
