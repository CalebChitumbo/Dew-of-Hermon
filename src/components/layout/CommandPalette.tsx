"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
} from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search, CornerDownLeft, Bell, UserCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { roleLabels } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useNavItems } from "./useNavItems";

// ─── Context ─────────────────────────────────────────────────────────────

interface CommandPaletteContextValue {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: boolean;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue>({
  open: () => {},
  close: () => {},
  toggle: () => {},
  isOpen: false,
});

export const useCommandPalette = () => useContext(CommandPaletteContext);

export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((o) => !o), []);

  // Global ⌘K / Ctrl+K shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <CommandPaletteContext.Provider value={{ open, close, toggle, isOpen }}>
      {children}
      <CommandPaletteHost isOpen={isOpen} onOpenChange={setIsOpen} />
    </CommandPaletteContext.Provider>
  );
}

/**
 * Only mounts the data-bound palette (and the access hooks it relies on) once
 * a user is signed in, so the global shortcut stays a no-op on auth pages.
 */
function CommandPaletteHost({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { userData } = useAuth();
  if (!userData) return null;
  return <CommandPalette isOpen={isOpen} onOpenChange={onOpenChange} />;
}

// ─── Palette ─────────────────────────────────────────────────────────────

interface CommandEntry {
  label: string;
  href: string;
  icon: ElementType;
  description?: string;
  sectionLabel: string;
}

function CommandPalette({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { userData } = useAuth();
  const { sections } = useNavItems();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Build the searchable entry groups: nav sections plus universal actions.
  const groups = useMemo(() => {
    const navGroups = sections.map((s) => ({
      label: s.label,
      entries: s.items.map<CommandEntry>((it) => ({
        label: it.label,
        href: it.href,
        icon: it.icon,
        description: it.description,
        sectionLabel: s.label,
      })),
    }));
    const quickActions: CommandEntry[] = [
      {
        label: "Notifications",
        href: "/notifications",
        icon: Bell,
        description: "Your recent alerts",
        sectionLabel: "Quick actions",
      },
      {
        label: "Profile",
        href: "/profile",
        icon: UserCircle,
        description: "Your account & details",
        sectionLabel: "Quick actions",
      },
    ];
    return [...navGroups, { label: "Quick actions", entries: quickActions }];
  }, [sections]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        label: g.label,
        entries: g.entries.filter((e) =>
          `${e.label} ${e.description ?? ""} ${e.sectionLabel}`
            .toLowerCase()
            .includes(q)
        ),
      }))
      .filter((g) => g.entries.length > 0);
  }, [groups, query]);

  // Flat list mirrors render order so arrow keys move through every result.
  const flatEntries = useMemo(
    () => filteredGroups.flatMap((g) => g.entries),
    [filteredGroups]
  );

  // Reset the cursor whenever the result set changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Clear the query each time the palette opens.
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [isOpen]);

  // Keep the highlighted row in view as you arrow through.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-cmd-index="${activeIndex}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const go = useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, flatEntries.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const entry = flatEntries[activeIndex];
      if (entry) go(entry.href);
    }
  };

  // Running counter so each rendered row knows its flat index.
  let runningIndex = -1;

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-clay-900/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onKeyDown={onKeyDown}
          className="fixed left-1/2 top-[12vh] z-[80] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-clay-200 bg-white shadow-[0_24px_60px_-24px_rgba(91,58,41,0.45)] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2"
        >
          <DialogPrimitive.Title className="sr-only">
            Search and jump to a page
          </DialogPrimitive.Title>

          {/* Search field */}
          <div className="flex items-center gap-3 border-b border-clay-100 px-4">
            <Search className="h-4 w-4 shrink-0 text-clay-400" />
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages and actions…"
              className="h-12 flex-1 bg-transparent text-sm text-clay-700 placeholder:text-clay-400 focus:outline-none"
            />
            <kbd className="hidden shrink-0 rounded border border-clay-200 bg-cream px-1.5 py-0.5 text-[10px] font-medium text-clay-400 sm:inline-block">
              Esc
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[min(60vh,22rem)] overflow-y-auto p-2">
            {filteredGroups.length === 0 ? (
              <div className="px-3 py-10 text-center">
                <p className="text-sm text-clay-500">
                  No matches for{" "}
                  <span className="font-medium text-clay-700">
                    &ldquo;{query}&rdquo;
                  </span>
                </p>
                <p className="mt-1 text-xs text-clay-400">
                  Try a page name like &ldquo;members&rdquo; or
                  &ldquo;approvals&rdquo;.
                </p>
              </div>
            ) : (
              filteredGroups.map((group) => (
                <div key={group.label} className="mb-1.5 last:mb-0">
                  <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-clay-400">
                    {group.label}
                  </p>
                  {group.entries.map((entry) => {
                    runningIndex += 1;
                    const index = runningIndex;
                    const isActive = index === activeIndex;
                    const Icon = entry.icon;
                    return (
                      <button
                        key={`${group.label}-${entry.href}`}
                        type="button"
                        data-cmd-index={index}
                        onMouseMove={() => setActiveIndex(index)}
                        onClick={() => go(entry.href)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                          isActive ? "bg-gold/10" : "hover:bg-clay-50"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset transition-colors",
                            isActive
                              ? "bg-gold/15 text-gold-dark ring-gold/20"
                              : "bg-clay-50 text-clay-500 ring-clay-100"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-clay-700">
                            {entry.label}
                          </span>
                          {entry.description && (
                            <span className="block truncate text-xs text-clay-400">
                              {entry.description}
                            </span>
                          )}
                        </span>
                        {isActive && (
                          <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-gold-dark" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer hint */}
          <div className="flex items-center justify-between gap-2 border-t border-clay-100 bg-cream/60 px-4 py-2 text-[11px] text-clay-400">
            <span className="inline-flex items-center gap-1.5">
              <kbd className="rounded border border-clay-200 bg-white px-1 py-0.5">
                ↑
              </kbd>
              <kbd className="rounded border border-clay-200 bg-white px-1 py-0.5">
                ↓
              </kbd>
              to navigate
              <kbd className="ml-1 rounded border border-clay-200 bg-white px-1 py-0.5">
                ↵
              </kbd>
              to open
            </span>
            {userData && (
              <span className="hidden truncate sm:inline">
                Signed in as {roleLabels[userData.role]}
              </span>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
