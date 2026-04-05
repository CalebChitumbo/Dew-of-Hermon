"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { hasMinRole } from "@/lib/permissions";
import { canAccessPage, canEditPage, getPageKeyFromRoute } from "@/lib/access-control";
import { UserRole } from "@/types";
import { PageLoader } from "./LoadingSpinner";
import { usePathname } from "next/navigation";

interface RoleProtectedProps {
  children: React.ReactNode;
  /** Legacy: minimum role check (still works as before) */
  requiredRole?: UserRole;
  /** New: page key to check against access control config */
  pageKey?: string;
  /** If true, requires "edit" access; otherwise "view" is sufficient */
  requireEdit?: boolean;
  fallback?: React.ReactNode;
}

export function RoleProtected({
  children,
  requiredRole,
  pageKey,
  requireEdit = false,
  fallback,
}: RoleProtectedProps) {
  const { userData, loading } = useAuth();
  const { pagePermissions, loading: acLoading } = useAccessControl();
  const pathname = usePathname();

  if (loading || acLoading) return <PageLoader />;

  if (!userData) {
    return renderDenied(fallback);
  }

  // If a pageKey is provided, use access control
  // Otherwise try to infer from route, falling back to legacy role check
  const effectivePageKey = pageKey ?? getPageKeyFromRoute(pathname);

  if (effectivePageKey) {
    const hasAccess = requireEdit
      ? canEditPage(effectivePageKey, userData.role, pagePermissions)
      : canAccessPage(effectivePageKey, userData.role, pagePermissions);

    if (!hasAccess) {
      return renderDenied(fallback);
    }
  } else if (requiredRole) {
    // Legacy fallback: use role hierarchy
    if (!hasMinRole(userData.role, requiredRole)) {
      return renderDenied(fallback);
    }
  }

  return <>{children}</>;
}

function renderDenied(fallback?: React.ReactNode) {
  if (fallback) return <>{fallback}</>;
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-display text-clay-700">Access Denied</h2>
        <p className="mt-2 text-clay-500">
          You don&apos;t have permission to view this page.
        </p>
      </div>
    </div>
  );
}
