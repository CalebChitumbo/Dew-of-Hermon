"use client";

import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { ROPS_CAMP_DEPARTMENT_NAME } from "@/lib/camps";

interface CampLeadAccess {
  loading: boolean;
  /** True for SUPER_ADMIN, ADMIN, or any DEPARTMENT_LEAD of the ROPs Camp department. */
  canManage: boolean;
}

/**
 * Resolves the current user's access to the ROPs Camp registration data.
 * Looks up the "ROPs Camp" department by name to check leadership.
 */
export function useCampLeadAccess(): CampLeadAccess {
  const { loading, can } = useFeatureAccess();
  return {
    loading,
    canManage: can("manage_camp_registrations"),
  };
}

export { ROPS_CAMP_DEPARTMENT_NAME };
