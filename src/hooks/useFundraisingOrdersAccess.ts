"use client";

import { useEffect, useState } from "react";
import { getDocs } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { checkFeatureAccess } from "@/lib/access-control";
import { FUNDRAISING_DEPARTMENT_NAME } from "@/lib/braai";

interface FundraisingOrdersAccess {
  loading: boolean;
  /** True for ADMIN/SUPER_ADMIN or any member/lead of the Fundraising department. */
  canManageOrders: boolean;
}

/**
 * Whether the current user can view and update Potter's Shockers orders.
 * Departments are looked up by name to resolve the rule for non-admin roles.
 */
export function useFundraisingOrdersAccess(): FundraisingOrdersAccess {
  const { userData, loading: authLoading } = useAuth();
  const { featureMinRoles, departmentAccessRules, loading: acLoading } =
    useAccessControl();
  const [deptMap, setDeptMap] = useState<Record<string, string> | null>(null);

  // Anyone below ADMIN needs a department lookup to check the rule.
  const needsDeptLookup =
    userData?.role !== "SUPER_ADMIN" && userData?.role !== "ADMIN";

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
    return { loading: true, canManageOrders: false };
  }
  if (needsDeptLookup && deptMap === null) {
    return { loading: true, canManageOrders: false };
  }

  const canManageOrders = checkFeatureAccess(
    "manage_fundraising_orders",
    userData.role,
    userData.departmentIds ?? [],
    userData.leadsDepartmentIds ?? [],
    deptMap ?? {},
    { minRoles: featureMinRoles, rules: departmentAccessRules }
  );

  return { loading: false, canManageOrders };
}

export { FUNDRAISING_DEPARTMENT_NAME };
