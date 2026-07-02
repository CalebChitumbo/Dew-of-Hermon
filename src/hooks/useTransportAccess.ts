"use client";

import { useFeatureAccess } from "@/hooks/useFeatureAccess";

interface TransportAccess {
  loading: boolean;
  /** True for SUPER_ADMIN, ADMIN, or any DEPARTMENT_LEAD of Transport & Logistics. */
  canManageTransport: boolean;
  /** True for SUPER_ADMIN, ADMIN, or any DEPARTMENT_LEAD of Finance (Treasurer). */
  canApproveAccounts: boolean;
}

/**
 * Resolves the current user's transport-coordinator and treasurer
 * capabilities. Looks up the "Transport & Logistics" and "Finance"
 * departments by name to check leadership for non-admin roles.
 */
export function useTransportAccess(): TransportAccess {
  const { loading, can } = useFeatureAccess();
  return {
    loading,
    canManageTransport: can("manage_transport_logistics"),
    canApproveAccounts: can("approve_accounts"),
  };
}
