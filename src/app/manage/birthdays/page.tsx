"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useToast } from "@/hooks/use-toast";
import { MONTH_NAMES, ordinal } from "@/lib/birthdays";
import { buildBirthdayListPdf } from "@/lib/birthday-pdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  Cake,
  Gift,
  Download,
  Check,
  Shield,
  CalendarHeart,
} from "lucide-react";

interface BirthdayRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  lifeGroup: string | null;
  dateOfBirth: string | null;
  month: number;
  day: number;
  ageTurning: number | null;
  isToday: boolean;
  wished: boolean;
}

const ALL = "all";

export default function BirthdaysPage() {
  const { userData } = useAuth();
  const { canAccessPage } = usePermissions();
  const { toast } = useToast();

  const currentMonth = new Date().getMonth() + 1;
  const [selectedMonth, setSelectedMonth] = useState<string>(String(currentMonth));
  const [monthRows, setMonthRows] = useState<BirthdayRow[]>([]);
  const [todayRows, setTodayRows] = useState<BirthdayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [broadcast, setBroadcast] = useState(true);

  const hasAccess = !!userData && canAccessPage("birthdays");

  const fetchMonth = useCallback(async () => {
    setLoading(true);
    try {
      const qs = selectedMonth === ALL ? "?scope=all" : `?month=${selectedMonth}`;
      const res = await fetchWithAuth(`/api/birthdays${qs}`);
      if (res.ok) {
        const data = await res.json();
        setMonthRows(data.birthdays || []);
      }
    } catch (err) {
      console.error("Failed to load birthdays:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  const fetchToday = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/api/birthdays?month=${currentMonth}`);
      if (res.ok) {
        const data = await res.json();
        setTodayRows(
          (data.birthdays as BirthdayRow[]).filter((b) => b.isToday)
        );
      }
    } catch (err) {
      console.error("Failed to load today's birthdays:", err);
    }
  }, [currentMonth]);

  useEffect(() => {
    if (!hasAccess) return;
    fetchMonth();
  }, [hasAccess, fetchMonth]);

  useEffect(() => {
    if (!hasAccess) return;
    fetchToday();
  }, [hasAccess, fetchToday]);

  async function handleSend(row: BirthdayRow) {
    setSendingId(row.id);
    try {
      const res = await fetchWithAuth("/api/birthdays/wish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: row.id, broadcast }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send wish");

      toast({
        title: "Birthday wish sent 🎂",
        description: broadcast
          ? `${row.name} was wished, and the whole youth was notified.`
          : `${row.name} received their birthday wish.`,
        variant: "success",
      });

      // Refresh so the "Wished" badge appears everywhere.
      await Promise.all([fetchToday(), fetchMonth()]);
    } catch (error: unknown) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSendingId(null);
    }
  }

  function handleExport() {
    const label =
      selectedMonth === ALL ? "All Birthdays" : MONTH_NAMES[Number(selectedMonth) - 1];
    buildBirthdayListPdf(
      monthRows.map((r) => ({
        name: r.name,
        day: r.day,
        month: r.month,
        ageTurning: r.ageTurning,
        lifeGroup: r.lifeGroup,
        phone: r.phone,
      })),
      label
    );
  }

  const monthLabel = useMemo(
    () =>
      selectedMonth === ALL
        ? "All months"
        : MONTH_NAMES[Number(selectedMonth) - 1],
    [selectedMonth]
  );

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-16 w-16 text-clay-300 mb-4" />
        <h2 className="text-xl font-display font-semibold text-clay-700">
          Access Denied
        </h2>
        <p className="text-clay-500 mt-2">
          You do not have permission to manage birthdays.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-700">
          Birthdays
        </h1>
        <p className="text-clay-500 mt-1">
          Send birthday wishes and prepare the monthly cake list.
        </p>
      </div>

      {/* Today's birthdays */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/15 ring-1 ring-inset ring-gold/20">
              <Cake className="h-4 w-4 text-gold-dark" />
            </span>
            Today&apos;s Birthdays
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Broadcast toggle */}
          <div className="flex items-center justify-between rounded-lg border border-clay-200 bg-clay-50/50 px-4 py-3">
            <div className="min-w-0 pr-3">
              <p className="text-sm font-medium text-clay-700">
                Also notify the whole youth
              </p>
              <p className="text-xs text-clay-400 mt-0.5">
                When on, sending a wish also posts an app notification to every
                member so they can celebrate too.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={broadcast}
              onClick={() => setBroadcast((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                broadcast ? "bg-gold" : "bg-clay-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  broadcast ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {todayRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CalendarHeart className="h-10 w-10 text-clay-300 mb-2" />
              <p className="text-sm text-clay-500">
                No birthdays today. Check the list below for the rest of the
                month.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayRows.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-gold/30 bg-gold/[0.04] px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/20 text-lg">
                      🎂
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-clay-700 truncate">
                        {row.name}
                      </p>
                      <p className="text-xs text-clay-500">
                        {row.ageTurning !== null
                          ? `Turns ${row.ageTurning} today`
                          : "Celebrating today"}
                        {row.lifeGroup ? ` · ${row.lifeGroup}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {row.wished ? (
                      <Badge variant="success" className="gap-1">
                        <Check className="h-3 w-3" />
                        Wish sent
                      </Badge>
                    ) : (
                      <Button
                        variant="gold"
                        size="sm"
                        className="gap-2"
                        disabled={sendingId === row.id}
                        onClick={() => handleSend(row)}
                      >
                        {sendingId === row.id ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <Gift className="h-4 w-4" />
                        )}
                        Send wish
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly list / Cake Sunday */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal/10 ring-1 ring-inset ring-teal/20">
                <CalendarHeart className="h-4 w-4 text-teal" />
              </span>
              Cake Sunday List
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, i) => (
                    <SelectItem key={name} value={String(i + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                  <SelectItem value={ALL}>All months</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleExport}
                disabled={monthRows.length === 0}
              >
                <Download className="h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <LoadingSpinner size="lg" />
            </div>
          ) : monthRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-clay-400">
              No birthdays recorded for {monthLabel}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-clay-200 bg-clay-50/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-clay-500">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-clay-500">
                      Name
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-clay-500">
                      Turns
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-clay-500">
                      Life Group
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-clay-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-clay-100">
                  {monthRows.map((row) => (
                    <tr
                      key={row.id}
                      className={`transition-colors hover:bg-clay-50/50 ${
                        row.isToday ? "bg-gold/[0.05]" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-clay-600">
                        {ordinal(row.day)}
                        {selectedMonth === ALL
                          ? ` ${MONTH_NAMES[row.month - 1].slice(0, 3)}`
                          : ""}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-clay-700">
                          {row.name}
                        </span>
                        {row.isToday && (
                          <Badge variant="gold" className="ml-2 text-[10px]">
                            Today
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-clay-600">
                        {row.ageTurning !== null ? row.ageTurning : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-clay-500">
                        {row.lifeGroup || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {row.wished ? (
                          <Badge variant="success" className="gap-1 text-xs">
                            <Check className="h-3 w-3" />
                            Wished
                          </Badge>
                        ) : (
                          <span className="text-xs text-clay-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
