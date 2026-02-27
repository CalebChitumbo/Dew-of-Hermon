"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvailability } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  ArrowLeft,
  CalendarOff,
  CalendarCheck,
  Trash2,
  Plus,
} from "lucide-react";
import { format, parseISO, isFuture, isPast } from "date-fns";

export default function AvailabilityPage() {
  const { firebaseUser } = useAuth();
  const [availability, setAvailability] = useState<UserAvailability[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;

    const unsub = onSnapshot(
      collection(db, "users", firebaseUser.uid, "availability"),
      (snapshot) => {
        const avail = snapshot.docs.map((d) => ({
          ...d.data(),
          date: d.id,
        })) as UserAvailability[];
        setAvailability(avail.sort((a, b) => a.date.localeCompare(b.date)));
        setLoading(false);
      }
    );

    return () => unsub();
  }, [firebaseUser]);

  const handleAddUnavailable = async () => {
    if (!firebaseUser || !startDate) return;
    setSaving(true);

    try {
      // If only startDate, add single day. If range, add each day in range.
      const start = parseISO(startDate);
      const end = endDate ? parseISO(endDate) : start;
      const current = new Date(start);

      while (current <= end) {
        const dateStr = format(current, "yyyy-MM-dd");
        await setDoc(
          doc(db, "users", firebaseUser.uid, "availability", dateStr),
          {
            available: false,
            reason: reason || null,
            date: dateStr,
          }
        );
        current.setDate(current.getDate() + 1);
      }

      setStartDate("");
      setEndDate("");
      setReason("");
    } catch (error) {
      console.error("Error setting availability:", error);
    }
    setSaving(false);
  };

  const handleRemove = async (date: string) => {
    if (!firebaseUser) return;
    try {
      await deleteDoc(doc(db, "users", firebaseUser.uid, "availability", date));
    } catch (error) {
      console.error("Error removing availability:", error);
    }
  };

  const futureUnavailable = availability
    .filter((a) => !a.available && isFuture(parseISO(a.date)))
    .sort((a, b) => a.date.localeCompare(b.date));

  const pastUnavailable = availability
    .filter((a) => !a.available && isPast(parseISO(a.date)))
    .sort((a, b) => b.date.localeCompare(a.date));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/my-schedule">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-700">
            Set Availability
          </h1>
          <p className="text-clay-500 mt-1">
            Mark dates when you cannot serve so leads can plan accordingly
          </p>
        </div>
      </div>

      {/* Add unavailable dates form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Mark Dates as Unavailable</CardTitle>
          <CardDescription>
            Select a single date or a range of dates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date (optional)</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || format(new Date(), "yyyy-MM-dd")}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              placeholder="e.g., Family commitment, travelling, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
          <Button
            variant="gold"
            onClick={handleAddUnavailable}
            disabled={!startDate || saving}
          >
            {saving ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Add Unavailable Date{endDate ? "s" : ""}
          </Button>
        </CardContent>
      </Card>

      {/* Upcoming unavailable dates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarOff className="h-5 w-5 text-red-500" />
            Upcoming Unavailable Dates
          </CardTitle>
        </CardHeader>
        <CardContent>
          {futureUnavailable.length === 0 ? (
            <div className="flex flex-col items-center py-8">
              <CalendarCheck className="h-10 w-10 text-teal mb-3" />
              <p className="text-clay-500 text-sm">
                You have no upcoming unavailable dates. You are available for
                all upcoming services.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {futureUnavailable.map((item) => (
                <div
                  key={item.date}
                  className="flex items-center justify-between p-3 rounded-md bg-red-50 border border-red-100"
                >
                  <div>
                    <p className="font-medium text-clay-700">
                      {format(parseISO(item.date), "EEEE, MMMM d, yyyy")}
                    </p>
                    {item.reason && (
                      <p className="text-sm text-clay-400 mt-0.5">
                        {item.reason}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(item.date)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past unavailable dates */}
      {pastUnavailable.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-clay-500">
              Past Unavailable Dates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pastUnavailable.slice(0, 10).map((item) => (
                <div
                  key={item.date}
                  className="flex items-center justify-between p-3 rounded-md bg-clay-50"
                >
                  <div>
                    <p className="text-sm text-clay-500">
                      {format(parseISO(item.date), "EEEE, MMMM d, yyyy")}
                    </p>
                    {item.reason && (
                      <p className="text-xs text-clay-400">{item.reason}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
