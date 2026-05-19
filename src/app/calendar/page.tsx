"use client";

import { useState, useEffect, useCallback } from "react";
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
  parseISO,
} from "date-fns";
import {
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
} from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { canCreateEvents, hasMinRole } from "@/lib/permissions";
import { AppEvent, EventType, LifeGroup } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  MapPin,
  Clock,
  CalendarDays,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

// ─── Life Group badge configuration ───

const LIFE_GROUP_CONFIG: Record<LifeGroup | "ALL", { label: string; badgeClass: string }> = {
  BRIDGE: {
    label: "Bridge",
    badgeClass: "bg-blue-100 text-blue-700 border-blue-200",
  },
  ANCHOR: {
    label: "Anchor",
    badgeClass: "bg-green-100 text-green-700 border-green-200",
  },
  CORNERSTONE: {
    label: "Cornerstone",
    badgeClass: "bg-purple-100 text-purple-700 border-purple-200",
  },
  ALL: {
    label: "All Life Groups",
    badgeClass: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
};

// ─── Event type configuration ───

const EVENT_TYPE_CONFIG: Record<
  EventType,
  { label: string; dotColor: string; badgeClass: string }
> = {
  POTTERS_WHEEL_SERVICE: {
    label: "Potter's Wheel Service",
    dotColor: "bg-[#C8963E]",
    badgeClass: "bg-[#C8963E]/20 text-[#C8963E] border-transparent",
  },
  ROPS_CAMP: {
    label: "ROPS Camp",
    dotColor: "bg-green-500",
    badgeClass: "bg-green-100 text-green-800 border-transparent",
  },
  RETREAT: {
    label: "Retreat",
    dotColor: "bg-blue-500",
    badgeClass: "bg-blue-100 text-blue-800 border-transparent",
  },
  MEETING: {
    label: "Meeting",
    dotColor: "bg-gray-500",
    badgeClass: "bg-gray-100 text-gray-800 border-transparent",
  },
  SPECIAL_EVENT: {
    label: "Special Event",
    dotColor: "bg-purple-500",
    badgeClass: "bg-purple-100 text-purple-800 border-transparent",
  },
  OUTREACH: {
    label: "Outreach",
    dotColor: "bg-teal-500",
    badgeClass: "bg-teal-100 text-teal-800 border-transparent",
  },
};

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Helper to parse Firestore dates ───

function parseFirestoreDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === "string") return parseISO(val);
  if (val && typeof val === "object" && "seconds" in val) {
    return new Date((val as { seconds: number }).seconds * 1000);
  }
  return new Date();
}

