"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { safeDoc } from "@/lib/firebase";
import { PagePermissions } from "@/types";
import {
  DEFAULT_PAGE_PERMISSIONS,
  mergeWithDefaults,
} from "@/lib/access-control";

interface AccessControlContextType {
  /** Custom page permissions from Firestore, or null if using defaults */
  pagePermissions: PagePermissions;
  loading: boolean;
}

const AccessControlContext = createContext<AccessControlContextType>({
  pagePermissions: DEFAULT_PAGE_PERMISSIONS,
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
    <AccessControlContext.Provider value={{ pagePermissions, loading }}>
      {children}
    </AccessControlContext.Provider>
  );
}

export const useAccessControl = () => useContext(AccessControlContext);
