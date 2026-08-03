import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { serverCheckFeatureAccess } from "@/lib/feature-permissions-server";
import { getCallerUid } from "@/lib/server-auth";
import type { UserRole } from "@/types";

interface AuthedCaller {
  uid: string;
  role: UserRole;
  departmentIds: string[];
  leadsDepartmentIds: string[];
}

export async function getCaller(
  // Kept in the signature so every call site stays unchanged; the credential
  // is now read from the ambient request context by getCallerUid().
  _request?: NextRequest
): Promise<AuthedCaller | null> {
  const uid = await getCallerUid();
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

/**
 * Returns true if the caller can view and update fundraising orders.
 * SUPER_ADMIN/ADMIN pass via the min role; any member or lead of the
 * Fundraising department also passes via the department rule.
 */
export async function canManageFundraisingOrders(
  caller: AuthedCaller
): Promise<boolean> {
  return serverCheckFeatureAccess(
    "manage_fundraising_orders",
    caller.role,
    caller.departmentIds,
    caller.leadsDepartmentIds
  );
}

export type { AuthedCaller };
