import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  collection as firestoreCollection,
  doc as firestoreDoc,
  writeBatch as firestoreWriteBatch,
  type Firestore,
  type CollectionReference,
  type DocumentReference,
  type DocumentData,
  type WriteBatch,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

/**
 * Safe wrappers that guarantee collection()/doc() and getFirestore() come from
 * the same firebase/firestore module instance, avoiding the instanceof check
 * failure caused by Next.js chunk-splitting the Firebase SDK.
 */
export function safeCollection(
  path: string,
  ...pathSegments: string[]
): CollectionReference<DocumentData> {
  return firestoreCollection(db, path, ...pathSegments);
}

export function safeDoc(
  path: string,
  ...pathSegments: string[]
): DocumentReference<DocumentData> {
  return firestoreDoc(db, path, ...pathSegments);
}

export function safeWriteBatch(): WriteBatch {
  return firestoreWriteBatch(db);
}

export default app;
