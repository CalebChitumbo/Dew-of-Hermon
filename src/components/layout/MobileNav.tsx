"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { canAccessPage } from "@/lib/access-control";
import { hasMinRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Bell,
  UserCircle,
  CalendarDays,
  Sparkles,
  Users,
} from "lucide-react";

interface MobileNavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  pageKey: string | null;
}

/** Priority-ordered items for each "category" of mobile nav */
const adminPriority: MobileNavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, pageKey: "dashboard" },
  { label: "Members", href: "/manage/members", icon: Users, pageKey: "members" },
  { label: "Services", href: "/manage/services", icon: ClipboardList, pageKey: "services" },
  { label: "Calendar", href: "/calendar", icon: Calendar, pageKey: "calendar" },
  { label: "Profile", href: "/profile", icon: UserCircle, pageKey: null },
];

const leadPriority: MobileNavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, pageKey: "dashboard" },
  { label: "Services", href: "/manage/services", icon: ClipboardList, pageKey: "services" },
  { label: "Calendar", href: "/calendar", icon: Calendar, pageKey: "calendar" },
  { label: "Alerts", href: "/notifications", icon: Bell, pageKey: null },
  { label: "Profile", href: "/profile", icon: UserCircle, pageKey: null },
];

const memberPriority: MobileNavItem[] = [
  { label: "Schedule", href: "/my-schedule", icon: CalendarDays, pageKey: null },
  { label: "Calendar", href: "/calendar", icon: Calendar, pageKey: "calendar" },
  { label: "Notes", href: "/affirmations", icon: Sparkles, pageKey: "affirmations" },
  { label: "Alerts", href: "/notifications", icon: Bell, pageKey: null },
  { label: "Profile", href: "/profile", icon: UserCircle, pageKey: null },
];

export function MobileNav() {
  const pathname = usePathname();
  const { userData } = useAuth();
  const { pagePermissions } = useAccessControl();

  if (!userData) return null;

  const role = userData.role;

  const getItems = (): MobileNavItem[] => {
    // Pick a priority list based on role tier. Uses the shared role hierarchy so
    // every admin-level role (incl. Vice-Chairperson) gets the admin bar.
    let candidates: MobileNavItem[];
    if (hasMinRole(role, "ADMIN")) {
      candidates = adminPriority;
    } else if (role === "DEPARTMENT_LEAD") {
      candidates = leadPriority;
    } else {
      candidates = memberPriority;
    }

    // Filter by access control (items with no pageKey are always shown)
    return candidates.filter(
      (item) =>
        !item.pageKey || canAccessPage(item.pageKey, role, pagePermissions)
    );
  };

  const items = getItems();

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 lg:hidden",
        "border-t border-clay-100/80 bg-white/90 backdrop-blur-md",
        "shadow-[0_-12px_30px_-24px_rgba(91,58,41,0.45)]"
      )}
      // Lift the bar above the home indicator on notched devices.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch justify-around px-2 py-1.5">
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className="group flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-2xl transition-all duration-200",
                  isActive
                    ? "bg-gold/15 text-gold-dark shadow-[0_8px_18px_-12px_rgba(154,114,48,0.85)] ring-1 ring-inset ring-gold/20"
                    : "text-clay-400 group-hover:bg-clay-50 group-hover:text-clay-600 group-active:bg-clay-50"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span
                className={cn(
                  "max-w-full truncate text-[10px] font-medium leading-none transition-colors",
                  isActive ? "text-clay-700" : "text-clay-400"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
