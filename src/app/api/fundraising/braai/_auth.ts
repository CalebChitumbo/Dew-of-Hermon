import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { serverCheckFeatureAccess } from "@/lib/feature-permissions-server";
import type { UserRole } from "@/types";

interface AuthedCaller {
  uid: string;
  role: UserRole;
  departmentIds: string[];
  leadsDepartmentIds: string[];
}

async function getUidFromRequest(
  request: NextRequest
): Promise<string | null> {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
      return decoded.uid;
    } catch {
      // fall through to session cookie
    }
  }

  const cookieStore = await cookies();
  const session = cookieStore.get("session");
  if (session?.value) {
    try {
      const decoded = await adminAuth.verifySessionCookie(session.value);
      return decoded.uid;
    } catch {
      return null;
    }
  }
  return null;
}

export async function getCaller(
  request: NextRequest
): Promise<AuthedCaller | null> {
  const uid = await getUidFromRequest(request);
  if (!uid) return null;
  const userDoc = await adminDb.collection("users").doc(uid).get();
  if (!userDoc.exists) return null;
  const data = userDoc.data()!;
  return {
    uid,
    role: data.role as UserRole,
    departmentIds: (data.departmentIds as string[]) || [],
    leadsDepartmentIds: (data.leadsDepartmentIds as string[]) || [],
  };
}

/**
 * Returns true if the caller has access to plan/manage the fundraising braai.
 * SUPER_ADMIN/ADMIN pass via the configured min role; DEPARTMENT_LEADs of the
 * Fundraising department also pass via the department rule.
 */
export async function canPlanBraai(caller: AuthedCaller): Promise<boolean> {
  return serverCheckFeatureAccess(
    "plan_fundraising_braai",
    caller.role,
    caller.departmentIds,
    caller.leadsDepartmentIds
  );
}
