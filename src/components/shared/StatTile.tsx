import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { iconTones, type IconTone } from "@/lib/icon-tones";

/**
 * Flat, airy metric tile: a soft-toned icon chip, a small uppercase label, a
 * large display value, and a muted hint. Optionally a link (with a hover
 * arrow). Mirrors the dashboard's "Ministry Pulse" tiles so stats look the
 * same everywhere — minimal border, no heavy shadow.
 */
export function StatTile({
  icon: Icon,
  tone = "gold",
  label,
  value,
  hint,
  href,
  highlight = false,
  className = "",
}: {
  icon: React.ElementType;
  tone?: IconTone;
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  href?: string;
  highlight?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconTones[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </span>
        {highlight && (
          <span
            aria-hidden
            className="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_0_4px_rgba(248,113,113,0.18)]"
          />
        )}
      </div>
      <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-clay-400">
        {label}
      </p>
      <p className="mt-1 text-2xl md:text-[1.7rem] font-display font-bold leading-none text-clay-700">
        {value}
      </p>
      {hint && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-clay-400 group-hover:text-gold-dark transition-colors">
          <span className="truncate">{hint}</span>
          {href && (
            <ArrowRight className="h-3 w-3 shrink-0 opacity-0 -translate-x-1 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
          )}
        </p>
      )}
    </>
  );

  const base =
    "group block rounded-2xl border border-clay-100/70 bg-white/55 p-4 md:p-5 transition-all duration-200";

  return href ? (
    <Link
      href={href}
      className={`${base} hover:bg-white hover:shadow-[0_8px_24px_-16px_rgba(91,58,41,0.18)] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 ${className}`}
    >
      {body}
    </Link>
  ) : (
    <div className={`${base} ${className}`}>{body}</div>
  );
}
