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
  // Link the PWA manifest so the app is installable — a prerequisite for web
  // push on iOS Safari (which only allows push from a Home-Screen-installed app).
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icons/icon-192.png",
    // Square opaque icon so iOS shows a proper Home-Screen tile.
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#5B3A29",
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
