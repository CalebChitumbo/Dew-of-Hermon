"use client";

import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { ROPS_CAMP_DEPARTMENT_NAME } from "@/lib/camps";

interface CampLeadAccess {
  loading: boolean;
  /** True for SUPER_ADMIN, ADMIN, or any DEPARTMENT_LEAD of the ROPs Camp department. */
  canManage: boolean;
  /**
   * True for anyone who may see the read-only camp status page — every
   * DEPARTMENT_LEAD by default, plus everyone who can manage the camp.
   */
  canViewStatus: boolean;
}

/**
 * Resolves the current user's access to the ROPs Camp registration data.
 * Looks up the "ROPs Camp" department by name to check leadership.
 */
export function useCampLeadAccess(): CampLeadAccess {
  const { loading, can } = useFeatureAccess();
  const canManage = can("manage_camp_registrations");
  return {
    loading,
    canManage,
    canViewStatus: canManage || can("view_camp_registrations"),
  };
}

export { ROPS_CAMP_DEPARTMENT_NAME };
