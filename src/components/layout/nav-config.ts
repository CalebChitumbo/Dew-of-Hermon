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
  Clapperboard,
  UtensilsCrossed,
} from "lucide-react";
import { canAccessPage } from "@/lib/access-control";
import type { PagePermissions, UserRole } from "@/types";

/**
 * Logical sections used to group the navigation so the sidebar reads as a
 * small set of themed areas instead of one long flat list. The order here is
 * the order sections appear in the sidebar and command palette.
 */
export type NavGroupKey =
  | "overview"
  | "services"
  | "people"
  | "ministries"
  | "requests"
  | "resources"
  | "admin";

export interface NavGroupDef {
  key: NavGroupKey;
  label: string;
}

export const NAV_GROUPS: NavGroupDef[] = [
  { key: "overview", label: "Overview" },
  { key: "services", label: "Services & Events" },
  { key: "people", label: "People" },
  { key: "ministries", label: "Ministries" },
  { key: "requests", label: "Requests & Approvals" },
  { key: "resources", label: "Resources" },
  { key: "admin", label: "Admin" },
];

export interface NavItem {
  label: string;
  href: string;
  icon: ElementType;
  /** The page key used for access control lookup. null means always shown. */
  pageKey: string | null;
  /** Which sidebar section this item belongs to. */
  group: NavGroupKey;
  /** Short description surfaced in the command palette. */
  description?: string;
}

/**
 * All possible nav items. Visibility is determined by the access control
 * config rather than hardcoded role checks.
 * pageKey=null means the item uses its own guard (e.g. settings is SUPER_ADMIN only).
 */
export const allNavItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, pageKey: "dashboard", group: "overview", description: "What needs your attention today" },
  { label: "Calendar", href: "/calendar", icon: Calendar, pageKey: "calendar", group: "overview", description: "Every event in one view" },
  { label: "Services & Rotas", href: "/manage/services", icon: ClipboardList, pageKey: "services", group: "services", description: "Plan services and assign roles" },
  { label: "Create Event", href: "/manage/events/new", icon: CalendarPlus, pageKey: "events_create", group: "services", description: "Propose a new event" },
  { label: "Event Approvals", href: "/manage/events/approvals", icon: ClipboardCheck, pageKey: "events_approvals", group: "services", description: "Approve or reject event requests" },
  { label: "Event Reports", href: "/manage/events/reports", icon: FileText, pageKey: "event_reports_submit", group: "services", description: "Submit post-event reports" },
  { label: "Members", href: "/manage/members", icon: Users, pageKey: "members", group: "people", description: "Directory, roles & life groups" },
  { label: "Departments", href: "/departments", icon: Building2, pageKey: "departments", group: "people", description: "Browse ministry departments" },
  { label: "Campus Ministry", href: "/department/campus-ministry", icon: GraduationCap, pageKey: "campus_ministry", group: "ministries", description: "Campus updates & devotionals" },
  { label: "Life Groups", href: "/department/life-groups", icon: UsersRound, pageKey: "life_groups", group: "ministries", description: "Life group directory & devotionals" },
  { label: "Discipleship", href: "/department/discipleship", icon: Heart, pageKey: "discipleship", group: "ministries", description: "Follow-up pipeline" },
  { label: "Latreou", href: "/latreou", icon: Music, pageKey: "latreou", group: "ministries", description: "Worship cycles & rehearsals" },
  { label: "ROPs Camp", href: "/manage/rops-camp", icon: Tent, pageKey: "rops_camp", group: "ministries", description: "Camp registrations & logistics" },
  { label: "Fundraising", href: "/manage/fundraising", icon: Flame, pageKey: "fundraising", group: "ministries", description: "Braai planning & orders" },
  { label: "Transport Requests", href: "/manage/transport/requests", icon: Bus, pageKey: "transport_requests", group: "requests", description: "Coordinate event transport" },
  { label: "Media Requests", href: "/manage/media/requests", icon: Clapperboard, pageKey: "media_requests", group: "requests", description: "Sound, publicity & coverage" },
  { label: "Food Requests", href: "/manage/food/requests", icon: UtensilsCrossed, pageKey: "food_requests", group: "requests", description: "Catering & headcount" },
  { label: "Accounts Approvals", href: "/manage/finance/approvals", icon: Banknote, pageKey: "accounts_approvals", group: "requests", description: "Treasurer budget decisions" },
  { label: "Affirmations", href: "/affirmations", icon: Sparkles, pageKey: "affirmations", group: "resources", description: "Encouragement for the team" },
  { label: "Templates", href: "/manage/templates", icon: Mail, pageKey: "templates", group: "resources", description: "Email notification templates" },
  { label: "Reports", href: "/manage/reports", icon: BarChart3, pageKey: "reports", group: "resources", description: "Ministry analytics" },
  { label: "Settings", href: "/manage/settings", icon: Settings, pageKey: null, group: "admin", description: "Access control & configuration" },
];

/** Items always shown for non-admin users (their personal schedule). */
export const alwaysVisibleItems: NavItem[] = [
  { label: "My Schedule", href: "/my-schedule", icon: CalendarDays, pageKey: null, group: "overview", description: "Your assignments & availability" },
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

export interface NavSection {
  key: NavGroupKey;
  label: string;
  items: NavItem[];
}

/**
 * Bucket a flat list of (already access-filtered) nav items into ordered
 * sections, dropping any section that ended up empty for this role.
 */
export function groupNavItems(items: NavItem[]): NavSection[] {
  return NAV_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    items: items.filter((i) => i.group === g.key),
  })).filter((s) => s.items.length > 0);
}
