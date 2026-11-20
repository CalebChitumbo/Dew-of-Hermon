import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase-admin";

/** How long a server session lasts before it must be renewed. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

/** The httpOnly cookie holding the Firebase session. */
export const SESSION_COOKIE = "session";

/**
 * A companion cookie the browser *can* read, holding the session's expiry
 * time (ms since epoch). It carries no secret — it only lets the client see
 * when the httpOnly session is about to run out so it can renew it. Both
 * cookies are set and cleared together, so they expire at the same moment.
 */
export const SESSION_EXPIRY_COOKIE = "session_exp";

/**
 * Exchange a Firebase ID token for a session cookie and set it, along with
 * the readable expiry cookie.
 */
export async function setSessionCookies(idToken: string): Promise<void> {
  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
  });
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const secure = process.env.NODE_ENV === "production";

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  cookieStore.set(SESSION_EXPIRY_COOKIE, String(expiresAt), {
    httpOnly: false,
    secure,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
}

/** Remove both session cookies (sign-out). */
export async function clearSessionCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(SESSION_EXPIRY_COOKIE);
}
