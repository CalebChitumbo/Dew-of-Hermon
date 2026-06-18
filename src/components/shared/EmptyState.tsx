import { iconTones, type IconTone } from "@/lib/icon-tones";

/**
 * Calm, editorial empty state — a soft-toned icon chip, a display title, a
 * muted line of guidance, and optional action. Replaces the heavier
 * bordered-card empty states so blank views feel intentional, not broken.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  tone = "clay",
  action,
  className = "",
}: {
  icon: React.ElementType;
  title: React.ReactNode;
  description?: React.ReactNode;
  tone?: IconTone;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 text-center ${className}`}
    >
      <span
        className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${iconTones[tone]}`}
      >
        <Icon className="h-7 w-7" />
      </span>
      <h3 className="text-lg font-display font-semibold text-clay-600">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-clay-400">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
