import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/toaster";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Potter's Wheel | Dew of Hermon Youth Ministry",
  description:
    "Ministry management platform for the Potter's Wheel Sunday service at Dew of Hermon Youth Ministry, Tabernacle of David Assembly.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
