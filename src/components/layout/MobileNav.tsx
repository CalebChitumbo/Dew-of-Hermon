"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { canAccessPage } from "@/lib/access-control";
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
    // Pick a priority list based on role tier
    let candidates: MobileNavItem[];
    if (role === "SUPER_ADMIN" || role === "ADMIN") {
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-clay-200 lg:hidden">
      <div className="flex items-center justify-around py-2">
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1 min-w-[64px]",
                isActive ? "text-gold-dark" : "text-clay-400"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
