/**
 * Server-side feature permission helpers.
 *
 * These read the featurePermissions config from Firestore and use it to
 * check department-specific access. When a feature has no configured
 * linkedDepts, they fall back to the legacy behaviour of looking up
 * the relevant department by name.
 */

import { adminDb } from "@/lib/firebase-admin";
import { FeaturePermissions, UserRole } from "@/types";
import { hasMinRole } from "@/lib/permissions";

/** Load feature permissions from Firestore (returns null if not yet configured). */
export async function loadFeaturePermissions(): Promise<FeaturePermissions | null> {
  try {
    const doc = await adminDb.collection("settings").doc("accessControl").get();
    if (!doc.exists) return null;
    return (doc.data()?.featurePermissions as FeaturePermissions) ?? null;
  } catch {
    return null;
  }
}

async function getDeptIdByName(name: string): Promise<string | null> {
  const snap = await adminDb
    .collection("departments")
    .where("name", "==", name)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

/**
 * Can the caller approve events?
 * Config: approve_events — linked dept leads get access.
 * Fallback: DEPARTMENT_LEAD of "Events & Fellowship".
 */
export async function serverCanApproveEvents(
  role: UserRole,
  leadsDepartmentIds: string[],
  featurePerms?: FeaturePermissions | null
): Promise<boolean> {
  if (hasMinRole(role, "ADMIN")) return true;

  const config = featurePerms?.approve_events;
  if (config && config.linkedDepts.length > 0) {
    const deptMinRole = config.deptMinRole ?? "DEPARTMENT_LEAD";
    if (!hasMinRole(role, deptMinRole)) return false;
    return config.linkedDepts.some(
      ({ deptId, access }) =>
        access === "lead" && leadsDepartmentIds.includes(deptId)
    );
  }

  // Legacy fallback
  if (role !== "DEPARTMENT_LEAD") return false;
  const deptId = await getDeptIdByName("Events & Fellowship");
  return deptId ? leadsDepartmentIds.includes(deptId) : false;
}

/**
 * Can the caller submit follow-up cards?
 * Config: submit_follow_up — linked dept members get access.
 * Fallback: members of "Campus Ministry" or "Life Groups".
 */
export async function serverCanSubmitFollowUp(
  role: UserRole,
  departmentIds: string[],
  featurePerms?: FeaturePermissions | null
): Promise<boolean> {
  if (hasMinRole(role, "ADMIN")) return true;

  const config = featurePerms?.submit_follow_up;
  if (config && config.linkedDepts.length > 0) {
    const deptMinRole = config.deptMinRole ?? "MEMBER";
    if (!hasMinRole(role, deptMinRole)) return false;
    return config.linkedDepts.some(
      ({ deptId, access }) =>
        access === "member" && departmentIds.includes(deptId)
    );
  }

  // Legacy fallback
  const [campusId, lifeId] = await Promise.all([
    getDeptIdByName("Campus Ministry"),
    getDeptIdByName("Life Groups"),
  ]);
  return (
    (campusId ? departmentIds.includes(campusId) : false) ||
    (lifeId ? departmentIds.includes(lifeId) : false)
  );
}

/**
 * Can the caller manage (read/update) follow-up cards?
 * Config: manage_follow_ups — linked dept leads get access.
 * Fallback: leads of "Discipleship & Follow-Up".
 */
export async function serverCanManageFollowUps(
  role: UserRole,
  leadsDepartmentIds: string[],
  departmentIds: string[],
  featurePerms?: FeaturePermissions | null
): Promise<boolean> {
  if (hasMinRole(role, "ADMIN")) return true;

  const config = featurePerms?.manage_follow_ups;
  if (config && config.linkedDepts.length > 0) {
    const deptMinRole = config.deptMinRole ?? "DEPARTMENT_LEAD";
    if (!hasMinRole(role, deptMinRole)) return false;
    return config.linkedDepts.some(({ deptId, access }) => {
      if (access === "lead") return leadsDepartmentIds.includes(deptId);
      return departmentIds.includes(deptId);
    });
  }

  // Legacy fallback
  const deptId = await getDeptIdByName("Discipleship & Follow-Up");
  return deptId ? leadsDepartmentIds.includes(deptId) : false;
}

/**
 * Can the caller read follow-up cards at all?
 * This is a broader read gate (Campus Ministry, Life Groups, or Discipleship members).
 * Config: combines submit_follow_up and manage_follow_ups linked depts.
 * Fallback: members of the three legacy departments.
 */
export async function serverCanReadFollowUps(
  role: UserRole,
  departmentIds: string[],
  leadsDepartmentIds: string[],
  featurePerms?: FeaturePermissions | null
): Promise<boolean> {
  if (hasMinRole(role, "ADMIN")) return true;

  const submitConfig = featurePerms?.submit_follow_up;
  const manageConfig = featurePerms?.manage_follow_ups;

  const hasConfiguredDepts =
    (submitConfig?.linkedDepts.length ?? 0) > 0 ||
    (manageConfig?.linkedDepts.length ?? 0) > 0;

  if (hasConfiguredDepts) {
    // User can read if they can submit OR manage
    const canSubmit = await serverCanSubmitFollowUp(role, departmentIds, featurePerms);
    const canManage = await serverCanManageFollowUps(
      role,
      leadsDepartmentIds,
      departmentIds,
      featurePerms
    );
    return canSubmit || canManage;
  }

  // Legacy fallback: members of Campus Ministry, Life Groups, or Discipleship
  const [campusId, lifeId, discipleshipId] = await Promise.all([
    getDeptIdByName("Campus Ministry"),
    getDeptIdByName("Life Groups"),
    getDeptIdByName("Discipleship & Follow-Up"),
  ]);
  return (
    (campusId ? departmentIds.includes(campusId) : false) ||
    (lifeId ? departmentIds.includes(lifeId) : false) ||
    (discipleshipId ? departmentIds.includes(discipleshipId) : false)
  );
}

/**
 * Can the caller submit life group leads?
 * Config: submit_life_group_lead — linked dept members with deptMinRole get access.
 * Fallback: DEPARTMENT_LEAD or YOUTH_LEADER in "Life Groups".
 */
export async function serverCanSubmitLifeGroupLead(
  role: UserRole,
  departmentIds: string[],
  featurePerms?: FeaturePermissions | null
): Promise<boolean> {
  if (hasMinRole(role, "ADMIN")) return true;

  const config = featurePerms?.submit_life_group_lead;
  if (config && config.linkedDepts.length > 0) {
    const deptMinRole = config.deptMinRole ?? "YOUTH_LEADER";
    if (!hasMinRole(role, deptMinRole)) return false;
    return config.linkedDepts.some(
      ({ deptId, access }) =>
        access === "member" && departmentIds.includes(deptId)
    );
  }

  // Legacy fallback
  if (role !== "DEPARTMENT_LEAD" && role !== "YOUTH_LEADER") return false;
  const deptId = await getDeptIdByName("Life Groups");
  return deptId ? departmentIds.includes(deptId) : false;
}
