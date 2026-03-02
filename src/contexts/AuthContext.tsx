"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile,
  AuthError,
} from "firebase/auth";
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { User } from "@/types";

function getAuthErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as AuthError).code;
    switch (code) {
      case "auth/email-already-in-use":
        return "An account with this email already exists. Please sign in instead.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/weak-password":
        return "Password is too weak. Please use at least 6 characters.";
      case "auth/user-not-found":
        return "No account found with this email. Please register first.";
      case "auth/wrong-password":
        return "Incorrect password. Please try again.";
      case "auth/invalid-credential":
        return "Invalid email or password. Please try again.";
      case "auth/too-many-requests":
        return "Too many failed attempts. Please try again later.";
      case "auth/popup-closed-by-user":
        return "Sign-in was cancelled. Please try again.";
      case "auth/popup-blocked":
        return "Sign-in popup was blocked. Please allow popups for this site.";
      case "auth/network-request-failed":
        return "Network error. Please check your connection and try again.";
      case "auth/unauthorized-domain":
        return "This domain is not authorized. Please add it to your Firebase authorized domains.";
      default:
        return "An unexpected error occurred. Please try again.";
    }
  }
  return error instanceof Error ? error.message : "An unexpected error occurred. Please try again.";
}

async function createSession(user: FirebaseUser): Promise<void> {
  const idToken = await user.getIdToken();
  await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
}

async function deleteSession(): Promise<void> {
  await fetch("/api/auth/session", { method: "DELETE" });
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  userData: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) {
        setUserData(null);
        setLoading(false);
      }
    });
    return unsubAuth;
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;

    const unsubUser = onSnapshot(
      doc(db, "users", firebaseUser.uid),
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
      }
    );
    return unsubUser;
  }, [firebaseUser]);

  const signIn = async (email: string, password: string) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await createSession(cred.user);
    } catch (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, "users", cred.user.uid), {
        name,
        email,
        phone: null,
        role: "MEMBER",
        departmentIds: [],
        leadsDepartmentIds: [],
        profileImage: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await createSession(cred.user);
    } catch (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const userDoc = await getDoc(doc(db, "users", cred.user.uid));

      if (!userDoc.exists()) {
        await setDoc(doc(db, "users", cred.user.uid), {
          name: cred.user.displayName || "User",
          email: cred.user.email || "",
          phone: null,
          role: "MEMBER",
          departmentIds: [],
          leadsDepartmentIds: [],
          profileImage: cred.user.photoURL || null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      await createSession(cred.user);
    } catch (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const signOut = async () => {
    await deleteSession();
    await firebaseSignOut(auth);
    setUserData(null);
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userData,
        loading,
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
