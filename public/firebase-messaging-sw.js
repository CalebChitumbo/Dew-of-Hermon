/* eslint-disable no-undef */
// Firebase Cloud Messaging Service Worker
// This runs in the background to handle push notifications when the app is not in the foreground.

importScripts(
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js"
);

// Firebase config is passed on the SW registration URL (query string) so the
// worker can self-initialise the moment it starts — including when the browser
// wakes it in the background to deliver a push, when no page is around to
// postMessage it. A postMessage handler is kept as a fallback.
let firebaseConfig = null;

function configFromLocation() {
  try {
    const params = new URLSearchParams(self.location.search);
    if (!params.get("projectId")) return null;
    return {
      apiKey: params.get("apiKey") || undefined,
      authDomain: params.get("authDomain") || undefined,
      projectId: params.get("projectId") || undefined,
      storageBucket: params.get("storageBucket") || undefined,
      messagingSenderId: params.get("messagingSenderId") || undefined,
      appId: params.get("appId") || undefined,
    };
  } catch (e) {
    return null;
  }
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "FIREBASE_CONFIG") {
    firebaseConfig = event.data.config;
    initFirebase(firebaseConfig);
  }
});

// Self-initialise from the registration URL as soon as the worker loads.
firebaseConfig = configFromLocation();
if (firebaseConfig) {
  initFirebase(firebaseConfig);
}

function initFirebase(config) {
  if (!firebase.apps.length) {
    firebase.initializeApp(config);
  }

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const { title, body, icon, link } = payload.notification || {};
    const data = payload.data || {};

    const notificationTitle = title || "Dew of Hermon";
    const notificationOptions = {
      body: body || "You have a new notification",
      icon: icon || "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.notificationId || "default",
      data: {
        url: data.link || "/notifications",
      },
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Handle notification click — open the app at the relevant URL
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Focus an existing tab if one is open
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Otherwise open a new tab
        return clients.openWindow(url);
      })
  );
});
