"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
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
}

export function MobileNav() {
  const pathname = usePathname();
  const { userData } = useAuth();

  if (!userData) return null;

  const getItems = (): MobileNavItem[] => {
    if (hasMinRole(userData.role, "ADMIN")) {
      return [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Members", href: "/manage/members", icon: Users },
        { label: "Services", href: "/manage/services", icon: ClipboardList },
        { label: "Calendar", href: "/calendar", icon: Calendar },
        { label: "Profile", href: "/profile", icon: UserCircle },
      ];
    }
    if (userData.role === "DEPARTMENT_LEAD") {
      return [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Services", href: "/manage/services", icon: ClipboardList },
        { label: "Calendar", href: "/calendar", icon: Calendar },
        { label: "Alerts", href: "/notifications", icon: Bell },
        { label: "Profile", href: "/profile", icon: UserCircle },
      ];
    }
    return [
      { label: "Schedule", href: "/my-schedule", icon: CalendarDays },
      { label: "Calendar", href: "/calendar", icon: Calendar },
      { label: "Notes", href: "/affirmations", icon: Sparkles },
      { label: "Alerts", href: "/notifications", icon: Bell },
      { label: "Profile", href: "/profile", icon: UserCircle },
    ];
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
