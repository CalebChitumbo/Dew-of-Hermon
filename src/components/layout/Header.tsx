"use client";

import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { Button } from "@/components/ui/button";
import { Menu, LogOut, UserCircle, Bell, X, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { roleLabels } from "@/lib/permissions";
import { useNavItems } from "@/components/layout/useNavItems";
import { useCommandPalette } from "@/components/layout/CommandPalette";

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function Header() {
  const { userData, signOut } = useAuth();
  const { sections } = useNavItems();
  const { open: openPalette } = useCommandPalette();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  if (!userData) return null;

  const handleSignOut = async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    await signOut();
  };

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-clay-100 lg:hidden">
        <div className="flex h-14 items-center justify-between px-3">
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
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
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={openPalette}
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </Button>
            <NotificationBell />
          </div>
        </div>
      </header>

      {/* Mobile slide-out menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="fixed inset-0 bg-clay-900/40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed left-0 top-0 bottom-0 flex w-[18rem] flex-col bg-white shadow-xl">
            <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-clay-100 px-4">
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/church-logo.png"
                  alt="Tabernacle of David Assembly"
                  width={45}
                  height={34}
                  className="h-[30px] w-auto"
                />
                <span className="font-display text-clay-700">Dew of Hermon</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Search trigger */}
            <div className="px-3 pt-3">
              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  openPalette();
                }}
                className="flex w-full items-center gap-2 rounded-lg border border-clay-200 bg-cream/50 px-3 py-2 text-sm text-clay-400"
              >
                <Search className="h-4 w-4" />
                <span className="flex-1 text-left">Search pages…</span>
              </button>
            </div>

            <nav className="flex-1 space-y-3 overflow-y-auto p-3">
              {sections.map((section) => (
                <div key={section.key}>
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-clay-400">
                    {section.label}
                  </p>
                  <div className="space-y-0.5">
                    {section.items.map((item) => (
                      <MobileMenuItem
                        key={item.href}
                        href={item.href}
                        icon={item.icon}
                        label={item.label}
                        pathname={pathname}
                        onClick={closeMenu}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {/* Universal shortcuts */}
              <div>
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-clay-400">
                  Account
                </p>
                <div className="space-y-0.5">
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
                </div>
              </div>
            </nav>

            <div className="flex-shrink-0 border-t border-clay-100 bg-white p-4 pb-6">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/20 text-sm font-bold text-gold-dark">
                  {userData.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-clay-700">
                    {userData.name}
                  </p>
                  <p className="truncate text-xs text-clay-400">
                    {roleLabels[userData.role]}
                  </p>
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
  const active = isActivePath(pathname, href);
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
        active
          ? "bg-gold/10 font-semibold text-clay-800"
          : "font-medium text-clay-500 hover:bg-clay-50 hover:text-clay-700"
      )}
    >
      {active && (
        <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-gold" />
      )}
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0",
          active ? "text-gold-dark" : "text-clay-400"
        )}
      />
      {label}
    </Link>
  );
}
