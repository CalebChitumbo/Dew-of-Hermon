import { cookies, headers } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { UserRole } from "@/types";

export interface SessionCaller {
  uid: string;
  role: UserRole;
  name: string;
  email: string | null;
  departmentIds: string[];
  leadsDepartmentIds: string[];
}

/**
 * The identity claims every caller-resolution helper needs, whichever
 * credential the caller presented.
 */
export interface CallerToken {
  uid: string;
  email: string | null;
  /** Only ever true when Firebase itself has confirmed the address. */
  emailVerified: boolean;
}

/**
 * Resolve the caller's Firebase identity from whichever credential they hold.
 *
 * The web app authenticates with the httpOnly `session` cookie minted at
 * login. The Flutter app has no cookie jar to speak of, so it sends the
 * Firebase ID token as `Authorization: Bearer <token>` instead. Both are
 * verified by the Admin SDK against the same project, so both are equally
 * trustworthy — the cookie is simply tried first, since it is what the vast
 * majority of requests carry.
 */
export async function getCallerToken(): Promise<CallerToken | null> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session");
    if (session?.value) {
      const decoded = await adminAuth.verifySessionCookie(session.value);
      return {
        uid: decoded.uid,
        email: decoded.email ?? null,
        emailVerified: decoded.email_verified === true,
      };
    }
  } catch {
    // A stale or forged cookie must not shadow a valid Bearer token.
  }

  try {
    const headerStore = await headers();
    const authorization = headerStore.get("authorization");
    if (!authorization?.toLowerCase().startsWith("bearer ")) return null;
    const idToken = authorization.slice(7).trim();
    if (!idToken) return null;
    const decoded = await adminAuth.verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      emailVerified: decoded.email_verified === true,
    };
  } catch {
    return null;
  }
}

/** The caller's uid, from a session cookie or a Bearer ID token. */
export async function getCallerUid(): Promise<string | null> {
  return (await getCallerToken())?.uid ?? null;
}

/**
 * Resolve the caller from their credential. Gives us a trustworthy uid,
 * role, and department membership — request bodies cannot be trusted to
 * supply any of these.
 */
export async function getSessionCaller(): Promise<SessionCaller | null> {
  try {
    const token = await getCallerToken();
    if (!token) return null;
    const userDoc = await adminDb.collection("users").doc(token.uid).get();
    if (!userDoc.exists) return null;
    const data = userDoc.data()!;
    return {
      uid: token.uid,
      role: data.role as UserRole,
      name: data.name || "",
      email: data.email || null,
      departmentIds: data.departmentIds || [],
      leadsDepartmentIds: data.leadsDepartmentIds || [],
    };
  } catch {
    return null;
  }
}
