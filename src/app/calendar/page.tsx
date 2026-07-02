"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  startOfWeek,
  endOfWeek,
  isToday,
} from "date-fns";
import {
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
  limit as fsLimit,
} from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { mapEventDoc } from "@/lib/event-mapper";
import { useAuth } from "@/contexts/AuthContext";
import { canCreateEvents, hasMinRole } from "@/lib/permissions";
import { AppEvent, EventType, LifeGroup } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  MapPin,
  Clock,
  CalendarDays,
  Users,
  CalendarRange,
  CalendarCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyStateLux, luxSurface, luxSurfaceHover } from "@/components/shared/lux";

// ─── Life Group badge configuration ───

const LIFE_GROUP_CONFIG: Record<LifeGroup | "ALL", { label: string; badgeClass: string }> = {
  BRIDGE: { label: "Bridge", badgeClass: "bg-blue-100 text-blue-700 border-blue-200" },
  ANCHOR: { label: "Anchor", badgeClass: "bg-green-100 text-green-700 border-green-200" },
  CORNERSTONE: { label: "Cornerstone", badgeClass: "bg-purple-100 text-purple-700 border-purple-200" },
  ALL: { label: "All Life Groups", badgeClass: "bg-yellow-100 text-yellow-700 border-yellow-200" },
};

// ─── Event type configuration ───

const EVENT_TYPE_CONFIG: Record<
  EventType,
  { label: string; dotColor: string; badgeClass: string; pillClass: string }
> = {
  POTTERS_WHEEL_SERVICE: {
    label: "Potter's Wheel Service",
    dotColor: "bg-[#C8963E]",
    badgeClass: "bg-[#C8963E]/20 text-[#C8963E] border-transparent",
    pillClass: "bg-gold/12 text-gold-dark",
  },
  ROPS_CAMP: {
    label: "ROPS Camp",
    dotColor: "bg-green-500",
    badgeClass: "bg-green-100 text-green-800 border-transparent",
    pillClass: "bg-emerald-50 text-emerald-700",
  },
  RETREAT: {
    label: "Retreat",
    dotColor: "bg-blue-500",
    badgeClass: "bg-blue-100 text-blue-800 border-transparent",
    pillClass: "bg-blue-50 text-blue-700",
  },
  MEETING: {
    label: "Meeting",
    dotColor: "bg-gray-500",
    badgeClass: "bg-gray-100 text-gray-800 border-transparent",
    pillClass: "bg-clay-100 text-clay-600",
  },
  SPECIAL_EVENT: {
    label: "Special Event",
    dotColor: "bg-purple-500",
    badgeClass: "bg-purple-100 text-purple-800 border-transparent",
    pillClass: "bg-[#EEE6F5] text-[#8A6CB0]",
  },
  OUTREACH: {
    label: "Outreach",
    dotColor: "bg-teal-500",
    badgeClass: "bg-teal-100 text-teal-800 border-transparent",
    pillClass: "bg-teal/10 text-teal-dark",
  },
};

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const mapEvent = mapEventDoc;

// ─── ICS (calendar subscription) ───

