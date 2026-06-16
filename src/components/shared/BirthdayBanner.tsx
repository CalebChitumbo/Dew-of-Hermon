"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cake, Gift } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Button } from "@/components/ui/button";

interface TodayBirthday {
  id: string;
  name: string;
  ageTurning: number | null;
}

/** First name only, for friendly celebration copy. */
function firstName(name: string): string {
  return name.split(" ")[0] || name;
}

function celebrants(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} others`;
}

/**
 * Celebratory banner that only appears on the dashboard when one or more active
 * members have a birthday today. Everyone sees the celebration; leaders who can
 * manage birthdays also get a shortcut to send the wishes.
 */
export function BirthdayBanner() {
  const { firebaseUser } = useAuth();
  const { canAccessPage } = usePermissions();
  const [birthdays, setBirthdays] = useState<TodayBirthday[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithAuth("/api/birthdays/today");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setBirthdays(data.birthdays || []);
      } catch {
        // Non-critical — just don't show the banner.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [firebaseUser]);

  if (!loaded || birthdays.length === 0) return null;

  const names = birthdays.map((b) => firstName(b.name));
  const canManage = canAccessPage("birthdays");

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-gold/30 px-5 py-4 md:px-6 md:py-5"
      style={{
        backgroundImage:
          "linear-gradient(105deg, #FFF7E8 0%, #FBEFD2 55%, #F6E2BE 100%)",
      }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4 min-w-0">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/70 ring-1 ring-inset ring-gold/30 text-2xl">
            🎂
          </span>
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-gold-dark/80 font-medium">
              <Cake className="h-3 w-3" />
              {birthdays.length === 1 ? "Birthday today" : "Birthdays today"}
            </p>
            <h2 className="text-lg md:text-xl font-display font-bold text-clay-700 mt-1 leading-snug">
              Today we celebrate {celebrants(names)}! 🎉
            </h2>
            <p className="text-sm text-clay-600 mt-0.5">
              {birthdays.length === 1
                ? "Wish them a happy birthday."
                : "Wish them all a happy birthday."}
            </p>
          </div>
        </div>

        {canManage && (
          <Link href="/manage/birthdays" className="shrink-0">
            <Button variant="gold" size="sm" className="gap-2 shadow-sm">
              <Gift className="h-4 w-4" />
              Send a wish
            </Button>
          </Link>
        )}
      </div>
    </section>
  );
}
