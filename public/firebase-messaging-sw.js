/* eslint-disable no-undef */
// Firebase Cloud Messaging Service Worker
// This runs in the background to handle push notifications when the app is not in the foreground.

importScripts(
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js"
);

// Firebase config is injected at runtime via the query string when the SW is registered,
// but we also support a fallback so the SW can self-initialise when woken by the browser.
let firebaseConfig = null;

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "FIREBASE_CONFIG") {
    firebaseConfig = event.data.config;
    initFirebase(firebaseConfig);
  }
});

function initFirebase(config) {
  if (!firebase.apps.length) {
    firebase.initializeApp(config);
  }

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const { title, body, icon, link } = payload.notification || {};
    const data = payload.data || {};

    const notificationTitle = title || "Potter's Wheel";
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
