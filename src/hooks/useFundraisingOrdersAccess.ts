"use client";

import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { FUNDRAISING_DEPARTMENT_NAME } from "@/lib/braai";

interface FundraisingOrdersAccess {
  loading: boolean;
  /** True for ADMIN/SUPER_ADMIN or any member/lead of the Fundraising department. */
  canManageOrders: boolean;
}

/**
 * Whether the current user can view and update Potter's Shockers orders.
 * Departments are looked up by name to resolve the rule for non-admin roles.
 */
export function useFundraisingOrdersAccess(): FundraisingOrdersAccess {
  const { loading, can } = useFeatureAccess();
  return {
    loading,
    canManageOrders: can("manage_fundraising_orders"),
  };
}

export { FUNDRAISING_DEPARTMENT_NAME };
