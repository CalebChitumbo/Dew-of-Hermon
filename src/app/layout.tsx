import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { AccessControlProvider } from "@/contexts/AccessControlContext";
import { CommandPaletteProvider } from "@/components/layout/CommandPalette";
import { Toaster } from "@/components/ui/toaster";
import { PushNotificationPrompt } from "@/components/shared/PushNotificationPrompt";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dew of Hermon | Youth Ministry",
  description:
    "Dew of Hermon Youth Ministry — Tabernacle of David Assembly, City Mission Church. Home of the Potter's Wheel Sunday service.",
  icons: {
    icon: "/images/church-logo.png",
    shortcut: "/images/church-logo.png",
    apple: "/images/church-logo.png",
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
            <CommandPaletteProvider>
              {children}
              <Toaster />
              <PushNotificationPrompt />
            </CommandPaletteProvider>
          </AccessControlProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
