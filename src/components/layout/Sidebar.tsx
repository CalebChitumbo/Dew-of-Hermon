"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { canAccessPage } from "@/lib/access-control";
import { cn } from "@/lib/utils";
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
  UserCircle,
  CalendarDays,
  LogOut,
  CalendarPlus,
  ClipboardCheck,
  GraduationCap,
  Heart,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NotificationBell } from "@/components/shared/NotificationBell";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  /** The page key used for access control lookup */
  pageKey: string | null;
}

/**
 * All possible nav items. Visibility is determined by the access control
 * config rather than hardcoded role checks.
 * pageKey=null means the item is always shown (e.g. settings uses its own guard).
 */
const allNavItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, pageKey: "dashboard" },
  { label: "Departments", href: "/departments", icon: Building2, pageKey: "departments" },
  { label: "Members", href: "/manage/members", icon: Users, pageKey: "members" },
  { label: "Services & Rotas", href: "/manage/services", icon: ClipboardList, pageKey: "services" },
  { label: "Calendar", href: "/calendar", icon: Calendar, pageKey: "calendar" },
  { label: "Create Event", href: "/manage/events/new", icon: CalendarPlus, pageKey: "events_create" },
  { label: "Event Approvals", href: "/manage/events/approvals", icon: ClipboardCheck, pageKey: "events_approvals" },
  { label: "Campus Ministry", href: "/department/campus-ministry", icon: GraduationCap, pageKey: "campus_ministry" },
  { label: "Life Groups", href: "/department/life-groups", icon: UsersRound, pageKey: "life_groups" },
  { label: "Discipleship", href: "/department/discipleship", icon: Heart, pageKey: "discipleship" },
  { label: "Affirmations", href: "/affirmations", icon: Sparkles, pageKey: "affirmations" },
  { label: "Templates", href: "/manage/templates", icon: Mail, pageKey: "templates" },
  { label: "Reports", href: "/manage/reports", icon: BarChart3, pageKey: "reports" },
  { label: "Settings", href: "/manage/settings", icon: Settings, pageKey: null },
];

/** Items always shown for all logged-in users */
const alwaysVisibleItems: NavItem[] = [
  { label: "My Schedule", href: "/my-schedule", icon: CalendarDays, pageKey: null },
];

export function Sidebar() {
  const pathname = usePathname();
  const { userData, signOut } = useAuth();
  const { pagePermissions } = useAccessControl();

  if (!userData) return null;

  const role = userData.role;

  const getVisibleItems = (): NavItem[] => {
    const items: NavItem[] = [];

    for (const item of allNavItems) {
      // Settings is always SUPER_ADMIN only
      if (item.href === "/manage/settings") {
        if (role === "SUPER_ADMIN") items.push(item);
        continue;
      }

      // Check access control config
      if (item.pageKey && canAccessPage(item.pageKey, role, pagePermissions)) {
        items.push(item);
      }
    }

    // Add "My Schedule" for all users who aren't ADMIN+ (they see it in the main list via services)
    if (role === "MEMBER" || role === "YOUTH_LEADER" || role === "DEPARTMENT_LEAD") {
      items.push(...alwaysVisibleItems);
    }

    return items;
  };

  const visibleItems = getVisibleItems();

  const handleSignOut = async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    await signOut();
  };

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-clay-200">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-clay-200">
        <span className="text-3xl">&#x1F3FA;</span>
        <div>
          <h1 className="font-display text-lg text-clay-700">Potter&apos;s Wheel</h1>
          <p className="text-[10px] text-clay-400 -mt-1">Dew of Hermon</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-clay-100 text-clay-700"
                  : "text-clay-500 hover:bg-clay-50 hover:text-clay-700"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Separator />

      {/* User section */}
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/20 text-gold-dark text-sm font-bold">
            {userData.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-clay-700 truncate">
              {userData.name}
            </p>
            <p className="text-xs text-clay-400 truncate">
              {userData.role.replace("_", " ")}
            </p>
          </div>
          <NotificationBell />
        </div>
        <div className="flex gap-2">
          <Link href="/profile" className="flex-1">
            <Button variant="ghost" size="sm" className="w-full justify-start">
              <UserCircle className="mr-2 h-4 w-4" />
              Profile
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
