"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavEntry, NavItem } from "@/components/layout/nav-config";

const STORAGE_KEY = "dew:sidebar-open-groups";

interface SidebarNavProps {
  entries: NavEntry[];
  /** Called after a link is clicked — used by the mobile drawer to close itself. */
  onNavigate?: () => void;
}

/**
 * Renders the grouped sidebar navigation with collapsible sections.
 *
 * - The group containing the current page auto-expands and stays open.
 * - Manual open/close choices are remembered across navigations (localStorage).
 * - Standalone items render as plain links.
 */
export function SidebarNav({ entries, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  // Which group (if any) holds the page we're currently on.
  const activeGroupId = useMemo(() => {
    for (const entry of entries) {
      if (
        entry.kind === "group" &&
        entry.group.items.some((item) => isActive(item.href))
      ) {
        return entry.group.id;
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, pathname]);

  // Start with the active group open so there's no collapse flash on load.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    activeGroupId ? { [activeGroupId]: true } : {}
  );

  // Restore remembered open/closed state. The active group always wins so it
  // can never be left collapsed underneath the page you're viewing.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setOpenGroups((prev) => ({ ...JSON.parse(raw), ...prev }));
    } catch {
      /* ignore unavailable/invalid storage */
    }
  }, []);

  // Navigating into a collapsed group opens it.
  useEffect(() => {
    if (activeGroupId) {
      setOpenGroups((prev) =>
        prev[activeGroupId] ? prev : { ...prev, [activeGroupId]: true }
      );
    }
  }, [activeGroupId]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore unavailable storage */
      }
      return next;
    });
  };

  return (
    <div className="space-y-1">
      {entries.map((entry) => {
        if (entry.kind === "item") {
          return (
            <NavLink
              key={entry.item.href}
              item={entry.item}
              active={isActive(entry.item.href)}
              onNavigate={onNavigate}
            />
          );
        }

        const { group } = entry;
        const open = !!openGroups[group.id];
        const hasActiveChild = group.items.some((item) => isActive(item.href));

        return (
          <div key={group.id}>
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              aria-expanded={open}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                hasActiveChild
                  ? "text-clay-700"
                  : "text-clay-500 hover:bg-clay-50 hover:text-clay-700",
                hasActiveChild && !open && "bg-clay-50"
              )}
            >
              <group.icon className="h-5 w-5 flex-shrink-0" />
              <span className="flex-1 text-left">{group.label}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 flex-shrink-0 text-clay-400 transition-transform duration-200",
                  !open && "-rotate-90"
                )}
              />
            </button>

            {open && (
              <div className="mt-1 ml-4 space-y-1 border-l border-clay-100 pl-2">
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={isActive(item.href)}
                    onNavigate={onNavigate}
                    nested
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NavLink({
  item,
  active,
  onNavigate,
  nested,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
  nested?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-clay-100 text-clay-700"
          : "text-clay-500 hover:bg-clay-50 hover:text-clay-700"
      )}
    >
      <Icon className={cn("flex-shrink-0", nested ? "h-[18px] w-[18px]" : "h-5 w-5")} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
