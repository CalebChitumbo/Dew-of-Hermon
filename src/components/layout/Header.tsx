"use client";

import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { Button } from "@/components/ui/button";
import { Menu, LogOut } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { hasMinRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Calendar,
  Sparkles,
  Mail,
  Settings,
  Building2,
  UserCircle,
  CalendarDays,
  Bell,
  X,
} from "lucide-react";

export function Header() {
  const { userData, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  if (!userData) return null;

  const handleSignOut = async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    await signOut();
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-clay-200 lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="text-xl">&#x1F3FA;</span>
            <span className="font-display text-sm text-clay-700">
              Potter&apos;s Wheel
            </span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
          </div>
        </div>
      </header>

      {/* Mobile slide-out menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed left-0 top-0 bottom-0 w-72 bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between px-4 border-b border-clay-200">
              <div className="flex items-center gap-2">
                <span className="text-2xl">&#x1F3FA;</span>
                <span className="font-display text-clay-700">
                  Potter&apos;s Wheel
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="p-4 space-y-1">
              {hasMinRole(userData.role, "ADMIN") && (
                <>
                  <MobileMenuItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" pathname={pathname} onClick={() => setMobileMenuOpen(false)} />
                  <MobileMenuItem href="/manage/members" icon={Users} label="Members" pathname={pathname} onClick={() => setMobileMenuOpen(false)} />
                  <MobileMenuItem href="/manage/services" icon={ClipboardList} label="Services & Rotas" pathname={pathname} onClick={() => setMobileMenuOpen(false)} />
                  <MobileMenuItem href="/calendar" icon={Calendar} label="Calendar" pathname={pathname} onClick={() => setMobileMenuOpen(false)} />
                  <MobileMenuItem href="/affirmations" icon={Sparkles} label="Affirmations" pathname={pathname} onClick={() => setMobileMenuOpen(false)} />
                  <MobileMenuItem href="/manage/templates" icon={Mail} label="Templates" pathname={pathname} onClick={() => setMobileMenuOpen(false)} />
                  {userData.role === "SUPER_ADMIN" && (
                    <MobileMenuItem href="/manage/settings" icon={Settings} label="Settings" pathname={pathname} onClick={() => setMobileMenuOpen(false)} />
                  )}
                </>
              )}
              {userData.role === "DEPARTMENT_LEAD" && (
                <>
                  <MobileMenuItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" pathname={pathname} onClick={() => setMobileMenuOpen(false)} />
                  <MobileMenuItem href="/department" icon={Building2} label="My Department" pathname={pathname} onClick={() => setMobileMenuOpen(false)} />
                  <MobileMenuItem href="/manage/services" icon={ClipboardList} label="Services" pathname={pathname} onClick={() => setMobileMenuOpen(false)} />
                  <MobileMenuItem href="/calendar" icon={Calendar} label="Calendar" pathname={pathname} onClick={() => setMobileMenuOpen(false)} />
                  <MobileMenuItem href="/affirmations" icon={Sparkles} label="Affirmations" pathname={pathname} onClick={() => setMobileMenuOpen(false)} />
                </>
              )}
              {(userData.role === "YOUTH_LEADER" || userData.role === "MEMBER") && (
                <>
                  {userData.role === "YOUTH_LEADER" && (
                    <MobileMenuItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" pathname={pathname} onClick={() => setMobileMenuOpen(false)} />
                  )}
                  <MobileMenuItem href="/my-schedule" icon={CalendarDays} label="My Schedule" pathname={pathname} onClick={() => setMobileMenuOpen(false)} />
                  <MobileMenuItem href="/calendar" icon={Calendar} label="Calendar" pathname={pathname} onClick={() => setMobileMenuOpen(false)} />
                  <MobileMenuItem href="/affirmations" icon={Sparkles} label="Affirmations" pathname={pathname} onClick={() => setMobileMenuOpen(false)} />
                </>
              )}
              <MobileMenuItem href="/notifications" icon={Bell} label="Notifications" pathname={pathname} onClick={() => setMobileMenuOpen(false)} />
              <MobileMenuItem href="/profile" icon={UserCircle} label="Profile" pathname={pathname} onClick={() => setMobileMenuOpen(false)} />
            </nav>
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-clay-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/20 text-gold-dark text-sm font-bold">
                  {userData.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-clay-700 truncate">
                    {userData.name}
                  </p>
                  <p className="text-xs text-clay-400">{userData.role.replace("_", " ")}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MobileMenuItem({
  href,
  icon: Icon,
  label,
  pathname,
  onClick,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  pathname: string;
  onClick: () => void;
}) {
  const isActive = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-clay-100 text-clay-700"
          : "text-clay-500 hover:bg-clay-50 hover:text-clay-700"
      )}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}
