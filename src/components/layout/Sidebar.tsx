"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { hasMinRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Calendar,
  Sparkles,
  Mail,
  CheckSquare,
  BarChart3,
  Settings,
  Bell,
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
  minRole: "SUPER_ADMIN" | "ADMIN" | "DEPARTMENT_LEAD" | "YOUTH_LEADER" | "MEMBER";
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, minRole: "YOUTH_LEADER" },
  { label: "Departments", href: "/departments", icon: Building2, minRole: "ADMIN" },
  { label: "Members", href: "/manage/members", icon: Users, minRole: "ADMIN" },
  { label: "Services & Rotas", href: "/manage/services", icon: ClipboardList, minRole: "ADMIN" },
  { label: "Calendar", href: "/calendar", icon: Calendar, minRole: "MEMBER" },
  { label: "Create Event", href: "/manage/events/new", icon: CalendarPlus, minRole: "DEPARTMENT_LEAD" },
  { label: "Event Approvals", href: "/manage/events/approvals", icon: ClipboardCheck, minRole: "DEPARTMENT_LEAD" },
  { label: "Campus Ministry", href: "/department/campus-ministry", icon: GraduationCap, minRole: "MEMBER" },
  { label: "Life Groups", href: "/department/life-groups", icon: UsersRound, minRole: "MEMBER" },
  { label: "Discipleship", href: "/department/discipleship", icon: Heart, minRole: "MEMBER" },
  { label: "Affirmations", href: "/affirmations", icon: Sparkles, minRole: "MEMBER" },
  { label: "Templates", href: "/manage/templates", icon: Mail, minRole: "ADMIN" },
  { label: "Reports", href: "/manage/reports", icon: BarChart3, minRole: "ADMIN" },
  { label: "Settings", href: "/manage/settings", icon: Settings, minRole: "SUPER_ADMIN" },
];

const deptLeadItems: NavItem[] = [
  { label: "My Departments", href: "/departments", icon: Building2, minRole: "DEPARTMENT_LEAD" },
  { label: "Members", href: "/manage/members", icon: Users, minRole: "DEPARTMENT_LEAD" },
  { label: "Services", href: "/manage/services", icon: ClipboardList, minRole: "DEPARTMENT_LEAD" },
  { label: "Create Event", href: "/manage/events/new", icon: CalendarPlus, minRole: "DEPARTMENT_LEAD" },
  { label: "Event Approvals", href: "/manage/events/approvals", icon: ClipboardCheck, minRole: "DEPARTMENT_LEAD" },
];

const memberItems: NavItem[] = [
  { label: "My Schedule", href: "/my-schedule", icon: CalendarDays, minRole: "MEMBER" },
  { label: "Calendar", href: "/calendar", icon: Calendar, minRole: "MEMBER" },
  { label: "Affirmations", href: "/affirmations", icon: Sparkles, minRole: "MEMBER" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { userData, signOut } = useAuth();

  if (!userData) return null;

  const getVisibleItems = () => {
    if (hasMinRole(userData.role, "ADMIN")) {
      return navItems.filter((item) => hasMinRole(userData.role, item.minRole));
    }
    if (userData.role === "DEPARTMENT_LEAD") {
      return [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, minRole: "YOUTH_LEADER" as const },
        ...deptLeadItems,
        { label: "Calendar", href: "/calendar", icon: Calendar, minRole: "MEMBER" as const },
        { label: "Affirmations", href: "/affirmations", icon: Sparkles, minRole: "MEMBER" as const },
      ];
    }
    if (userData.role === "YOUTH_LEADER") {
      return [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, minRole: "YOUTH_LEADER" as const },
        { label: "Upcoming Service", href: "/manage/services", icon: ClipboardList, minRole: "YOUTH_LEADER" as const },
        ...memberItems,
      ];
    }
    return memberItems;
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
