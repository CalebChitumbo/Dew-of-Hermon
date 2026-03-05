"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  query,
  where,
  onSnapshot,
  updateDoc,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { safeCollection, safeDoc } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { ServiceAssignment, Service, AppEvent, UserAvailability } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  CalendarDays,
  Clock,
  MapPin,
  Check,
  X,
  CalendarOff,
  History,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { format, isPast, isFuture, parseISO, isToday } from "date-fns";

interface EnrichedAssignment extends ServiceAssignment {
  serviceDate?: Date;
  serviceTime?: string;
  eventTitle?: string;
  venue?: string;
  theme?: string | null;
  arrivalTime?: string | null;
}

export default function MySchedulePage() {
  const { firebaseUser, userData } = useAuth();
  const [assignments, setAssignments] = useState<EnrichedAssignment[]>([]);
  const [services, setServices] = useState<Map<string, Service>>(new Map());
  const [events, setEvents] = useState<Map<string, AppEvent>>(new Map());
  const [availability, setAvailability] = useState<UserAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Availability form state
  const [unavailableDate, setUnavailableDate] = useState("");
  const [unavailableReason, setUnavailableReason] = useState("");
  const [savingAvailability, setSavingAvailability] = useState(false);

  // Listen to user's assignments in real-time
  useEffect(() => {
    if (!firebaseUser) return;

    const assignmentsQuery = query(
      safeCollection("serviceAssignments"),
      where("userId", "==", firebaseUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsubAssignments = onSnapshot(assignmentsQuery, (snapshot) => {
      const assignmentData = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
          emailSentAt: data.emailSentAt?.toDate?.() || null,
          confirmedAt: data.confirmedAt?.toDate?.() || null,
        } as EnrichedAssignment;
      });
      setAssignments(assignmentData);
      setLoading(false);
    });

    return () => unsubAssignments();
  }, [firebaseUser]);

  // Listen to services to enrich assignment data
  useEffect(() => {
    const unsubServices = onSnapshot(safeCollection("services"), (snapshot) => {
      const svcMap = new Map<string, Service>();
      snapshot.docs.forEach((d) => {
        const data = d.data();
        svcMap.set(d.id, {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
        } as Service);
      });
      setServices(svcMap);
    });

    return () => unsubServices();
  }, []);

  // Listen to events for date/venue info
  useEffect(() => {
    const unsubEvents = onSnapshot(safeCollection("events"), (snapshot) => {
      const evtMap = new Map<string, AppEvent>();
      snapshot.docs.forEach((d) => {
        const data = d.data();
        evtMap.set(d.id, {
          id: d.id,
          ...data,
          startDate: data.startDate?.toDate?.() || new Date(),
          endDate: data.endDate?.toDate?.() || null,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
        } as AppEvent);
      });
      setEvents(evtMap);
    });

    return () => unsubEvents();
  }, []);

  // Listen to user availability
  useEffect(() => {
    if (!firebaseUser) return;

    const unsubAvailability = onSnapshot(
      safeCollection("users", firebaseUser.uid, "availability"),
      (snapshot) => {
        const avail = snapshot.docs.map((d) => ({
          ...d.data(),
          date: d.id,
        })) as UserAvailability[];
        setAvailability(avail.sort((a, b) => a.date.localeCompare(b.date)));
      }
    );

    return () => unsubAvailability();
  }, [firebaseUser]);

  // Enrich assignments with service/event data
  const enrichedAssignments = assignments.map((assignment) => {
    const service = services.get(assignment.serviceId);
    const event = service ? events.get(service.eventId) : undefined;
    return {
      ...assignment,
      serviceDate: event?.startDate,
      serviceTime: service?.serviceTime,
      eventTitle: event?.title,
      venue: event?.venue,
      theme: service?.theme,
    };
  });

  const upcomingAssignments = enrichedAssignments
    .filter((a) => a.serviceDate && (isFuture(a.serviceDate) || isToday(a.serviceDate)))
    .sort((a, b) => (a.serviceDate!.getTime() - b.serviceDate!.getTime()));

  const pastAssignments = enrichedAssignments
    .filter((a) => a.serviceDate && isPast(a.serviceDate) && !isToday(a.serviceDate))
    .sort((a, b) => (b.serviceDate!.getTime() - a.serviceDate!.getTime()))
    .slice(0, 5);

  const handleConfirm = async (assignmentId: string) => {
    setActionLoading(assignmentId);
    try {
      await updateDoc(safeDoc("serviceAssignments", assignmentId), {
        status: "CONFIRMED",
        confirmedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error confirming assignment:", error);
    }
    setActionLoading(null);
  };

  const handleDecline = async (assignmentId: string) => {
    setActionLoading(assignmentId);
    try {
      await updateDoc(safeDoc("serviceAssignments", assignmentId), {
        status: "DECLINED",
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error declining assignment:", error);
    }
    setActionLoading(null);
  };

  const handleSetUnavailable = async () => {
    if (!firebaseUser || !unavailableDate) return;
    setSavingAvailability(true);
    try {
      const { setDoc } = await import("firebase/firestore");
      await setDoc(
        safeDoc("users", firebaseUser.uid, "availability", unavailableDate),
        {
          available: false,
          reason: unavailableReason || null,
          date: unavailableDate,
        }
      );
      setUnavailableDate("");
      setUnavailableReason("");
    } catch (error) {
      console.error("Error setting availability:", error);
    }
    setSavingAvailability(false);
  };

  const handleRemoveUnavailable = async (date: string) => {
    if (!firebaseUser) return;
    try {
      const { deleteDoc } = await import("firebase/firestore");
      await deleteDoc(safeDoc("users", firebaseUser.uid, "availability", date));
    } catch (error) {
      console.error("Error removing availability:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-700">
            My Schedule
          </h1>
          <p className="text-clay-500 mt-1">
            View your upcoming assignments and manage availability
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/my-schedule/availability">
            <Button variant="outline" size="sm">
              <CalendarOff className="mr-2 h-4 w-4" />
              Availability
            </Button>
          </Link>
          <Link href="/my-schedule/history">
            <Button variant="outline" size="sm">
              <History className="mr-2 h-4 w-4" />
              History
            </Button>
          </Link>
        </div>
      </div>

      {/* Upcoming Assignments */}
      <div>
        <h2 className="text-lg font-display font-semibold text-clay-700 mb-4">
          Upcoming Assignments
        </h2>
        {upcomingAssignments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CalendarDays className="h-12 w-12 text-clay-300 mb-4" />
              <h3 className="text-lg font-display font-semibold text-clay-600">
                No Upcoming Assignments
              </h3>
              <p className="text-clay-400 text-sm mt-1 text-center max-w-md">
                You have no upcoming service assignments. When you are assigned
                to a role, it will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {upcomingAssignments.map((assignment) => (
              <Card
                key={assignment.id}
                className="overflow-hidden border-l-4 border-l-gold"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {assignment.roleName}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {assignment.eventTitle || "Service"}
                        {assignment.theme && (
                          <span className="ml-1">
                            &mdash; {assignment.theme}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <StatusBadge status={assignment.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-clay-600">
                      <CalendarDays className="h-4 w-4 text-clay-400" />
                      <span>
                        {assignment.serviceDate
                          ? format(assignment.serviceDate, "EEE, MMM d, yyyy")
                          : "TBD"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-clay-600">
                      <Clock className="h-4 w-4 text-clay-400" />
                      <span>{assignment.serviceTime || "TBD"}</span>
                    </div>
                    {assignment.venue && (
                      <div className="flex items-center gap-2 text-clay-600 col-span-2">
                        <MapPin className="h-4 w-4 text-clay-400" />
                        <span>{assignment.venue}</span>
                      </div>
                    )}
                    {assignment.arrivalTime && (
                      <div className="flex items-center gap-2 text-clay-600 col-span-2">
                        <AlertCircle className="h-4 w-4 text-gold" />
                        <span className="text-gold-dark font-medium">
                          Arrive by {assignment.arrivalTime}
                        </span>
                      </div>
                    )}
                  </div>

                  {assignment.status === "PENDING" && (
                    <>
                      <Separator />
                      <div className="flex gap-2">
                        <Button
                          variant="teal"
                          size="sm"
                          className="flex-1"
                          disabled={actionLoading === assignment.id}
                          onClick={() => handleConfirm(assignment.id)}
                        >
                          {actionLoading === assignment.id ? (
                            <LoadingSpinner size="sm" className="mr-2" />
                          ) : (
                            <Check className="mr-2 h-4 w-4" />
                          )}
                          Confirm
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          disabled={actionLoading === assignment.id}
                          onClick={() => handleDecline(assignment.id)}
                        >
                          {actionLoading === assignment.id ? (
                            <LoadingSpinner size="sm" className="mr-2" />
                          ) : (
                            <X className="mr-2 h-4 w-4" />
                          )}
                          Decline
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Set Availability Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Set Availability</CardTitle>
          <CardDescription>
            Mark dates when you are unavailable for service
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label htmlFor="unavailable-date" className="sr-only">
                Date
              </Label>
              <Input
                id="unavailable-date"
                type="date"
                value={unavailableDate}
                onChange={(e) => setUnavailableDate(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
                placeholder="Select date"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="unavailable-reason" className="sr-only">
                Reason
              </Label>
              <Input
                id="unavailable-reason"
                placeholder="Reason (optional)"
                value={unavailableReason}
                onChange={(e) => setUnavailableReason(e.target.value)}
              />
            </div>
            <Button
              variant="gold"
              onClick={handleSetUnavailable}
              disabled={!unavailableDate || savingAvailability}
            >
              {savingAvailability ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <CalendarOff className="mr-2 h-4 w-4" />
              )}
              Mark Unavailable
            </Button>
          </div>

          {availability.filter((a) => !a.available).length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-clay-600">
                Unavailable dates:
              </p>
              <div className="flex flex-wrap gap-2">
                {availability
                  .filter((a) => !a.available)
                  .map((a) => (
                    <Badge
                      key={a.date}
                      variant="secondary"
                      className="flex items-center gap-1 py-1 px-3"
                    >
                      {format(parseISO(a.date), "MMM d, yyyy")}
                      {a.reason && (
                        <span className="text-clay-400 ml-1">
                          ({a.reason})
                        </span>
                      )}
                      <button
                        onClick={() => handleRemoveUnavailable(a.date)}
                        className="ml-1 hover:text-red-500 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Assignments */}
      {pastAssignments.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold text-clay-700">
              Recent Past Assignments
            </h2>
            <Link href="/my-schedule/history">
              <Button variant="ghost" size="sm">
                View All
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {pastAssignments.map((assignment) => (
              <Card key={assignment.id} className="bg-clay-50/50">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-clay-100">
                      <CalendarDays className="h-5 w-5 text-clay-400" />
                    </div>
                    <div>
                      <p className="font-medium text-clay-700">
                        {assignment.roleName}
                      </p>
                      <p className="text-sm text-clay-400">
                        {assignment.serviceDate
                          ? format(assignment.serviceDate, "EEE, MMM d, yyyy")
                          : "Unknown date"}
                        {assignment.eventTitle &&
                          ` - ${assignment.eventTitle}`}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={assignment.status} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
