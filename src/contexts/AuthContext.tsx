"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  onAuthStateChanged,
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";
import { onSnapshot } from "firebase/firestore";
import { auth, safeDoc } from "@/lib/firebase";
import { User } from "@/types";

/**
 * State of the server session cookie for the signed-in Firebase user.
 * - "unknown": not checked/renewed yet
 * - "valid":   a session cookie is in place
 * - "none":    no usable session (renewal failed or not signed in)
 */
export type SessionStatus = "unknown" | "valid" | "none";

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
  sessionStatus: SessionStatus;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, extra?: { lifeGroup?: string; isStudent?: boolean; institutionId?: string }) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  userData: null,
  loading: true,
  sessionStatus: "unknown",
  signIn: async () => {},
  signUp: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

/** Renew the session when it has less than this long left. */
const RENEW_BEFORE_EXPIRY_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

/**
 * Read the session expiry (ms since epoch) from the readable companion cookie
 * set alongside the httpOnly session cookie. null if absent.
 */
function readSessionExpiry(): number | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)session_exp=(\d+)/);
  return match ? Number(match[1]) : null;
}

function sessionNeedsRenewal(): boolean {
  const expiresAt = readSessionExpiry();
  return !expiresAt || expiresAt - Date.now() < RENEW_BEFORE_EXPIRY_MS;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("unknown");
  // True while signIn/signUp/signInWithGoogle is running — that flow creates
  // the session itself (and the profile, for new users), so the automatic
  // renewal must stay out of its way.
  const signingInRef = useRef(false);
  const renewalRef = useRef<Promise<void> | null>(null);

  /**
   * Make sure the signed-in user has a server session cookie that isn't about
   * to expire, renewing it from a fresh Firebase ID token if needed. Firebase
   * keeps users signed in indefinitely (especially in the installed app), but
   * the session cookie only lasts 7 days — without this, API calls start
   * failing with 401 while the user still looks logged in.
   */
  const ensureSession = useCallback(async (user: FirebaseUser) => {
    if (signingInRef.current) return;
    if (!sessionNeedsRenewal()) {
      setSessionStatus("valid");
      return;
    }
    // De-duplicate concurrent calls (auth change + tab focus at once).
    if (renewalRef.current) return renewalRef.current;

    renewalRef.current = (async () => {
      try {
        const renew = async (forceRefresh: boolean) =>
          fetch("/api/auth/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken: await user.getIdToken(forceRefresh) }),
          });
        let res = await renew(false);
        // A rejected token may just be stale — retry once with a fresh one
        // before concluding the sign-in itself is no longer valid.
        if (res.status === 401) res = await renew(true);
        if (res.ok) {
          setSessionStatus("valid");
        } else if (res.status === 403) {
          // Account deactivated — don't leave them half signed in.
          setSessionStatus("none");
          await firebaseSignOut(auth);
        } else if (res.status === 401) {
          // ID token rejected (e.g. revoked) — the Firebase sign-in is stale.
          setSessionStatus("none");
          await firebaseSignOut(auth);
        } else {
          // 404 (profile not created yet), 5xx or similar. If an older cookie
          // still exists it keeps working until it expires.
          setSessionStatus(readSessionExpiry() ? "valid" : "none");
        }
      } catch (e) {
        console.error("Session renewal failed:", e);
        setSessionStatus(readSessionExpiry() ? "valid" : "none");
      } finally {
        renewalRef.current = null;
      }
    })();
    return renewalRef.current;
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) {
        setUserData(null);
        setSessionStatus("none");
        setLoading(false);
      } else {
        void ensureSession(user);
      }
    });
    return unsubAuth;
  }, [ensureSession]);

  // An installed app can stay open in the background for days; re-check when
  // it comes back to the foreground.
  useEffect(() => {
    if (!firebaseUser) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void ensureSession(firebaseUser);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [firebaseUser, ensureSession]);

  useEffect(() => {
    if (!firebaseUser) return;

    const unsubUser = onSnapshot(
      safeDoc("users", firebaseUser.uid),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setUserData({
            id: snapshot.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
          } as User);
        } else {
          setUserData(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error listening to user document:", error);
        setUserData(null);
        setLoading(false);
      }
    );
    return unsubUser;
  }, [firebaseUser]);

  const createSession = async (
    user: FirebaseUser,
    isGoogleSignIn = false,
    registrationName?: string,
    extra?: { lifeGroup?: string; isStudent?: boolean; institutionId?: string }
  ) => {
    const idToken = await user.getIdToken();
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idToken,
        isGoogleSignIn,
        registrationName,
        ...extra,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Login failed");
    }
    setSessionStatus("valid");
  };

  /** Run a sign-in flow without the automatic session renewal interfering. */
  const withSigningIn = async <T,>(fn: () => Promise<T>): Promise<T> => {
    signingInRef.current = true;
    try {
      return await fn();
    } catch (error) {
      setSessionStatus("none");
      throw error;
    } finally {
      signingInRef.current = false;
    }
  };

  const signIn = async (email: string, password: string) => {
    await withSigningIn(async () => {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await createSession(cred.user);
    });
  };

  const signUp = async (
    email: string,
    password: string,
    name: string,
    extra?: { lifeGroup?: string; isStudent?: boolean; institutionId?: string }
  ) => {
    await withSigningIn(async () => {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      try {
        await updateProfile(cred.user, { displayName: name });
        // User doc is created server-side in /api/auth/login to avoid
        // client-side Firestore permission issues
        await createSession(cred.user, false, name, extra);
      } catch (error) {
        // If anything fails after auth user creation, delete the auth user
        // so the user can retry registration without "email already in use"
        await cred.user.delete();
        throw error;
      }
    });
  };

  const signInWithGoogle = async () => {
    await withSigningIn(async () => {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      await createSession(cred.user, true);
    });
  };

  const signOut = async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    await firebaseSignOut(auth);
    setUserData(null);
    setSessionStatus("none");
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userData,
        // Hold "loading" until the session is renewed (rare — about once every
        // 5 days) so pages don't fire API calls that would 401 meanwhile.
        loading: loading || (!!firebaseUser && sessionStatus === "unknown"),
        sessionStatus,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
