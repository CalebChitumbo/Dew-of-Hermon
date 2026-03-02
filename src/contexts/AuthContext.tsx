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
} from "firebase/auth";
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import { User } from "@/types";

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  userData: null,
  loading: true,
  error: null,
  signIn: async () => {},
  signUp: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      setError("Firebase is not configured. Please check environment variables.");
      return;
    }

    try {
      const unsubAuth = onAuthStateChanged(
        auth,
        (user) => {
          setFirebaseUser(user);
          setError(null);
          if (!user) {
            setUserData(null);
            setLoading(false);
          }
        },
        (err) => {
          console.error("Auth state error:", err);
          setError(err.message);
          setLoading(false);
        }
      );
      return unsubAuth;
    } catch (err) {
      console.error("Failed to initialize auth listener:", err);
      setError(err instanceof Error ? err.message : "Failed to connect to authentication service");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!firebaseUser || !isFirebaseConfigured) return;

    try {
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
        },
        (err) => {
          console.error("User data listener error:", err);
          setLoading(false);
        }
      );
      return unsubUser;
    } catch (err) {
      console.error("Failed to initialize user listener:", err);
      setLoading(false);
    }
  }, [firebaseUser]);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string, name: string) => {
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
  };

  const signInWithGoogle = async () => {
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
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUserData(null);
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userData,
        loading,
        error,
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
