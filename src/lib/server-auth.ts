import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { UserRole } from "@/types";

export interface SessionCaller {
  uid: string;
  role: UserRole;
  departmentIds: string[];
  leadsDepartmentIds: string[];
}

/**
 * Resolve the caller from their session cookie. Gives us a trustworthy uid,
 * role, and department membership — request bodies cannot be trusted to
 * supply any of these.
 */
export async function getSessionCaller(): Promise<SessionCaller | null> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session");
    if (!session?.value) return null;
    const decoded = await adminAuth.verifySessionCookie(session.value);
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) return null;
    const data = userDoc.data()!;
    return {
      uid: decoded.uid,
      role: data.role as UserRole,
      departmentIds: data.departmentIds || [],
      leadsDepartmentIds: data.leadsDepartmentIds || [],
    };
  } catch {
    return null;
  }
}
