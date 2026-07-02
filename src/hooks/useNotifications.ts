"use client";

import { useEffect, useState } from "react";
import { query, where, onSnapshot, orderBy } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Notification } from "@/types";

export function useNotifications() {
  const { firebaseUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    const q = query(
      safeCollection("notifications"),
      where("userId", "==", firebaseUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const notifs = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date(),
          } as Notification;
        });
        setNotifications(notifs);
        setUnreadCount(notifs.filter((n) => !n.isRead).length);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading notifications:", error);
        setLoading(false);
      }
    );

    return unsub;
  }, [firebaseUser]);

  return { notifications, unreadCount, loading };
}
