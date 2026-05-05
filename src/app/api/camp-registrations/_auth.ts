import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { serverCheckFeatureAccess } from "@/lib/feature-permissions-server";
import type { UserRole } from "@/types";

export interface CallerInfo {
  uid: string;
  name: string;
  role: UserRole;
  departmentIds: string[];
  leadsDepartmentIds: string[];
}

export async function getCallerWithDepartments(): Promise<CallerInfo | null> {
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
      name: data.name || decoded.email || "Admin",
      role: data.role as UserRole,
      departmentIds: (data.departmentIds as string[] | undefined) ?? [],
      leadsDepartmentIds:
        (data.leadsDepartmentIds as string[] | undefined) ?? [],
    };
  } catch {
    return null;
  }
}

/**
 * True for SUPER_ADMIN, ADMIN, and any DEPARTMENT_LEAD who leads the
 * "ROPs Camp" department (per the manage_camp_registrations feature rule).
 */
export async function callerCanManageCampRegistrations(
  caller: CallerInfo
): Promise<boolean> {
  return serverCheckFeatureAccess(
    "manage_camp_registrations",
    caller.role,
    caller.departmentIds,
    caller.leadsDepartmentIds
  );
}
