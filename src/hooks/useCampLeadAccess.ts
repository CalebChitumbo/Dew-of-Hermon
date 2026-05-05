"use client";

import { useEffect, useState } from "react";
import { getDocs } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { checkFeatureAccess } from "@/lib/access-control";
import { ROPS_CAMP_DEPARTMENT_NAME } from "@/lib/camps";

interface CampLeadAccess {
  loading: boolean;
  /** True for SUPER_ADMIN, ADMIN, or any DEPARTMENT_LEAD of the ROPs Camp department. */
  canManage: boolean;
}

/**
 * Resolves the current user's access to the ROPs Camp registration data.
 * Looks up the "ROPs Camp" department by name to check leadership.
 */
export function useCampLeadAccess(): CampLeadAccess {
  const { userData, loading: authLoading } = useAuth();
  const { featureMinRoles, departmentAccessRules, loading: acLoading } =
    useAccessControl();
  const [deptMap, setDeptMap] = useState<Record<string, string> | null>(null);

  // Only DEPARTMENT_LEADs need the department lookup; other roles either
  // already pass via min-role or can never get camp access via dept rules.
  const needsDeptLookup = userData?.role === "DEPARTMENT_LEAD";

  useEffect(() => {
    if (!needsDeptLookup) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(safeCollection("departments"));
        if (cancelled) return;
        const map: Record<string, string> = {};
        snap.docs.forEach((d) => {
          const name = d.data().name as string | undefined;
          if (name) map[name] = d.id;
        });
        setDeptMap(map);
      } catch {
        if (!cancelled) setDeptMap({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needsDeptLookup]);

  if (authLoading || acLoading || !userData) {
    return { loading: true, canManage: false };
  }
  if (needsDeptLookup && deptMap === null) {
    return { loading: true, canManage: false };
  }

  const canManage = checkFeatureAccess(
    "manage_camp_registrations",
    userData.role,
    userData.departmentIds ?? [],
    userData.leadsDepartmentIds ?? [],
    deptMap ?? {},
    { minRoles: featureMinRoles, rules: departmentAccessRules }
  );

  return { loading: false, canManage };
}

export { ROPS_CAMP_DEPARTMENT_NAME };
