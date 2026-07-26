import { adminDb } from "@/lib/firebase-admin";
import {
  DepartmentAccessRule,
  FeatureMinRoles,
  UserRole,
} from "@/types";
import {
  DEFAULT_FEATURE_MIN_ROLES,
  DEFAULT_DEPARTMENT_ACCESS_RULES,
  mergeFeatureMinRoles,
  mergeDepartmentAccessRules,
  checkFeatureAccess,
} from "@/lib/access-control";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  SUPER_ADMIN: 6,
  VICE_CHAIRPERSON: 5,
  ADMIN: 4,
  DEPARTMENT_LEAD: 3,
  YOUTH_LEADER: 2,
  MEMBER: 1,
};

interface FeaturePermissionsConfig {
  minRoles: FeatureMinRoles;
  rules: DepartmentAccessRule[];
}

/**
 * Read feature permissions config from Firestore.
 * Returns defaults if nothing is stored yet.
 */
export async function getFeaturePermissionsConfig(): Promise<FeaturePermissionsConfig> {
  const doc = await adminDb.collection("settings").doc("accessControl").get();
  if (!doc.exists) {
    return {
      minRoles: DEFAULT_FEATURE_MIN_ROLES,
      rules: DEFAULT_DEPARTMENT_ACCESS_RULES,
    };
  }

  const data = doc.data()!;
  return {
    minRoles: data.featureMinRoles
      ? mergeFeatureMinRoles(data.featureMinRoles)
      : DEFAULT_FEATURE_MIN_ROLES,
    rules: data.departmentAccessRules
      ? mergeDepartmentAccessRules(data.departmentAccessRules)
      : DEFAULT_DEPARTMENT_ACCESS_RULES,
  };
}

/**
 * Build a map of department name → Firestore document ID.
 * Optionally filter to specific department names for efficiency.
 */
export async function getDepartmentNameToIdMap(
  filterNames?: string[]
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};

  if (filterNames && filterNames.length > 0) {
    // Firestore 'in' queries support up to 30 items
    const chunks: string[][] = [];
    for (let i = 0; i < filterNames.length; i += 30) {
      chunks.push(filterNames.slice(i, i + 30));
    }
    for (const chunk of chunks) {
      const snap = await adminDb
        .collection("departments")
        .where("name", "in", chunk)
        .get();
      snap.docs.forEach((d) => {
        map[d.data().name] = d.id;
      });
    }
  } else {
    const snap = await adminDb.collection("departments").get();
    snap.docs.forEach((d) => {
      map[d.data().name] = d.id;
    });
  }

  return map;
}

/** Resolve a single department's Firestore ID by its display name. */
export async function getDepartmentIdByName(
  name: string
): Promise<string | null> {
  const map = await getDepartmentNameToIdMap([name]);
  return map[name] ?? null;
}

/**
 * Simple server-side check for features that only need role-based access
 * (no department rules). Lighter weight than serverCheckFeatureAccess.
 */
export async function serverHasFeatureMinRole(
  featureKey: string,
  userRole: UserRole
): Promise<boolean> {
  if (userRole === "SUPER_ADMIN") return true;
  const config = await getFeaturePermissionsConfig();
  const minRole = config.minRoles[featureKey] ?? "SUPER_ADMIN";
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

export interface FeatureRecipient {
  id: string;
  name: string;
  email: string | null;
}

/**
 * Every active user who currently has a feature — the inverse of
 * `serverCheckFeatureAccess`, for notifying "whoever owns this queue".
 *
 * Firestore can't evaluate the role hierarchy or department rules server-side,
 * so this narrows to the users who could plausibly qualify (by role, by
 * department membership, by department leadership) and then runs each candidate
 * through the same `checkFeatureAccess` the pages and APIs use, so a permission
 * reconfigured in Settings changes who gets notified with no code change.
 */
export async function getFeatureRecipients(
  featureKey: string
): Promise<FeatureRecipient[]> {
  const config = await getFeaturePermissionsConfig();
  const minRole = config.minRoles[featureKey] ?? "SUPER_ADMIN";
  const qualifyingRoles = (Object.keys(ROLE_HIERARCHY) as UserRole[]).filter(
    (role) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole]
  );

  const deptNames = config.rules
    .filter((r) => r.featureKey === featureKey)
    .map((r) => r.departmentName);
  const deptMap =
    deptNames.length > 0 ? await getDepartmentNameToIdMap(deptNames) : {};
  const deptIds = Array.from(new Set(Object.values(deptMap)));

  const users = adminDb.collection("users");
  // Single-field filters only (and in-memory isActive filtering) so this needs
  // no composite indexes. 'in' / 'array-contains-any' cap at 30 values, which
  // both role lists and per-feature department lists stay well under.
  const snaps = await Promise.all([
    qualifyingRoles.length > 0
      ? users.where("role", "in", qualifyingRoles.slice(0, 30)).get()
      : null,
    deptIds.length > 0
      ? users.where("departmentIds", "array-contains-any", deptIds.slice(0, 30)).get()
      : null,
    deptIds.length > 0
      ? users
          .where("leadsDepartmentIds", "array-contains-any", deptIds.slice(0, 30))
          .get()
      : null,
  ]);

  const recipients = new Map<string, FeatureRecipient>();
  for (const snap of snaps) {
    if (!snap) continue;
    for (const doc of snap.docs) {
      if (recipients.has(doc.id)) continue;
      const data = doc.data();
      if (data.isActive === false) continue;
      const allowed = checkFeatureAccess(
        featureKey,
        data.role as UserRole,
        (data.departmentIds as string[] | undefined) ?? [],
        (data.leadsDepartmentIds as string[] | undefined) ?? [],
        deptMap,
        config
      );
      if (!allowed) continue;
      recipients.set(doc.id, {
        id: doc.id,
        name: (data.name as string | undefined) || "",
        email: (data.email as string | undefined) || null,
      });
    }
  }

  return Array.from(recipients.values());
}

/**
 * High-level server-side check: does this user have access to this feature?
 * Reads config from Firestore and resolves department names automatically.
 */
export async function serverCheckFeatureAccess(
  featureKey: string,
  userRole: UserRole,
  userDepartmentIds: string[],
  userLeadsDepartmentIds: string[]
): Promise<boolean> {
  // SUPER_ADMIN always has access (fast path)
  if (userRole === "SUPER_ADMIN") return true;

  const config = await getFeaturePermissionsConfig();

  // Get department names referenced in rules for this feature
  const relevantRules = config.rules.filter((r) => r.featureKey === featureKey);
  const deptNames = relevantRules.map((r) => r.departmentName);

  const deptMap =
    deptNames.length > 0 ? await getDepartmentNameToIdMap(deptNames) : {};

  return checkFeatureAccess(
    featureKey,
    userRole,
    userDepartmentIds,
    userLeadsDepartmentIds,
    deptMap,
    config
  );
}
