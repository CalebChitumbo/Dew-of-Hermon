"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { iconTones, toneGlow, type IconTone } from "@/lib/icon-tones";
import { cn } from "@/lib/utils";

/**
 * "Lux" — the premium layer that sits on top of the flat editorial primitives.
 * Warm, spacious cards with soft shadows, rounded corners, icon badges, gentle
 * background ornaments and hover lift. Used across the redesigned admin pages so
 * Services, Calendar, Departments, the request queues, ROPs Camp and
 * Fundraising all share one visual language with the dashboard.
 */

// ─── Soft surface tokens ─────────────────────────────────────────────────────

/** Warm-white card surface with a beige hairline border and a low, warm shadow. */
export const luxSurface =
  "rounded-3xl border border-clay-100/80 bg-white/80 shadow-[0_18px_45px_-32px_rgba(91,58,41,0.40)]";

/** Same surface, but lifts gently on hover for clickable cards. */
export const luxSurfaceHover =
  "transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_26px_60px_-30px_rgba(91,58,41,0.45)]";

// ─── Decorative asset image (graceful fallback) ──────────────────────────────

/**
 * Renders one of the optional dashboard assets. If the file is missing it hides
 * itself, so a page never looks broken before the art is dropped in. Wrap it in
 * a relatively-positioned container and give it absolute classes.
 */
