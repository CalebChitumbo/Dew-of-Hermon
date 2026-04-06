"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { safeDoc } from "@/lib/firebase";
import { FeaturePermissions, PagePermissions } from "@/types";
import {
  DEFAULT_FEATURE_PERMISSIONS,
  DEFAULT_PAGE_PERMISSIONS,
  mergeFeaturePermissionsWithDefaults,
  mergeWithDefaults,
} from "@/lib/access-control";

interface AccessControlContextType {
  /** Custom page permissions from Firestore, or defaults */
  pagePermissions: PagePermissions;
  /** Department-specific feature permissions from Firestore, or defaults */
  featurePermissions: FeaturePermissions;
  loading: boolean;
}

const AccessControlContext = createContext<AccessControlContextType>({
  pagePermissions: DEFAULT_PAGE_PERMISSIONS,
  featurePermissions: DEFAULT_FEATURE_PERMISSIONS,
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
  const [featurePermissions, setFeaturePermissions] =
    useState<FeaturePermissions>(DEFAULT_FEATURE_PERMISSIONS);
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
          if (data.featurePermissions) {
            setFeaturePermissions(
              mergeFeaturePermissionsWithDefaults(data.featurePermissions)
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
      value={{ pagePermissions, featurePermissions, loading }}
    >
      {children}
    </AccessControlContext.Provider>
  );
}

export const useAccessControl = () => useContext(AccessControlContext);