export default function CalendarPage() {
  const { userData } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const canCreate = userData ? canCreateEvents(userData.role) : false;
  const isDeptLead = userData ? hasMinRole(userData.role, "DEPARTMENT_LEAD") : false;

  // ─── Fetch events for current month range ───

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      const eventsRef = safeCollection("events");
      const q = query(
        eventsRef,
        where("startDate", ">=", Timestamp.fromDate(monthStart)),
        where("startDate", "<=", Timestamp.fromDate(monthEnd)),
        orderBy("startDate", "asc")
      );

      const snapshot = await getDocs(q);
      const fetchedEvents: AppEvent[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          description: data.description || null,
          type: data.type as EventType,
          startDate: parseFirestoreDate(data.startDate),
          endDate: data.endDate ? parseFirestoreDate(data.endDate) : null,
          venue: data.venue || "",
          isRecurring: data.isRecurring || false,
          createdBy: data.createdBy || "",
          lifeGroupTarget: data.lifeGroupTarget || null,
          approvalStatus: data.approvalStatus || "APPROVED",
          approvalComments: data.approvalComments || null,
          approvedBy: data.approvedBy || null,
          approvedAt: data.approvedAt ? parseFirestoreDate(data.approvedAt) : null,
          createdByDepartmentId: data.createdByDepartmentId || null,
          coreRoles: data.coreRoles || [],
          transportRequired: data.transportRequired || false,
          transportNeeds: data.transportNeeds || null,
          transportRequestId: data.transportRequestId || null,
          budgetRequested: data.budgetRequested || false,
          budgetAmount: data.budgetAmount ?? null,
          budgetCurrency: data.budgetCurrency || null,
          budgetPurpose: data.budgetPurpose || null,
          budgetRequestId: data.budgetRequestId || null,
          createdAt: parseFirestoreDate(data.createdAt),
          updatedAt: parseFirestoreDate(data.updatedAt),
        };
      });

      // Only show approved events on the calendar
      setEvents(fetchedEvents.filter((e) => e.approvalStatus === "APPROVED"));
    } catch (error) {
      console.error("Failed to fetch events:", error);
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // ─── Calendar grid computation ───

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // ─── Events for a specific day ───

  function getEventsForDay(day: Date): AppEvent[] {
    return events.filter((event) => isSameDay(event.startDate, day));
  }

  // ─── Selected day events ───

  const selectedDayEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  // ─── Navigate months ───

  function goToPreviousMonth() {
    setCurrentMonth((prev) => subMonths(prev, 1));
    setSelectedDate(null);
  }

  function goToNextMonth() {
    setCurrentMonth((prev) => addMonths(prev, 1));
    setSelectedDate(null);
  }

  // ─── Render ───

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-900">
            Calendar
          </h1>
          <p className="text-sm text-clay-500 mt-1">
            View upcoming events and services
          </p>
        </div>
        {canCreate && (
          <Link href="/manage/events/new">
            <Button className="bg-[#C8963E] hover:bg-[#B8862E] text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Event
            </Button>
          </Link>
        )}
      </div>

      {/* Month navigation */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={goToPreviousMonth}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <CardTitle className="text-lg md:text-xl">
              {format(currentMonth, "MMMM yyyy")}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={goToNextMonth}
              aria-label="Next month"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <>
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-2">
                {DAY_HEADERS.map((day) => (
                  <div
                    key={day}
                    className="text-center text-xs font-semibold text-clay-500 py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 border-t border-l border-clay-100">
                {calendarDays.map((day) => {
                  const dayEvents = getEventsForDay(day);
                  const inCurrentMonth = isSameMonth(day, currentMonth);
                  const today = isToday(day);
                  const isSelected =
                    selectedDate !== null && isSameDay(day, selectedDate);

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => {
                        setSelectedDate(isSelected ? null : day);
                      }}
                      className={cn(
                        "relative border-r border-b border-clay-100 p-1 md:p-2 min-h-[3rem] md:min-h-[5rem] text-left transition-colors",
                        !inCurrentMonth && "bg-clay-50/50",
                        inCurrentMonth && "bg-white",
                        today && "bg-[#C8963E]/5",
                        isSelected && "bg-[#C8963E]/10 ring-2 ring-inset ring-[#C8963E]",
                        (dayEvents.length > 0 || (canCreate && inCurrentMonth)) &&
                          "cursor-pointer hover:bg-clay-50"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex items-center justify-center text-xs md:text-sm w-6 h-6 md:w-7 md:h-7 rounded-full",
                          !inCurrentMonth && "text-clay-300",
                          inCurrentMonth && "text-clay-700",
                          today &&
                            "bg-[#C8963E] text-white font-bold"
                        )}
                      >
                        {format(day, "d")}
                      </span>

                      {/* Event dots */}
                      {dayEvents.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 mt-0.5 md:mt-1">
                          {dayEvents.slice(0, 3).map((event) => (
                            <span
                              key={event.id}
                              className={cn(
                                "w-1.5 h-1.5 md:w-2 md:h-2 rounded-full",
                                EVENT_TYPE_CONFIG[event.type]?.dotColor ||
                                  "bg-gray-400"
                              )}
                              title={event.title}
                            />
                          ))}
                          {dayEvents.length > 3 && (
                            <span className="text-[10px] text-clay-400 leading-none">
                              +{dayEvents.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Event title preview on larger screens */}
                      <div className="hidden md:block mt-1 space-y-0.5">
                        {dayEvents.slice(0, 2).map((event) => (
                          <div
                            key={event.id}
                            className={cn(
                              "text-[10px] leading-tight truncate rounded px-1 py-0.5",
                              EVENT_TYPE_CONFIG[event.type]?.badgeClass ||
                                "bg-gray-100 text-gray-800"
                            )}
                          >
                            {event.title}
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Selected day event details */}
      {selectedDate && selectedDayEvents.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-display font-semibold text-clay-900">
            Events on {format(selectedDate, "EEEE, d MMMM yyyy")}
          </h2>
          {selectedDayEvents.map((event) => (
            <Card key={event.id} className="overflow-hidden">
              <div
                className={cn(
                  "h-1",
                  EVENT_TYPE_CONFIG[event.type]?.dotColor || "bg-gray-400"
                )}
              />
              <CardContent className="pt-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display font-semibold text-clay-900">
                        {event.title}
                      </h3>
                      <Badge
                        className={
                          EVENT_TYPE_CONFIG[event.type]?.badgeClass ||
                          "bg-gray-100 text-gray-800"
                        }
                      >
                        {EVENT_TYPE_CONFIG[event.type]?.label || event.type}
                      </Badge>
                      {event.lifeGroupTarget && (
                        <Badge
                          variant="outline"
                          className={
                            LIFE_GROUP_CONFIG[event.lifeGroupTarget as LifeGroup | "ALL"]
                              ?.badgeClass || "bg-gray-100 text-gray-700"
                          }
                        >
                          {LIFE_GROUP_CONFIG[event.lifeGroupTarget as LifeGroup | "ALL"]?.label ||
                            event.lifeGroupTarget}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm text-clay-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {format(event.startDate, "h:mm a")}
                      </span>
                      {event.venue && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {event.venue}
                        </span>
                      )}
                    </div>

                    {event.description && (
                      <p className="text-sm text-clay-600 mt-1">
                        {event.description}
                      </p>
                    )}

                    {isDeptLead && (
                      <Link
                        href={`/manage/events/${event.id}/roles`}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#C8963E] hover:text-[#B8862E] mt-2"
                      >
                        <Users className="h-3.5 w-3.5" />
                        View Role Board
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Selected day with no events */}
      {selectedDate && selectedDayEvents.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <CalendarDays className="h-10 w-10 text-clay-300 mx-auto mb-3" />
            <p className="text-clay-500">
              No events on {format(selectedDate, "EEEE, d MMMM yyyy")}
            </p>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