function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function downloadCalendar(events: AppEvent[]) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dew of Hermon//Youth Ministry//EN",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Dew of Hermon — Events",
  ];
  for (const e of events) {
    const start = e.startDate;
    const end = e.endDate ?? new Date(start.getTime() + 2 * 60 * 60 * 1000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@dew-of-hermon`,
      `DTSTAMP:${icsStamp(new Date())}`,
      `DTSTART:${icsStamp(start)}`,
      `DTEND:${icsStamp(end)}`,
      `SUMMARY:${icsEscape(e.title)}`,
      e.venue ? `LOCATION:${icsEscape(e.venue)}` : "",
      e.description ? `DESCRIPTION:${icsEscape(e.description)}` : "",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.filter(Boolean).join("\r\n")], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dew-of-hermon-events.ics";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function CalendarPage() {
  const { userData } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [upcoming, setUpcoming] = useState<AppEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const canCreate = userData ? canCreateEvents(userData.role) : false;
  const isDeptLead = userData ? hasMinRole(userData.role, "DEPARTMENT_LEAD") : false;

  // ─── Fetch events for current month range ───
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const q = query(
        safeCollection("events"),
        where("startDate", ">=", Timestamp.fromDate(monthStart)),
        where("startDate", "<=", Timestamp.fromDate(monthEnd)),
        orderBy("startDate", "asc")
      );
      const snapshot = await getDocs(q);
      const fetched = snapshot.docs.map(mapEvent);
      setEvents(fetched.filter((e) => e.approvalStatus === "APPROVED"));
    } catch (error) {
      console.error("Failed to fetch events:", error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // ─── Fetch upcoming events (from today forward) for the side panel ───
  const fetchUpcoming = useCallback(async () => {
    try {
      const q = query(
        safeCollection("events"),
        where("startDate", ">=", Timestamp.fromDate(new Date())),
        orderBy("startDate", "asc"),
        fsLimit(12)
      );
      const snapshot = await getDocs(q);
      const fetched = snapshot.docs.map(mapEvent);
      setUpcoming(fetched.filter((e) => e.approvalStatus === "APPROVED").slice(0, 6));
    } catch (error) {
      console.error("Failed to fetch upcoming events:", error);
    }
  }, []);

  useEffect(() => {
    fetchUpcoming();
  }, [fetchUpcoming]);

  // ─── Calendar grid computation ───
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Bucket events by day once instead of filtering the full list for each of
  // the ~42 grid cells on every render.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, AppEvent[]>();
    for (const event of events) {
      const key = format(event.startDate, "yyyy-MM-dd");
      const bucket = map.get(key);
      if (bucket) bucket.push(event);
      else map.set(key, [event]);
    }
    return map;
  }, [events]);

  function getEventsForDay(day: Date): AppEvent[] {
    return eventsByDay.get(format(day, "yyyy-MM-dd")) ?? [];
  }

  const selectedDayEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  function goToPreviousMonth() {
    setCurrentMonth((prev) => subMonths(prev, 1));
    setSelectedDate(null);
  }
  function goToNextMonth() {
    setCurrentMonth((prev) => addMonths(prev, 1));
    setSelectedDate(null);
  }
  function goToToday() {
    const now = new Date();
    setCurrentMonth(now);
    setSelectedDate(now);
  }

  return (
    <div className="space-y-7">
      <PageHeader
        icon={CalendarDays}
        tone="blue"
        title="Calendar"
        description="View upcoming events and services"
        actions={
          canCreate ? (
            <Link href="/manage/events/new">
              <Button variant="gold" className="gap-2 rounded-xl shadow-sm">
                <Plus className="h-4 w-4" />
                Add Event
              </Button>
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar + selected day */}
        <div className="space-y-6 lg:col-span-2">
          <div className={cn("overflow-hidden", luxSurface)}>
            {/* Refined month header */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-clay-100/80 px-4 py-4 sm:px-6">
              <div className="justify-self-start">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToToday}
                  className="gap-1.5 rounded-full border-clay-200 text-clay-600"
                >
                  <CalendarCheck className="h-3.5 w-3.5" />
                  Today
                </Button>
              </div>
              <h2 className="justify-self-center text-center font-display text-xl font-bold text-clay-700 sm:text-2xl">
                {format(currentMonth, "MMMM yyyy")}
              </h2>
              <div className="flex items-center gap-1.5 justify-self-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToPreviousMonth}
                  aria-label="Previous month"
                  className="h-9 w-9 rounded-full border border-clay-100 bg-cream/60 hover:bg-cream"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToNextMonth}
                  aria-label="Next month"
                  className="h-9 w-9 rounded-full border border-clay-100 bg-cream/60 hover:bg-cream"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="p-3 sm:p-5">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <LoadingSpinner size="lg" />
                </div>
              ) : loadError ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                  <p className="text-sm text-clay-500">
                    Couldn&apos;t load this month&apos;s events. Check your
                    connection and try again.
                  </p>
                  <Button variant="outline" size="sm" onClick={fetchEvents}>
                    Retry
                  </Button>
                </div>
              ) : (
                <>
                  <div className="mb-1 grid grid-cols-7">
                    {DAY_HEADERS.map((day) => (
                      <div
                        key={day}
                        className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-clay-400"
                      >
                        <span className="hidden sm:inline">{day}</span>
                        <span className="sm:hidden">{day.charAt(0)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1.5">
                    {calendarDays.map((day) => {
                      const dayEvents = getEventsForDay(day);
                      const inCurrentMonth = isSameMonth(day, currentMonth);
                      const today = isToday(day);
                      const isSelected = selectedDate !== null && isSameDay(day, selectedDate);
                      const clickable = dayEvents.length > 0 || (canCreate && inCurrentMonth);

                      return (
                        <button
                          key={day.toISOString()}
                          onClick={() => setSelectedDate(isSelected ? null : day)}
                          className={cn(
                            "relative min-h-[3.5rem] rounded-xl border p-1.5 text-left transition-all md:min-h-[5.75rem]",
                            inCurrentMonth ? "border-clay-100/70 bg-cream/30" : "border-transparent bg-transparent",
                            today && !isSelected && "bg-gold/[0.06]",
                            isSelected && "border-gold/40 bg-gold/[0.08] ring-1 ring-gold/30",
                            clickable && "cursor-pointer hover:border-clay-200 hover:bg-cream/60"
                          )}
                        >
                          <span
                            className={cn(
                              "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs md:text-sm",
                              !inCurrentMonth && "text-clay-300",
                              inCurrentMonth && !today && !isSelected && "text-clay-600",
                              today && !isSelected && "font-bold text-gold-dark ring-1 ring-gold/60",
                              isSelected && "bg-gold font-bold text-white shadow-[0_4px_10px_-3px_rgba(200,150,62,0.6)]"
                            )}
                          >
                            {format(day, "d")}
                          </span>

                          {/* Event pills (md+) */}
                          {dayEvents.length > 0 && (
                            <div className="mt-1 hidden space-y-0.5 md:block">
                              {dayEvents.slice(0, 2).map((event) => (
                                <div
                                  key={event.id}
                                  className={cn(
                                    "truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-tight",
                                    EVENT_TYPE_CONFIG[event.type]?.pillClass || "bg-clay-100 text-clay-600"
                                  )}
                                  title={event.title}
                                >
                                  {event.title}
                                </div>
                              ))}
                              {dayEvents.length > 2 && (
                                <div className="px-1.5 text-[10px] font-medium text-clay-400">
                                  +{dayEvents.length - 2} more
                                </div>
                              )}
                            </div>
                          )}

                          {/* Dots (mobile) */}
                          {dayEvents.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-0.5 md:hidden">
                              {dayEvents.slice(0, 3).map((event) => (
                                <span
                                  key={event.id}
                                  className={cn(
                                    "h-1.5 w-1.5 rounded-full",
                                    EVENT_TYPE_CONFIG[event.type]?.dotColor || "bg-gray-400"
                                  )}
                                />
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Selected day details */}
          {selectedDate && selectedDayEvents.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-clay-700">
                Events on {format(selectedDate, "EEEE, d MMMM yyyy")}
              </h3>
              {selectedDayEvents.map((event) => (
                <div key={event.id} className={cn("overflow-hidden", luxSurface)}>
                  <div className={cn("h-1.5", EVENT_TYPE_CONFIG[event.type]?.dotColor || "bg-gray-400")} />
                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-display font-semibold text-clay-700">{event.title}</h4>
                      <Badge className={EVENT_TYPE_CONFIG[event.type]?.badgeClass || "bg-gray-100 text-gray-800"}>
                        {EVENT_TYPE_CONFIG[event.type]?.label || event.type}
                      </Badge>
                      {event.lifeGroupTarget && (
                        <Badge
                          variant="outline"
                          className={
                            LIFE_GROUP_CONFIG[event.lifeGroupTarget as LifeGroup | "ALL"]?.badgeClass ||
                            "bg-gray-100 text-gray-700"
                          }
                        >
                          {LIFE_GROUP_CONFIG[event.lifeGroupTarget as LifeGroup | "ALL"]?.label || event.lifeGroupTarget}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 flex flex-col gap-2 text-sm text-clay-500 sm:flex-row sm:gap-4">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {format(event.startDate, "h:mm a")}
                      </span>
                      {event.venue && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {event.venue}
                        </span>
                      )}
                    </div>
                    {event.description && (
                      <p className="mt-2 text-sm text-clay-600">{event.description}</p>
                    )}
                    {isDeptLead && (
                      <Link
                        href={`/manage/events/${event.id}/roles`}
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-gold-dark hover:text-gold"
                      >
                        <Users className="h-3.5 w-3.5" />
                        View Role Board
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedDate && selectedDayEvents.length === 0 && (
            <div className={cn(luxSurface)}>
              <EmptyStateLux
                icon={CalendarDays}
                tone="blue"
                title="No events"
                description={`Nothing scheduled for ${format(selectedDate, "EEEE, d MMMM yyyy")}.`}
                action={
                  canCreate ? (
                    <Link href="/manage/events/new">
                      <Button variant="gold" className="gap-2 rounded-xl">
                        <Plus className="h-4 w-4" />
                        Add Event
                      </Button>
                    </Link>
                  ) : undefined
                }
              />
            </div>
          )}
        </div>

        {/* Upcoming events panel */}
        <aside className="space-y-4">
          <div className={cn("p-5", luxSurface)}>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <CalendarRange className="h-5 w-5" />
              </span>
              <h3 className="font-display text-lg font-semibold text-clay-700">Upcoming Events</h3>
            </div>

            <div className="mt-4 space-y-2.5">
              {upcoming.length === 0 ? (
                <p className="py-6 text-center text-sm text-clay-400">
                  No upcoming events on the calendar yet.
                </p>
              ) : (
                upcoming.map((event) => {
                  const cfg = EVENT_TYPE_CONFIG[event.type];
                  const card = (
                    <div className={cn("flex gap-3 p-3", luxSurface, isDeptLead && luxSurfaceHover)}>
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-gold/10 text-gold-dark">
                        <span className="font-display text-lg font-bold leading-none">
                          {format(event.startDate, "d")}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wide">
                          {format(event.startDate, "MMM")}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-clay-700">{event.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-clay-500">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(event.startDate, "h:mm a")}
                          </span>
                          {event.venue && (
                            <span className="inline-flex items-center gap-1 truncate">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{event.venue}</span>
                            </span>
                          )}
                        </div>
                        <span
                          className={cn(
                            "mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
                            cfg?.pillClass || "bg-clay-100 text-clay-600"
                          )}
                        >
                          {cfg?.label || event.type}
                        </span>
                      </div>
                    </div>
                  );
                  return isDeptLead ? (
                    <Link key={event.id} href={`/manage/events/${event.id}/roles`} className="block">
                      {card}
                    </Link>
                  ) : (
                    <div key={event.id}>{card}</div>
                  );
                })
              )}
            </div>

            <Button
              variant="outline"
              onClick={() => downloadCalendar(upcoming.length > 0 ? upcoming : events)}
              disabled={upcoming.length === 0 && events.length === 0}
              className="mt-4 w-full gap-2 rounded-xl border-clay-200"
            >
              <CalendarCheck className="h-4 w-4" />
              Subscribe to Calendar
            </Button>
          </div>

          {/* Legend */}
          <div className={cn("p-5", luxSurface)}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-clay-400">
              Event types
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {Object.entries(EVENT_TYPE_CONFIG).map(([key, cfg]) => (
                <span key={key} className="inline-flex items-center gap-2 text-xs text-clay-500">
                  <span className={cn("h-2.5 w-2.5 rounded-full", cfg.dotColor)} />
                  <span className="truncate">{cfg.label}</span>
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
