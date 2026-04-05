import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { AccessControlProvider } from "@/contexts/AccessControlContext";
import { Toaster } from "@/components/ui/toaster";
import { PushNotificationPrompt } from "@/components/shared/PushNotificationPrompt";

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
