"use client";

import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { FUNDRAISING_DEPARTMENT_NAME } from "@/lib/braai";

interface FundraisingAccess {
  loading: boolean;
  /** True for SUPER_ADMIN, ADMIN, or any DEPARTMENT_LEAD of the Fundraising department. */
  canPlanBraai: boolean;
}

/**
 * Resolves whether the current user can plan/manage the fundraising braai.
 * Looks up the "Fundraising" department by name to check leadership for
 * non-admin roles.
 */
export function useFundraisingAccess(): FundraisingAccess {
  const { loading, can } = useFeatureAccess();
  return {
    loading,
    canPlanBraai: can("plan_fundraising_braai"),
  };
}

export { FUNDRAISING_DEPARTMENT_NAME };
