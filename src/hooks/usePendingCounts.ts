"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Fetches the per-area "pending attention" counts for the signed-in user
 * (keyed by sidebar nav pageKey) from /api/pending-counts.
 *
 * Refreshes on mount, on every navigation (so a queue clears as soon as you
 * act on it), when the tab regains focus, and on a slow background poll.
 */
export function usePendingCounts() {
  const { firebaseUser } = useAuth();
  const pathname = usePathname();
  const [counts, setCounts] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    if (!firebaseUser) {
      setCounts({});
      return;
    }
    try {
      const res = await fetch("/api/pending-counts", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setCounts(data.counts || {});
    } catch {
      /* network hiccup — keep the last known counts */
    }
  }, [firebaseUser]);

  // Mount + every navigation.
  useEffect(() => {
    refresh();
  }, [refresh, pathname]);

  // Refresh when the tab regains focus, plus a 60s background poll.
  useEffect(() => {
    if (!firebaseUser) return;
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    const id = window.setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(id);
    };
  }, [firebaseUser, refresh]);

  return { counts };
}
