"use client";

import { useFeatureAccess } from "@/hooks/useFeatureAccess";

interface FoodAccess {
  loading: boolean;
  /** True for SUPER_ADMIN, ADMIN, or any DEPARTMENT_LEAD of Food Logistics. */
  canConfirmFood: boolean;
}

/**
 * Resolves the current user's Food-Logistics capability. Looks up the
 * "Food Logistics" department by name to check leadership for non-admin roles.
 */
export function useFoodAccess(): FoodAccess {
  const { loading, can } = useFeatureAccess();
  return {
    loading,
    canConfirmFood: can("confirm_food"),
  };
}
