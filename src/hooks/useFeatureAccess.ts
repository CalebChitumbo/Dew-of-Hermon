"use client";

import { useEffect, useState } from "react";
import { getDocs } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { checkFeatureAccess } from "@/lib/access-control";

type DepartmentNameMap = Record<string, string>;

// Department names change rarely, so the name→id map is fetched once per
// session and shared by every access hook instead of once per hook per mount.
let deptMapCache: DepartmentNameMap | null = null;
let deptMapPromise: Promise<DepartmentNameMap> | null = null;

function fetchDepartmentNameMap(): Promise<DepartmentNameMap> {
  if (deptMapCache) return Promise.resolve(deptMapCache);
  if (!deptMapPromise) {
    deptMapPromise = getDocs(safeCollection("departments"))
      .then((snap) => {
        const map: DepartmentNameMap = {};
        snap.docs.forEach((d) => {
          const name = d.data().name as string | undefined;
          if (name) map[name] = d.id;
        });
        deptMapCache = map;
        return map;
      })
      .catch(() => {
        deptMapPromise = null;
        return {};
      });
  }
  return deptMapPromise;
}

/** Clear the cached department map (call after renaming/creating departments). */
export function invalidateDepartmentNameMap(): void {
  deptMapCache = null;
  deptMapPromise = null;
}

export interface FeatureAccess {
  loading: boolean;
  /** Check a feature key against the current user, config and department rules. */
  can: (featureKey: string) => boolean;
}

/**
 * Shared implementation behind the feature-specific access hooks
 * (useTransportAccess, useFoodAccess, useMediaAccess, ...). Resolves the
 * current user's access to configurable features, including
 * department-membership rules which need the department name→id map.
 */
export function useFeatureAccess(): FeatureAccess {
  const { userData, loading: authLoading } = useAuth();
  const { featureMinRoles, departmentAccessRules, loading: acLoading } =
    useAccessControl();
  const [deptMap, setDeptMap] = useState<DepartmentNameMap | null>(
    deptMapCache
  );

  // ADMIN and SUPER_ADMIN pass every min-role check, so only lower roles need
  // the department lookup to resolve membership/leadership rules.
  const needsDeptLookup =
    !!userData &&
    userData.role !== "SUPER_ADMIN" &&
    userData.role !== "ADMIN";

  useEffect(() => {
    if (!needsDeptLookup || deptMap !== null) return;
    let cancelled = false;
    fetchDepartmentNameMap().then((map) => {
      if (!cancelled) setDeptMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, [needsDeptLookup, deptMap]);

  const loading =
    authLoading ||
    acLoading ||
    !userData ||
    (needsDeptLookup && deptMap === null);

  return {
    loading,
    can: (featureKey: string) => {
      if (loading || !userData) return false;
      return checkFeatureAccess(
        featureKey,
        userData.role,
        userData.departmentIds ?? [],
        userData.leadsDepartmentIds ?? [],
        deptMap ?? {},
        { minRoles: featureMinRoles, rules: departmentAccessRules }
      );
    },
  };
}
