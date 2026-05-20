export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-clay-50 via-cream to-clay-100">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-gold/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-clay-300/30 blur-3xl"
      />
      <div className="relative min-h-screen">{children}</div>
    </div>
  );
}
