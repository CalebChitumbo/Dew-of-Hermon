"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Notification } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Calendar,
  Users,
  Megaphone,
  CheckCheck,
  Inbox,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, isToday, isYesterday, format } from "date-fns";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

// ─── Notification type configuration ───

const NOTIFICATION_ICON: Record<
  Notification["type"],
  { icon: typeof Bell; className: string }
> = {
  reminder: {
    icon: Clock,
    className: "bg-[#C8963E]/10 text-[#C8963E]",
  },
  assignment: {
    icon: Users,
    className: "bg-blue-50 text-blue-600",
  },
  event: {
    icon: Calendar,
    className: "bg-green-50 text-green-600",
  },
  announcement: {
    icon: Megaphone,
    className: "bg-purple-50 text-purple-600",
  },
};

// ─── Helper to parse Firestore timestamps ───

function parseFirestoreDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (val && typeof val === "object" && "seconds" in val) {
    return new Date((val as { seconds: number }).seconds * 1000);
  }
  return new Date();
}

// ─── Group notifications by date ───

interface GroupedNotifications {
  label: string;
  notifications: Notification[];
}

function groupNotificationsByDate(
  notifications: Notification[]
): GroupedNotifications[] {
  const groups: Record<string, Notification[]> = {};

  for (const notification of notifications) {
    const date = notification.createdAt;
    let label: string;

    if (isToday(date)) {
      label = "Today";
    } else if (isYesterday(date)) {
      label = "Yesterday";
    } else {
      label = "Earlier";
    }

    if (!groups[label]) {
      groups[label] = [];
    }
    groups[label].push(notification);
  }

  // Maintain consistent order: Today > Yesterday > Earlier
  const orderedLabels = ["Today", "Yesterday", "Earlier"];
  return orderedLabels
    .filter((label) => groups[label] && groups[label].length > 0)
    .map((label) => ({
      label,
      notifications: groups[label],
    }));
}

export default function NotificationsPage() {
  const { firebaseUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Real-time listener for notifications ───

  useEffect(() => {
    if (!firebaseUser) return;

    const notificationsRef = collection(db, "notifications");
    const q = query(
      notificationsRef,
      where("userId", "==", firebaseUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: Notification[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            userId: data.userId,
            title: data.title,
            message: data.message,
            type: data.type as Notification["type"],
            isRead: data.isRead ?? false,
            link: data.link || null,
            createdAt: parseFirestoreDate(data.createdAt),
          };
        });
        setNotifications(fetched);
        setLoading(false);
      },
      (error) => {
        console.error("Failed to listen to notifications:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firebaseUser]);

  // ─── Mark a single notification as read ───

  async function markAsRead(notificationId: string) {
    try {
      const notifRef = doc(db, "notifications", notificationId);
      await updateDoc(notifRef, { isRead: true });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  }

  // ─── Mark all notifications as read ───

  async function markAllAsRead() {
    if (!firebaseUser) return;

    try {
      const unreadNotifications = notifications.filter((n) => !n.isRead);
      if (unreadNotifications.length === 0) return;

      const batch = writeBatch(db);
      for (const notif of unreadNotifications) {
        const notifRef = doc(db, "notifications", notif.id);
        batch.update(notifRef, { isRead: true });
      }
      await batch.commit();
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  }

  // ─── Derived values ───

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const grouped = groupNotificationsByDate(notifications);

  // ─── Handle notification click ───

  function handleNotificationClick(notification: Notification) {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      window.location.href = notification.link;
    }
  }

  // ─── Render ───

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-900">
            Notifications
          </h1>
          <p className="text-sm text-clay-500 mt-1">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
              : "You're all caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            onClick={markAllAsRead}
            className="gap-2"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* Empty state */}
      {!loading && notifications.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-clay-100 flex items-center justify-center mb-4">
              <Inbox className="h-8 w-8 text-clay-400" />
            </div>
            <h3 className="font-display font-semibold text-clay-700 mb-1">
              No notifications yet
            </h3>
            <p className="text-sm text-clay-500 max-w-sm mx-auto">
              When you receive reminders, assignments, or announcements, they
              will appear here.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Grouped notification list */}
      {!loading &&
        grouped.map((group) => (
          <div key={group.label} className="space-y-2">
            <h2 className="text-sm font-semibold text-clay-500 uppercase tracking-wider px-1">
              {group.label}
            </h2>
            <div className="space-y-2">
              {group.notifications.map((notification) => {
                const typeConfig =
                  NOTIFICATION_ICON[notification.type] || NOTIFICATION_ICON.reminder;
                const IconComponent = typeConfig.icon;

                return (
                  <Card
                    key={notification.id}
                    className={cn(
                      "transition-colors cursor-pointer hover:shadow-md",
                      !notification.isRead && "border-l-4 border-l-[#C8963E] bg-[#C8963E]/[0.03]"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div
                          className={cn(
                            "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                            typeConfig.className
                          )}
                        >
                          <IconComponent className="h-5 w-5" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p
                                className={cn(
                                  "text-sm truncate",
                                  !notification.isRead
                                    ? "font-semibold text-clay-900"
                                    : "font-medium text-clay-700"
                                )}
                              >
                                {notification.title}
                              </p>
                              <p className="text-sm text-clay-500 mt-0.5 line-clamp-2">
                                {notification.message}
                              </p>
                            </div>

                            <div className="flex-shrink-0 flex items-center gap-2">
                              {!notification.isRead && (
                                <span className="w-2 h-2 rounded-full bg-[#C8963E]" />
                              )}
                            </div>
                          </div>

                          {/* Time + type badge */}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-clay-400">
                              {formatDistanceToNow(notification.createdAt, {
                                addSuffix: true,
                              })}
                            </span>
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0"
                            >
                              {notification.type}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
