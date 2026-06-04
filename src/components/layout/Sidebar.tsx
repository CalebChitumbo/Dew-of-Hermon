"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Search, UserCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { roleLabels } from "@/lib/permissions";
import { useNavItems } from "@/components/layout/useNavItems";
import { useCommandPalette } from "@/components/layout/CommandPalette";

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar() {
  const pathname = usePathname();
  const { userData, signOut } = useAuth();
  const { sections } = useNavItems();
  const { open: openPalette } = useCommandPalette();

  if (!userData) return null;

  const handleSignOut = async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    await signOut();
  };

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-clay-200">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5 border-b border-clay-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/church-logo.png"
          alt="Tabernacle of David Assembly — City Mission Church"
          width={52}
          height={40}
          className="h-9 w-auto"
        />
        <div className="min-w-0 leading-tight">
          <p className="font-display text-base text-clay-700 truncate">
            Dew of Hermon
          </p>
          <p className="text-[10px] uppercase tracking-[0.14em] text-clay-400">
            Youth Ministry
          </p>
        </div>
      </div>

      {/* Quick search trigger */}
      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={openPalette}
          className="group flex w-full items-center gap-2 rounded-lg border border-clay-200 bg-cream/50 px-3 py-2 text-sm text-clay-400 transition-colors hover:border-gold/40 hover:bg-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
        >
          <Search className="h-4 w-4 text-clay-400 transition-colors group-hover:text-gold-dark" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded border border-clay-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-clay-400">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-3 px-3 py-4 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.key}>
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-clay-400">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-gold/10 font-semibold text-clay-800"
                        : "font-medium text-clay-500 hover:bg-clay-50 hover:text-clay-700"
                    )}
                  >
                    {active && (
                      <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-gold" />
                    )}
                    <item.icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0 transition-colors",
                        active
                          ? "text-gold-dark"
                          : "text-clay-400 group-hover:text-clay-600"
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-clay-100 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/20 text-sm font-bold text-gold-dark">
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
          <NotificationBell />
        </div>
        <div className="mt-1 flex gap-2">
          <Link href="/profile" className="flex-1">
            <Button variant="ghost" size="sm" className="w-full justify-start">
              <UserCircle className="mr-2 h-4 w-4" />
              Profile
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
