import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function createLazy<T extends object>(factory: () => T): T {
  let instance: T | undefined;
  return new Proxy({} as T, {
    get(_, prop, receiver) {
      if (!instance) instance = factory();
      return Reflect.get(instance, prop, receiver);
    },
    has(_, prop) {
      if (!instance) instance = factory();
      return Reflect.has(instance, prop);
    },
    getPrototypeOf() {
      if (!instance) instance = factory();
      return Reflect.getPrototypeOf(instance);
    },
    ownKeys() {
      if (!instance) instance = factory();
      return Reflect.ownKeys(instance);
    },
    getOwnPropertyDescriptor(_, prop) {
      if (!instance) instance = factory();
      return Reflect.getOwnPropertyDescriptor(instance, prop);
    },
  });
}

let _app: FirebaseApp | undefined;

function getApp(): FirebaseApp {
  if (!_app) {
    _app =
      getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return _app;
}

export const auth: Auth = createLazy(() => getAuth(getApp()));
export const db: Firestore = createLazy(() => getFirestore(getApp()));
export default getApp;
