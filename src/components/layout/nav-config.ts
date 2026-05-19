import type { ElementType } from "react";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Calendar,
  Sparkles,
  Mail,
  BarChart3,
  Settings,
  Building2,
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Heart,
  UsersRound,
  Music,
  Tent,
  Flame,
  Bus,
  Banknote,
} from "lucide-react";
import { canAccessPage } from "@/lib/access-control";
import type { PagePermissions, UserRole } from "@/types";

export interface NavItem {
  label: string;
  href: string;
  icon: ElementType;
  /** The page key used for access control lookup. null means always shown. */
  pageKey: string | null;
}

/**
 * All possible nav items. Visibility is determined by the access control
 * config rather than hardcoded role checks.
 * pageKey=null means the item uses its own guard (e.g. settings is SUPER_ADMIN only).
 */
export const allNavItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, pageKey: "dashboard" },
  { label: "Departments", href: "/departments", icon: Building2, pageKey: "departments" },
  { label: "Members", href: "/manage/members", icon: Users, pageKey: "members" },
  { label: "Services & Rotas", href: "/manage/services", icon: ClipboardList, pageKey: "services" },
  { label: "Calendar", href: "/calendar", icon: Calendar, pageKey: "calendar" },
  { label: "Create Event", href: "/manage/events/new", icon: CalendarPlus, pageKey: "events_create" },
  { label: "Event Approvals", href: "/manage/events/approvals", icon: ClipboardCheck, pageKey: "events_approvals" },
  { label: "Event Reports", href: "/manage/events/reports", icon: FileText, pageKey: "event_reports_submit" },
  { label: "Campus Ministry", href: "/department/campus-ministry", icon: GraduationCap, pageKey: "campus_ministry" },
  { label: "Life Groups", href: "/department/life-groups", icon: UsersRound, pageKey: "life_groups" },
  { label: "Discipleship", href: "/department/discipleship", icon: Heart, pageKey: "discipleship" },
  { label: "Latreou", href: "/latreou", icon: Music, pageKey: "latreou" },
  { label: "ROPs Camp", href: "/manage/rops-camp", icon: Tent, pageKey: "rops_camp" },
  { label: "Fundraising", href: "/manage/fundraising", icon: Flame, pageKey: "fundraising" },
  { label: "Transport Requests", href: "/manage/transport/requests", icon: Bus, pageKey: "transport_requests" },
  { label: "Transport Approvals", href: "/manage/finance/transport-approvals", icon: Banknote, pageKey: "transport_approvals" },
  { label: "Affirmations", href: "/affirmations", icon: Sparkles, pageKey: "affirmations" },
  { label: "Templates", href: "/manage/templates", icon: Mail, pageKey: "templates" },
  { label: "Reports", href: "/manage/reports", icon: BarChart3, pageKey: "reports" },
  { label: "Settings", href: "/manage/settings", icon: Settings, pageKey: null },
];

/** Items always shown for non-admin users (their personal schedule). */
export const alwaysVisibleItems: NavItem[] = [
  { label: "My Schedule", href: "/my-schedule", icon: CalendarDays, pageKey: null },
];

/**
 * Single source of truth for which nav items a given role should see.
 * Used by both the desktop Sidebar and the mobile drawer so both views
 * stay in sync for every account type.
 */
export function getVisibleNavItems(
  role: UserRole,
  pagePermissions: PagePermissions,
  /**
   * Page keys to force-include even if `pagePermissions` would exclude them.
   * Used for items granted via department-based feature rules (e.g. a
   * DEPARTMENT_LEAD of "ROPs Camp" gaining access to /manage/rops-camp).
   */
  extraIncludeKeys: ReadonlyArray<string> = []
): NavItem[] {
  const items: NavItem[] = [];
  const extraSet = new Set(extraIncludeKeys);

  for (const item of allNavItems) {
    // Settings is always SUPER_ADMIN only
    if (item.href === "/manage/settings") {
      if (role === "SUPER_ADMIN") items.push(item);
      continue;
    }

    // Check access control config — or the explicit force-include list.
    const allowed =
      item.pageKey &&
      (canAccessPage(item.pageKey, role, pagePermissions) ||
        extraSet.has(item.pageKey));
    if (allowed) {
      items.push(item);
    }
  }

  // Add "My Schedule" for non-admin roles (admins navigate via Services & Rotas)
  if (role === "MEMBER" || role === "YOUTH_LEADER" || role === "DEPARTMENT_LEAD") {
    items.push(...alwaysVisibleItems);
  }

  return items;
}
