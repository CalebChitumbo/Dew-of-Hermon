import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

function getApp(): FirebaseApp {
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

let _auth: Auth;
let _db: Firestore;

export const auth: Auth = new Proxy({} as Auth, {
  get(_, prop) {
    if (!_auth) _auth = getAuth(getApp());
    return (_auth as unknown as Record<string, unknown>)[prop as string];
  },
});

export const db: Firestore = new Proxy({} as Firestore, {
  get(_, prop) {
    if (!_db) _db = getFirestore(getApp());
    return (_db as unknown as Record<string, unknown>)[prop as string];
  },
});

export default getApp;
