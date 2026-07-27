"use client";

import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { MEAL_FEATURE_SERVE } from "@/lib/camp-meals";

interface CampMealAccess {
  loading: boolean;
  /** Can scan badges at the serving line and undo a mis-scan. */
  canServe: boolean;
  /** Can see the camp register (full camp management rights). */
  canManage: boolean;
  /** Can open the meal pages at all. */
  canView: boolean;
}

/**
 * Access to the camp meal register. Serving is its own scan-only permission,
 * so the kitchen team can tick campers off without being able to edit
 * registrations or see payment records.
 */
export function useCampMealAccess(): CampMealAccess {
  const { loading, can } = useFeatureAccess();
  const canServe = can(MEAL_FEATURE_SERVE);
  const canManage = can("manage_camp_registrations");
  return { loading, canServe, canManage, canView: canServe || canManage };
}
