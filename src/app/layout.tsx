import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { AccessControlProvider } from "@/contexts/AccessControlContext";
import { Toaster } from "@/components/ui/toaster";
import { PushNotificationPrompt } from "@/components/shared/PushNotificationPrompt";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dew of Hermon | Youth Ministry",
  description:
    "Dew of Hermon Youth Ministry — Tabernacle of David Assembly, City Mission Church. Home of the Potter's Wheel Sunday service.",
  icons: {
    icon: "/images/church-logo.svg",
    shortcut: "/images/church-logo.svg",
    apple: "/images/church-logo.svg",
  },
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
          <AccessControlProvider>
            {children}
            <Toaster />
            <PushNotificationPrompt />
          </AccessControlProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
