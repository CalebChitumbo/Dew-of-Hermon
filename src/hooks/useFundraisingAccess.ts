"use client";

import { useEffect, useState } from "react";
import { getDocs } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { checkFeatureAccess } from "@/lib/access-control";
import { FUNDRAISING_DEPARTMENT_NAME } from "@/lib/braai";

interface FundraisingAccess {
  loading: boolean;
  /** True for SUPER_ADMIN, ADMIN, or any DEPARTMENT_LEAD of the Fundraising department. */
  canPlanBraai: boolean;
}

/**
 * Resolves whether the current user can plan/manage the fundraising braai.
 * Looks up the "Fundraising" department by name to check leadership for
 * non-admin roles.
 */
export function useFundraisingAccess(): FundraisingAccess {
  const { userData, loading: authLoading } = useAuth();
  const { featureMinRoles, departmentAccessRules, loading: acLoading } =
    useAccessControl();
  const [deptMap, setDeptMap] = useState<Record<string, string> | null>(null);

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
    return { loading: true, canPlanBraai: false };
  }
  if (needsDeptLookup && deptMap === null) {
    return { loading: true, canPlanBraai: false };
  }

  const canPlanBraai = checkFeatureAccess(
    "plan_fundraising_braai",
    userData.role,
    userData.departmentIds ?? [],
    userData.leadsDepartmentIds ?? [],
    deptMap ?? {},
    { minRoles: featureMinRoles, rules: departmentAccessRules }
  );

  return { loading: false, canPlanBraai };
}

export { FUNDRAISING_DEPARTMENT_NAME };
