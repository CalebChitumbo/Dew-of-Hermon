"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { safeDoc } from "@/lib/firebase";
import {
  DepartmentAccessRule,
  FeatureMinRoles,
  PagePermissions,
} from "@/types";
import {
  DEFAULT_PAGE_PERMISSIONS,
  DEFAULT_FEATURE_MIN_ROLES,
  DEFAULT_DEPARTMENT_ACCESS_RULES,
  mergeWithDefaults,
  mergeFeatureMinRoles,
  mergeDepartmentAccessRules,
} from "@/lib/access-control";

interface AccessControlContextType {
  pagePermissions: PagePermissions;
  featureMinRoles: FeatureMinRoles;
  departmentAccessRules: DepartmentAccessRule[];
  loading: boolean;
}

const AccessControlContext = createContext<AccessControlContextType>({
  pagePermissions: DEFAULT_PAGE_PERMISSIONS,
  featureMinRoles: DEFAULT_FEATURE_MIN_ROLES,
  departmentAccessRules: DEFAULT_DEPARTMENT_ACCESS_RULES,
  loading: true,
});

export function AccessControlProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [pagePermissions, setPagePermissions] = useState<PagePermissions>(
    DEFAULT_PAGE_PERMISSIONS
  );
  const [featureMinRoles, setFeatureMinRoles] = useState<FeatureMinRoles>(
    DEFAULT_FEATURE_MIN_ROLES
  );
  const [departmentAccessRules, setDepartmentAccessRules] = useState<
    DepartmentAccessRule[]
  >(DEFAULT_DEPARTMENT_ACCESS_RULES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = safeDoc("settings", "accessControl");
    const unsub = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.pagePermissions) {
            setPagePermissions(mergeWithDefaults(data.pagePermissions));
          }
          if (data.featureMinRoles) {
            setFeatureMinRoles(mergeFeatureMinRoles(data.featureMinRoles));
          }
          if (data.departmentAccessRules) {
            setDepartmentAccessRules(
              mergeDepartmentAccessRules(data.departmentAccessRules)
            );
          }
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error loading access control config:", error);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return (
    <AccessControlContext.Provider
      value={{ pagePermissions, featureMinRoles, departmentAccessRules, loading }}
    >
      {children}
    </AccessControlContext.Provider>
  );
}

export const useAccessControl = () => useContext(AccessControlContext);
