"use client";

import { getMessaging, getToken, onMessage, type Messaging } from "firebase/messaging";
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

  const registration = await navigator.serviceWorker.register(
    "/firebase-messaging-sw.js"
  );

  // Send the Firebase config to the SW so it can initialise
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  // Wait for the SW to be ready before posting the config
  if (registration.active) {
    registration.active.postMessage({ type: "FIREBASE_CONFIG", config });
  } else {
    navigator.serviceWorker.ready.then((reg) => {
      reg.active?.postMessage({ type: "FIREBASE_CONFIG", config });
    });
  }

  return registration;
}

export type PushPermissionFailureReason =
  | "denied"
  | "dismissed"
  | "unsupported"
  | "sw_failed"
  | "config_missing"
  | "token_failed";

export type PushPermissionResult =
  | { ok: true; token: string }
  | { ok: false; reason: PushPermissionFailureReason };

/**
 * Request notification permission, get the FCM token, and save it to the server.
 * Returns a discriminated result so callers can show an accurate message for
 * each failure mode instead of a generic "blocked" error.
 */
export async function requestPushPermissionAndToken(
  userId: string
): Promise<PushPermissionResult> {
  if (typeof window === "undefined") return { ok: false, reason: "unsupported" };
  if (!("Notification" in window)) return { ok: false, reason: "unsupported" };
  if (!("serviceWorker" in navigator)) return { ok: false, reason: "unsupported" };

  // If the user previously blocked notifications, requestPermission() will
  // resolve immediately with "denied" — surface that without a prompt round-trip.
  if (Notification.permission === "denied") {
    return { ok: false, reason: "denied" };
  }

  const permission = await Notification.requestPermission();
  if (permission === "denied") return { ok: false, reason: "denied" };
  // "default" means the user closed the prompt without choosing — not blocked,
  // just not granted yet. They can try again.
  if (permission !== "granted") return { ok: false, reason: "dismissed" };

  const messaging = getMessagingInstance();
  if (!messaging) return { ok: false, reason: "unsupported" };

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
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
    return { ok: false, reason: "token_failed" };
  }
  if (!token) return { ok: false, reason: "token_failed" };

  await fetch("/api/fcm-tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, userId }),
  });

  return { ok: true, token };
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
