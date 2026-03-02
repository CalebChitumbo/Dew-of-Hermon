import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let _adminApp: App | null = null;
let _adminAuth: Auth | null = null;
let _adminDb: Firestore | null = null;

function getAdminApp(): App {
  if (!_adminApp) {
    _adminApp =
      getApps().length === 0
        ? initializeApp({
            credential: cert({
              projectId: process.env.FIREBASE_ADMIN_PROJECT_ID?.trim(),
              clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim(),
              privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.trim().replace(
                /\\n/g,
                "\n"
              ),
            }),
          })
        : getApps()[0];
  }
  return _adminApp;
}

export const adminAuth: Auth = new Proxy({} as Auth, {
  get(_, prop) {
    if (!_adminAuth) _adminAuth = getAuth(getAdminApp());
    return (_adminAuth as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_, prop) {
    if (!_adminDb) _adminDb = getFirestore(getAdminApp());
    return (_adminDb as unknown as Record<string | symbol, unknown>)[prop];
  },
});
