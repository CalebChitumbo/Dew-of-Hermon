"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  requestPushPermissionAndToken,
  onForegroundMessage,
  type PushPermissionFailureReason,
} from "@/lib/fcm";
import { useToast } from "@/hooks/use-toast";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";

function failureMessage(reason: PushPermissionFailureReason): {
  title: string;
  description: string;
} {
  switch (reason) {
    case "denied":
      return {
        title: "Notifications blocked",
        description:
          "Notifications are blocked for this site. Enable them in your browser's site settings, then try again.",
      };
    case "dismissed":
      return {
        title: "Permission needed",
        description:
          'Click "Enable" again and choose "Allow" on the browser prompt to receive push alerts.',
      };
    case "unsupported":
      return {
        title: "Not supported on this browser",
        description:
          "Your browser doesn't support web push notifications. Try a recent version of Chrome, Edge, Firefox, or Safari 16.4+.",
      };
    case "sw_failed":
      return {
        title: "Couldn't enable notifications",
        description:
          "We couldn't register the background service. Please reload the page and try again.",
      };
    case "config_missing":
      return {
        title: "Notifications unavailable",
        description:
          "Push notifications aren't fully configured for this app. Please contact support.",
      };
    case "token_failed":
      return {
        title: "Couldn't enable notifications",
        description:
          "We couldn't register your device with the notification service. Please try again in a moment.",
      };
  }
}

/**
 * Shows a non-intrusive banner prompting the user to enable push notifications.
 * Also sets up the foreground message listener so in-app toasts appear for
 * push messages received while the app is open.
 */
export function PushNotificationPrompt() {
  const { firebaseUser, userData } = useAuth();
  const { toast } = useToast();
  const [showBanner, setShowBanner] = useState(false);
  const [requesting, setRequesting] = useState(false);

  // Determine whether to show the prompt
  useEffect(() => {
    if (!firebaseUser || !userData) return;
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;

    // Don't show if already granted or denied
    if (Notification.permission !== "default") return;

    // Don't show if the user already dismissed this session
    const dismissed = sessionStorage.getItem("push-prompt-dismissed");
    if (dismissed) return;

    // Show the banner after a short delay so it doesn't interrupt page load
    const timer = setTimeout(() => setShowBanner(true), 3000);
    return () => clearTimeout(timer);
  }, [firebaseUser, userData]);

  // Set up foreground message listener
  useEffect(() => {
    if (!firebaseUser) return;
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    let unsub: (() => void) | null = null;
    try {
      unsub = onForegroundMessage((payload) => {
        toast({
          title: payload.title,
          description: payload.body,
        });
      });
    } catch {
      // Firebase Messaging not supported on this browser — silently skip.
    }

    return () => {
      unsub?.();
    };
  }, [firebaseUser, toast]);

  const handleEnable = async () => {
    if (!firebaseUser) return;
    setRequesting(true);
    try {
      const result = await requestPushPermissionAndToken(firebaseUser.uid);
      if (result.ok) {
        toast({
          title: "Notifications enabled",
          description: "You'll now receive push notifications for service reminders and assignments.",
        });
        setShowBanner(false);
      } else {
        const { title, description } = failureMessage(result.reason);
        toast({ title, description, variant: "destructive" });
        // Keep the banner open so the user can retry after a transient failure,
        // but hide it on terminal failures (denied / unsupported) where retrying
        // from this UI won't help.
        if (
          result.reason === "denied" ||
          result.reason === "unsupported" ||
          result.reason === "config_missing"
        ) {
          setShowBanner(false);
        }
      }
    } catch (error) {
      console.error("Push registration failed:", error);
      toast({
        title: "Something went wrong",
        description: "Could not enable notifications. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setRequesting(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem("push-prompt-dismissed", "1");
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-lg border border-clay-200 bg-white p-4 shadow-lg sm:left-auto sm:right-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50">
          <Bell className="h-5 w-5 text-teal-600" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-clay-800">
            Enable push notifications?
          </p>
          <p className="mt-1 text-sm text-clay-600">
            Get notified about service assignments, reminders, and announcements
            even when the app is closed.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={handleEnable}
              disabled={requesting}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {requesting ? "Enabling..." : "Enable"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              disabled={requesting}
            >
              Not now
            </Button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 text-clay-400 hover:text-clay-600"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
