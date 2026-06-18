/**
 * A lightweight section divider: a small uppercase, letter-spaced label with a
 * hairline gradient rule trailing off to the right. Communicates hierarchy
 * through typography and whitespace rather than card depth.
 */
export function SectionHeading({
  children,
  actions,
  className = "",
}: {
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-baseline gap-3 ${className}`}>
      <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-clay-500 whitespace-nowrap">
        {children}
      </h2>
      <span className="h-px flex-1 bg-gradient-to-r from-clay-200 to-transparent" />
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
