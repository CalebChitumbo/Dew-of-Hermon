"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { useCampLeadAccess } from "@/hooks/useCampLeadAccess";
import { useFundraisingAccess } from "@/hooks/useFundraisingAccess";
import { useTransportAccess } from "@/hooks/useTransportAccess";
import { useMediaAccess } from "@/hooks/useMediaAccess";
import { useFoodAccess } from "@/hooks/useFoodAccess";
import {
  getVisibleNavItems,
  groupNavItems,
  type NavItem,
  type NavSection,
} from "./nav-config";

/**
 * Resolves the navigation a signed-in user can see, taking into account both
 * the access-control config and the department-based feature grants exposed
 * by the various access hooks. Centralised here so the desktop Sidebar, the
 * mobile drawer and the command palette never drift out of sync.
 */
export function useNavItems(): { items: NavItem[]; sections: NavSection[] } {
  const { userData } = useAuth();
  const { pagePermissions } = useAccessControl();
  const { canManage: canManageCamp } = useCampLeadAccess();
  const { canPlanBraai } = useFundraisingAccess();
  const { canManageTransport, canApproveAccounts } = useTransportAccess();
  const { canManageMedia } = useMediaAccess();
  const { canConfirmFood } = useFoodAccess();

  if (!userData) return { items: [], sections: [] };

  const extraKeys: string[] = [];
  if (canManageCamp) extraKeys.push("rops_camp");
  if (canPlanBraai) extraKeys.push("fundraising");
  if (canManageTransport) extraKeys.push("transport_requests");
  if (canApproveAccounts) extraKeys.push("accounts_approvals");
  if (canManageMedia) extraKeys.push("media_requests");
  if (canConfirmFood) extraKeys.push("food_requests");

  const items = getVisibleNavItems(userData.role, pagePermissions, extraKeys);
  return { items, sections: groupNavItems(items) };
}
