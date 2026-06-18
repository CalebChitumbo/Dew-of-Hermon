import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { iconTones, type IconTone } from "@/lib/icon-tones";

/**
 * Standard page header used across the app — a back affordance, an optional
 * soft-toned icon chip, an editorial display title, and a muted description,
 * with room for actions on the right. Keeps headings consistent and flat
 * (no card, no shadow) in line with the dashboard's editorial style.
 */
export function PageHeader({
  title,
  description,
  backHref,
  icon: Icon,
  tone = "gold",
  actions,
  className = "",
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  backHref?: string;
  icon?: React.ElementType;
  tone?: IconTone;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      {backHref && (
        <Link href={backHref} className="shrink-0">
          <Button variant="ghost" size="icon" className="-ml-2 mt-0.5">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
      )}
      {Icon && (
        <span
          className={`hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl sm:flex ${iconTones[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-700 leading-tight">
          {title}
        </h1>
        {description && (
          <p className="text-clay-500 mt-1 leading-relaxed">{description}</p>
        )}
      </div>
      {actions && (
        <div className="shrink-0 flex flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
