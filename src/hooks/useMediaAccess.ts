"use client";

import { useFeatureAccess } from "@/hooks/useFeatureAccess";

interface MediaAccess {
  loading: boolean;
  /** True for SUPER_ADMIN, ADMIN, or any DEPARTMENT_LEAD of the Media department. */
  canManageMedia: boolean;
}

/**
 * Resolves the current user's Media-coordinator capability. Looks up the
 * "Media" department by name to check leadership for non-admin roles.
 */
export function useMediaAccess(): MediaAccess {
  const { loading, can } = useFeatureAccess();
  return {
    loading,
    canManageMedia: can("manage_media"),
  };
}
