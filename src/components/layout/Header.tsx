"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { Button } from "@/components/ui/button";
import { Menu, LogOut, UserCircle, Bell, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getVisibleNavItems } from "@/components/layout/nav-config";
import { useCampLeadAccess } from "@/hooks/useCampLeadAccess";
import { useFundraisingAccess } from "@/hooks/useFundraisingAccess";
import { useTransportAccess } from "@/hooks/useTransportAccess";

export function Header() {
  const { userData, signOut } = useAuth();
  const { pagePermissions } = useAccessControl();
  const { canManage: canManageCamp } = useCampLeadAccess();
  const { canPlanBraai } = useFundraisingAccess();
  const { canManageTransport, canApproveAccounts } = useTransportAccess();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  if (!userData) return null;

  const extraKeys: string[] = [];
  if (canManageCamp) extraKeys.push("rops_camp");
  if (canPlanBraai) extraKeys.push("fundraising");
  if (canManageTransport) extraKeys.push("transport_requests");
  if (canApproveAccounts) extraKeys.push("accounts_approvals");
  const visibleItems = getVisibleNavItems(userData.role, pagePermissions, extraKeys);

  const handleSignOut = async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    await signOut();
  };

  const closeMenu = () => setMobileMenuOpen(false);

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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/church-logo.png"
              alt="Tabernacle of David Assembly"
              width={37}
              height={28}
              className="h-7 w-auto"
            />
            <span className="font-display text-sm text-clay-700">
              Dew of Hermon
            </span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
          </div>
        </div>
      </header>

      {/* Mobile slide-out menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed left-0 top-0 bottom-0 w-72 bg-white shadow-xl flex flex-col">
            <div className="flex h-14 items-center justify-between px-4 border-b border-clay-200 flex-shrink-0">
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/church-logo.png"
                  alt="Tabernacle of David Assembly"
                  width={45}
                  height={34}
                  className="h-[34px] w-auto"
                />
                <span className="font-display text-clay-700">
                  Dew of Hermon
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
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {visibleItems.map((item) => (
                <MobileMenuItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  pathname={pathname}
                  onClick={closeMenu}
                />
              ))}
              {/* Mobile-only shortcuts — same for every account type */}
              <MobileMenuItem
                href="/notifications"
                icon={Bell}
                label="Notifications"
                pathname={pathname}
                onClick={closeMenu}
              />
              <MobileMenuItem
                href="/profile"
                icon={UserCircle}
                label="Profile"
                pathname={pathname}
                onClick={closeMenu}
              />
            </nav>
            <div className="flex-shrink-0 p-4 pb-6 border-t border-clay-200 bg-white">
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
