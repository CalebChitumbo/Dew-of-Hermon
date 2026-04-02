import { auth } from "@/lib/firebase";

/**
 * Fetch wrapper that auto-refreshes the session cookie on 401 responses.
 * When the session cookie expires but Firebase Auth is still valid,
 * this gets a fresh ID token and creates a new session before retrying.
 */
export async function fetchWithAuth(
  url: string,
  options?: RequestInit
): Promise<Response> {
  let res = await fetch(url, options);

  if (res.status === 401 && auth.currentUser) {
    // Session cookie likely expired — refresh it
    try {
      const idToken = await auth.currentUser.getIdToken(true);
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (loginRes.ok) {
        // Retry the original request with the new session cookie
        res = await fetch(url, options);
      }
    } catch {
      // If refresh fails, return the original 401 response
    }
  }

  return res;
}
