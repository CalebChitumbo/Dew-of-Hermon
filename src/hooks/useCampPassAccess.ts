"use client";

import { useFeatureAccess } from "@/hooks/useFeatureAccess";

export interface CampPassAccess {
  loading: boolean;
  /** Can log walk-up requests and give the first sign-off. */
  canAdmissions: boolean;
  /** Can give the Camp Manager sign-off. */
  canManager: boolean;
  /** Can give the final sign-off that issues the gate pass. */
  canChair: boolean;
  /** Can scan passes at the gate. */
  canScanGate: boolean;
  /** Camp admin (registrations) — sees the queues read-only at minimum. */
  canManageCamp: boolean;
  /** Can open the exit-pass queue at all. */
  canSeeQueue: boolean;
}

/**
 * Resolves what the signed-in user may do in the ROPs Camp exit-pass workflow.
 * Each stage is a separate configurable permission so the chain
 * (Admissions → Camp Manager → Chairperson → gate) can't be short-cut.
 */
export function useCampPassAccess(): CampPassAccess {
  const { loading, can } = useFeatureAccess();
  const canAdmissions = can("camp_pass_admissions");
  const canManager = can("camp_pass_manager");
  const canChair = can("camp_pass_chair");
  const canManageCamp = can("manage_camp_registrations");

  return {
    loading,
    canAdmissions,
    canManager,
    canChair,
    canScanGate: can("scan_camp_passes"),
    canManageCamp,
    canSeeQueue: canAdmissions || canManager || canChair || canManageCamp,
  };
}
