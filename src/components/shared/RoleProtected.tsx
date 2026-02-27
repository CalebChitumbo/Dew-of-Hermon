"use client";

import { useAuth } from "@/contexts/AuthContext";
import { hasMinRole } from "@/lib/permissions";
import { UserRole } from "@/types";
import { PageLoader } from "./LoadingSpinner";

interface RoleProtectedProps {
  children: React.ReactNode;
  requiredRole: UserRole;
  fallback?: React.ReactNode;
}

export function RoleProtected({
  children,
  requiredRole,
  fallback,
}: RoleProtectedProps) {
  const { userData, loading } = useAuth();

  if (loading) return <PageLoader />;

  if (!userData || !hasMinRole(userData.role, requiredRole)) {
    return fallback ? (
      <>{fallback}</>
    ) : (
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

  return <>{children}</>;
}
