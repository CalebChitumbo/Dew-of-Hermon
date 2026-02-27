export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-clay-50 via-cream to-clay-100 p-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
