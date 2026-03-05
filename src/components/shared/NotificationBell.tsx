"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function NotificationBell() {
  const { firebaseUser } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!firebaseUser) return;

    try {
      const q = query(
        collection(db, "notifications"),
        where("userId", "==", firebaseUser.uid),
        where("isRead", "==", false)
      );

      const unsub = onSnapshot(q, (snapshot) => {
        setUnreadCount(snapshot.size);
      });

      return unsub;
    } catch (err) {
      console.error("NotificationBell: failed to subscribe", err);
    }
  }, [firebaseUser]);

  return (
    <Link href="/notifications">
      <Button variant="ghost" size="icon" className="relative">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>
    </Link>
  );
}
