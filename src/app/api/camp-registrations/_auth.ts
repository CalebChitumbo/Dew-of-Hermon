import { adminDb } from "@/lib/firebase-admin";
import { serverCheckFeatureAccess } from "@/lib/feature-permissions-server";
import { getCallerToken } from "@/lib/server-auth";
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
    const token = await getCallerToken();
    if (!token) return null;

    const userDoc = await adminDb.collection("users").doc(token.uid).get();
    if (!userDoc.exists) return null;

    const data = userDoc.data()!;
    return {
      uid: token.uid,
      name: data.name || token.email || "Admin",
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

/**
 * True for anyone who may see the camp's registration status — every
 * DEPARTMENT_LEAD by default, plus everyone who can manage the registrations.
 * This is the read-only tier: the status endpoint it guards returns totals and
 * camper names only, never medical notes or contact details.
 */
export async function callerCanViewCampStatus(
  caller: CallerInfo
): Promise<boolean> {
  const [canView, canManage] = await Promise.all([
    serverCheckFeatureAccess(
      "view_camp_registrations",
      caller.role,
      caller.departmentIds,
      caller.leadsDepartmentIds
    ),
    callerCanManageCampRegistrations(caller),
  ]);
  return canView || canManage;
}
