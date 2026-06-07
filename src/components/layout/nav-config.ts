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
  Church,
  CalendarRange,
  HeartHandshake,
  Inbox,
  ShieldCheck,
} from "lucide-react";
import { canAccessPage } from "@/lib/access-control";
import type { PagePermissions, UserRole } from "@/types";

export interface NavItem {
  label: string;
  href: string;
  icon: ElementType;
  /** The page key used for access control lookup. null means it uses its own guard. */
  pageKey: string | null;
}

/** A collapsible section that groups related nav items under one heading. */
export interface NavGroup {
  /** Stable id — used for the expand/collapse state and persistence. */
  id: string;
  label: string;
  icon: ElementType;
  items: NavItem[];
}

/** An entry in the sidebar is either a standalone link or a collapsible group. */
export type NavEntry =
  | { kind: "item"; item: NavItem }
  | { kind: "group"; group: NavGroup };

// ─── Standalone items shown above the groups ───
const TOP_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, pageKey: "dashboard" },
  // My Schedule: members/leads only — handled by the role check in shouldShow().
  { label: "My Schedule", href: "/my-schedule", icon: CalendarDays, pageKey: null },
];

// ─── Collapsible groups (rendered in this order) ───

/** Everything to do with running the weekly church service. */
const POTTERS_WILL: NavGroup = {
  id: "potters-will",
  label: "Potter's Will",
  icon: Church,
  items: [
    { label: "Services & Rotas", href: "/manage/services", icon: ClipboardList, pageKey: "services" },
    { label: "Latreou", href: "/latreou", icon: Music, pageKey: "latreou" },
  ],
};

const EVENTS: NavGroup = {
  id: "events",
  label: "Events",
  icon: CalendarRange,
  items: [
    { label: "Calendar", href: "/calendar", icon: Calendar, pageKey: "calendar" },
    { label: "Create Event", href: "/manage/events/new", icon: CalendarPlus, pageKey: "events_create" },
    { label: "Event Approvals", href: "/manage/events/approvals", icon: ClipboardCheck, pageKey: "events_approvals" },
    { label: "Event Reports", href: "/manage/events/reports", icon: FileText, pageKey: "event_reports_submit" },
  ],
};

const MINISTRIES: NavGroup = {
  id: "ministries",
  label: "Ministries",
  icon: HeartHandshake,
  items: [
    { label: "Departments", href: "/departments", icon: Building2, pageKey: "departments" },
    { label: "Campus Ministry", href: "/department/campus-ministry", icon: GraduationCap, pageKey: "campus_ministry" },
    { label: "Life Groups", href: "/department/life-groups", icon: UsersRound, pageKey: "life_groups" },
    { label: "Discipleship", href: "/department/discipleship", icon: Heart, pageKey: "discipleship" },
  ],
};

/** Stakeholder coordinator queues for approved events. */
const REQUESTS: NavGroup = {
  id: "requests",
  label: "Requests",
  icon: Inbox,
  items: [
    { label: "Transport Requests", href: "/manage/transport/requests", icon: Bus, pageKey: "transport_requests" },
    { label: "Media Requests", href: "/manage/media/requests", icon: Clapperboard, pageKey: "media_requests" },
    { label: "Food Requests", href: "/manage/food/requests", icon: UtensilsCrossed, pageKey: "food_requests" },
    { label: "Accounts Approvals", href: "/manage/finance/approvals", icon: Banknote, pageKey: "accounts_approvals" },
  ],
};

// ─── Standalone items shown below the main groups ───
const MID_ITEMS: NavItem[] = [
  { label: "Members", href: "/manage/members", icon: Users, pageKey: "members" },
  { label: "ROPs Camp", href: "/manage/rops-camp", icon: Tent, pageKey: "rops_camp" },
  { label: "Fundraising", href: "/manage/fundraising", icon: Flame, pageKey: "fundraising" },
  { label: "Affirmations", href: "/affirmations", icon: Sparkles, pageKey: "affirmations" },
];

/** Admin tooling — shown last. Settings is SUPER_ADMIN only (see shouldShow). */
const ADMIN: NavGroup = {
  id: "admin",
  label: "Admin",
  icon: ShieldCheck,
  items: [
    { label: "Templates", href: "/manage/templates", icon: Mail, pageKey: "templates" },
    { label: "Reports", href: "/manage/reports", icon: BarChart3, pageKey: "reports" },
    { label: "Settings", href: "/manage/settings", icon: Settings, pageKey: null },
  ],
};

/** Roles that get their personal "My Schedule" link. */
const SCHEDULE_ROLES: ReadonlyArray<UserRole> = [
  "MEMBER",
  "YOUTH_LEADER",
  "DEPARTMENT_LEAD",
];

/**
 * Decide whether a single nav item is visible for the given role.
 * Mirrors the old access-control behavior, including the two special cases
 * (Settings = SUPER_ADMIN only, My Schedule = members/leads only).
 */
function shouldShow(
  item: NavItem,
  role: UserRole,
  pagePermissions: PagePermissions,
  extraSet: Set<string>
): boolean {
  // Settings is always SUPER_ADMIN only.
  if (item.href === "/manage/settings") return role === "SUPER_ADMIN";

  // My Schedule is the personal view for non-admin roles.
  if (item.href === "/my-schedule") return SCHEDULE_ROLES.includes(role);

  // Anything else without a page key has no guard of its own — hide it.
  if (!item.pageKey) return false;

  return (
    canAccessPage(item.pageKey, role, pagePermissions) || extraSet.has(item.pageKey)
  );
}

/**
 * Single source of truth for the grouped sidebar contents a given role sees.
 * Used by both the desktop Sidebar and the mobile drawer so both views stay
 * in sync for every account type. Groups with no visible items are dropped.
 *
 * @param extraIncludeKeys Page keys to force-include even if `pagePermissions`
 *   would exclude them (e.g. a DEPARTMENT_LEAD of "ROPs Camp" gaining access to
 *   /manage/rops-camp via department-based feature rules).
 */
export function getVisibleNavEntries(
  role: UserRole,
  pagePermissions: PagePermissions,
  extraIncludeKeys: ReadonlyArray<string> = []
): NavEntry[] {
  const extraSet = new Set(extraIncludeKeys);
  const show = (item: NavItem) =>
    shouldShow(item, role, pagePermissions, extraSet);

  const entries: NavEntry[] = [];

  const pushItems = (items: NavItem[]) => {
    for (const item of items) {
      if (show(item)) entries.push({ kind: "item", item });
    }
  };

  const pushGroup = (group: NavGroup) => {
    const items = group.items.filter(show);
    if (items.length > 0) entries.push({ kind: "group", group: { ...group, items } });
  };

  pushItems(TOP_ITEMS);
  pushGroup(POTTERS_WILL);
  pushGroup(EVENTS);
  pushGroup(MINISTRIES);
  pushGroup(REQUESTS);
  pushItems(MID_ITEMS);
  pushGroup(ADMIN);

  return entries;
}