export function DecorImage({
  src,
  className = "",
  alt = "",
}: {
  src: string;
  className?: string;
  alt?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      aria-hidden={alt === ""}
      loading="lazy"
      className={cn("pointer-events-none select-none", className)}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

// ─── Soft wave ornament (inline SVG, always renders) ─────────────────────────

export function SoftWaves({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 160"
      preserveAspectRatio="none"
      aria-hidden
      className={cn("pointer-events-none select-none", className)}
    >
      <path
        d="M0 96 C 120 56 200 136 320 96 S 520 56 600 96 L600 160 L0 160 Z"
        fill="currentColor"
        opacity="0.5"
      />
      <path
        d="M0 120 C 140 84 220 152 340 120 S 520 92 600 120 L600 160 L0 160 Z"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  );
}

/** Faint botanical sprig drawn in code — a calm corner ornament. */
export function BotanicalCorner({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      aria-hidden
      className={cn("pointer-events-none select-none", className)}
      fill="none"
    >
      <path
        d="M104 16 C 70 26 50 52 46 96"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      {[0, 1, 2, 3, 4].map((i) => {
        const t = i / 4;
        const x = 104 - t * 58;
        const y = 16 + t * 80;
        return (
          <g key={i} opacity="0.55">
            <path
              d={`M${x} ${y} q 16 -12 26 -2 q -14 8 -26 2`}
              fill="currentColor"
            />
            <path
              d={`M${x} ${y} q -16 -10 -26 0 q 14 8 26 0`}
              fill="currentColor"
            />
          </g>
        );
      })}
    </svg>
  );
}

// ─── Large soft stat card ────────────────────────────────────────────────────

export function StatCardLux({
  icon: Icon,
  tone = "gold",
  label,
  value,
  hint,
  accent,
  art,
  href,
  highlight = false,
  className = "",
}: {
  icon: React.ElementType;
  tone?: IconTone;
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** Tailwind bg-* class for the coloured bottom accent line. */
  accent?: string;
  /** Faint background artwork (e.g. an outline icon) rendered in the corner. */
  art?: React.ReactNode;
  href?: string;
  highlight?: boolean;
  className?: string;
}) {
  const body = (
    <>
      {art && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-3 -top-3 text-clay-200/50"
        >
          {art}
        </span>
      )}
      <div className="relative flex items-center justify-between">
        <span
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ring-inset ring-white/50 shadow-sm",
            iconTones[tone]
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        {highlight && (
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-full bg-red-400 shadow-[0_0_0_5px_rgba(248,113,113,0.18)] animate-pulse"
          />
        )}
      </div>
      <p className="relative mt-5 text-[11px] font-medium uppercase tracking-[0.16em] text-clay-400">
        {label}
      </p>
      <p className="relative mt-1.5 font-display text-3xl md:text-[2.1rem] font-bold leading-none text-clay-700">
        {value}
      </p>
      {hint && (
        <p className="relative mt-2.5 inline-flex items-center gap-1 text-xs text-clay-400 group-hover:text-gold-dark transition-colors">
          <span className="truncate">{hint}</span>
          {href && (
            <ArrowRight className="h-3 w-3 shrink-0 opacity-0 -translate-x-1 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
          )}
        </p>
      )}
      {accent && (
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-0 bottom-0 h-1.5 rounded-b-3xl",
            accent
          )}
        />
      )}
    </>
  );

  const base = cn(
    "group relative overflow-hidden p-5 md:p-6",
    luxSurface,
    className
  );

  return href ? (
    <Link
      href={href}
      className={cn(
        base,
        luxSurfaceHover,
        "block focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}

// ─── Connected stat strip (one rounded card, divided) ────────────────────────

export interface StripItem {
  icon: React.ElementType;
  tone?: IconTone;
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  href?: string;
  highlight?: boolean;
}

export function StatStripLux({
  items,
  className = "",
}: {
  items: StripItem[];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={cn("overflow-hidden", luxSurface, className)}>
      <div className="flex flex-col divide-y divide-clay-100/80 sm:grid sm:grid-cols-2 sm:divide-y-0 lg:flex lg:flex-row">
        {items.map((it, i) => {
          const Icon = it.icon;
          const inner = (
            <>
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ring-inset ring-white/50",
                    iconTones[it.tone ?? "gold"]
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {it.highlight && (
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_0_4px_rgba(248,113,113,0.18)] animate-pulse"
                  />
                )}
              </div>
              <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-clay-400">
                {it.label}
              </p>
              <p className="mt-1 font-display text-[1.7rem] font-bold leading-none text-clay-700">
                {it.value}
              </p>
              {it.hint && (
                <p className="mt-2 inline-flex items-center gap-1 text-xs text-clay-400 group-hover:text-gold-dark transition-colors">
                  <span className="truncate">{it.hint}</span>
                  {it.href && (
                    <ArrowRight className="h-3 w-3 shrink-0 opacity-0 -translate-x-1 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  )}
                </p>
              )}
            </>
          );

          const cellClass =
            "group relative min-w-0 flex-1 p-5 md:p-6 lg:border-l lg:border-clay-100/80 lg:first:border-l-0 sm:[&:nth-child(odd)]:border-r sm:[&:nth-child(odd)]:border-clay-100/80 lg:[&:nth-child(odd)]:border-r-0";

          return it.href ? (
            <Link
              key={i}
              href={it.href}
              className={cn(
                cellClass,
                "transition-colors hover:bg-cream/50 focus:outline-none focus-visible:bg-cream/60"
              )}
            >
              {inner}
            </Link>
          ) : (
            <div key={i} className={cellClass}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Segmented control (built on Radix Tabs) ─────────────────────────────────

export function SegmentedTabsList({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <TabsList
      className={cn(
        "flex h-auto w-full flex-wrap items-stretch justify-start gap-1.5 rounded-2xl border border-clay-100/80 bg-cream/70 p-1.5 text-clay-500 shadow-[inset_0_1px_2px_rgba(91,58,41,0.05)]",
        className
      )}
    >
      {children}
    </TabsList>
  );
}

export function SegmentedTab({
  value,
  icon: Icon,
  count,
  underline = false,
  className = "",
  children,
}: {
  value: string;
  icon?: React.ElementType;
  count?: number;
  /** Show a gold underline accent under the active tab. */
  underline?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        "group relative flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-transparent px-3 py-2.5 text-xs font-medium text-clay-500 transition-all",
        "data-[state=active]:border-gold/35 data-[state=active]:bg-white data-[state=active]:text-clay-700 data-[state=active]:shadow-[0_10px_24px_-18px_rgba(91,58,41,0.55)]",
        "hover:text-clay-700 sm:text-sm",
        className
      )}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      <span className="truncate">{children}</span>
      {count != null && count > 0 && (
        <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-clay-100 px-1.5 text-[11px] font-semibold text-clay-500 group-data-[state=active]:bg-gold/15 group-data-[state=active]:text-gold-dark">
          {count}
        </span>
      )}
      {underline && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-4 bottom-1 h-0.5 rounded-full bg-gold opacity-0 transition-opacity group-data-[state=active]:opacity-100"
        />
      )}
    </TabsTrigger>
  );
}

// ─── Premium empty state (soft glow + illustration) ──────────────────────────

export function EmptyStateLux({
  illustration,
  icon: Icon,
  tone = "sage",
  title,
  description,
  action,
  note,
  className = "",
}: {
  /** A bespoke SVG scene. Falls back to the icon chip if omitted. */
  illustration?: React.ReactNode;
  icon?: React.ElementType;
  tone?: IconTone;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** A reassuring footnote panel under the action. */
  note?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-14 text-center sm:py-16",
        className
      )}
    >
      <div className="relative mb-7 flex items-center justify-center">
        <span
          aria-hidden
          className={cn(
            "absolute h-40 w-40 rounded-full opacity-[0.14] blur-3xl",
            toneGlow[tone]
          )}
        />
        <span
          aria-hidden
          className={cn(
            "absolute h-28 w-28 rounded-full opacity-[0.10] blur-xl",
            toneGlow[tone]
          )}
        />
        {illustration ? (
          <div className="relative">{illustration}</div>
        ) : Icon ? (
          <span
            className={cn(
              "relative flex h-20 w-20 items-center justify-center rounded-3xl ring-1 ring-inset ring-white/50 shadow-sm",
              iconTones[tone]
            )}
          >
            <Icon className="h-9 w-9" />
          </span>
        ) : null}
      </div>
      <h3 className="font-display text-xl font-bold text-clay-700 sm:text-2xl">
        {title}
      </h3>
      {description && (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-clay-500">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
      {note && (
        <div className="mt-7 flex max-w-md items-start gap-2.5 rounded-2xl border border-clay-100/80 bg-cream/60 px-4 py-3 text-left text-xs leading-relaxed text-clay-500">
          {note}
        </div>
      )}
    </div>
  );
}

// ─── Section heading with icon badge ─────────────────────────────────────────

export function SectionHeadingLux({
  icon: Icon,
  tone = "gold",
  title,
  subtitle,
  actions,
  className = "",
}: {
  icon?: React.ElementType;
  tone?: IconTone;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {Icon && (
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
            iconTones[tone]
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0">
        <h2 className="font-display text-lg font-semibold leading-tight text-clay-700">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-clay-400">{subtitle}</p>
        )}
      </div>
      <span className="mx-1 hidden h-px flex-1 bg-gradient-to-r from-clay-200/80 to-transparent sm:block" />
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
