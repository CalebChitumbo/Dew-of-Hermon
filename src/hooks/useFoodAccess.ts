"use client";

import { useEffect, useState } from "react";
import { getDocs } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { checkFeatureAccess } from "@/lib/access-control";

interface FoodAccess {
  loading: boolean;
  /** True for SUPER_ADMIN, ADMIN, or any DEPARTMENT_LEAD of Food Logistics. */
  canConfirmFood: boolean;
}

/**
 * Resolves the current user's Food-Logistics capability. Looks up the
 * "Food Logistics" department by name to check leadership for non-admin roles.
 */
export function useFoodAccess(): FoodAccess {
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
    return { loading: true, canConfirmFood: false };
  }
  if (needsDeptLookup && deptMap === null) {
    return { loading: true, canConfirmFood: false };
  }

  const config = { minRoles: featureMinRoles, rules: departmentAccessRules };
  const deps = userData.departmentIds ?? [];
  const leads = userData.leadsDepartmentIds ?? [];
  const map = deptMap ?? {};

  return {
    loading: false,
    canConfirmFood: checkFeatureAccess(
      "confirm_food",
      userData.role,
      deps,
      leads,
      map,
      config
    ),
  };
}
