"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A clickable section divider that expands to reveal its contents. Styled to
 * match SectionHeading (an uppercase, letter-spaced label with a trailing
 * hairline rule) but with a chevron and an always-visible count, so a collapsed
 * page still shows how many items sit in each group without opening it.
 *
 * Controlled: the parent owns the open state, which lets a set of these behave
 * as a one-open-at-a-time accordion.
 */
export function CollapsibleSection({
  title,
  count,
  open,
  onToggle,
  children,
  className = "",
}: {
  title: React.ReactNode;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="group flex w-full items-center gap-3 py-1 text-left"
      >
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 text-clay-400 transition-transform group-hover:text-clay-600",
            open && "rotate-90"
          )}
        />
        <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-clay-500 whitespace-nowrap group-hover:text-clay-700">
          {title}
        </h2>
        {typeof count === "number" && count > 0 && (
          <span className="rounded-full bg-clay-100 px-2 py-0.5 text-xs font-medium text-clay-500">
            {count}
          </span>
        )}
        <span className="h-px flex-1 bg-gradient-to-r from-clay-200 to-transparent" />
      </button>
      {open && <div className="pt-4">{children}</div>}
    </div>
  );
}
