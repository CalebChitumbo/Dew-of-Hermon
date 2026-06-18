"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { ServiceAssignment, Service, AppEvent } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatTile } from "@/components/shared/StatTile";
import {
  CalendarDays,
  Clock,
  MapPin,
  CheckCircle2,
  Clock3,
  XCircle,
} from "lucide-react";
import { format, isPast, isToday } from "date-fns";

interface EnrichedAssignment extends ServiceAssignment {
  serviceDate?: Date;
  serviceTime?: string;
  eventTitle?: string;
  venue?: string;
  theme?: string | null;
}

export default function ServiceHistoryPage() {
  const { firebaseUser } = useAuth();
  const [assignments, setAssignments] = useState<EnrichedAssignment[]>([]);
  const [services, setServices] = useState<Map<string, Service>>(new Map());
  const [events, setEvents] = useState<Map<string, AppEvent>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) return;

    const assignmentsQuery = query(
      safeCollection("serviceAssignments"),
      where("userId", "==", firebaseUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsubAssignments = onSnapshot(assignmentsQuery, (snapshot) => {
      const data = snapshot.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          ...raw,
          createdAt: raw.createdAt?.toDate?.() || new Date(),
          updatedAt: raw.updatedAt?.toDate?.() || new Date(),
          emailSentAt: raw.emailSentAt?.toDate?.() || null,
          confirmedAt: raw.confirmedAt?.toDate?.() || null,
        } as EnrichedAssignment;
      });
      setAssignments(data);
      setLoading(false);
    });

    return () => unsubAssignments();
  }, [firebaseUser]);

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

  const pastAssignments = enrichedAssignments
    .filter((a) => a.serviceDate && isPast(a.serviceDate) && !isToday(a.serviceDate))
    .sort((a, b) => b.serviceDate!.getTime() - a.serviceDate!.getTime());

  // Group by month
  const groupedByMonth = pastAssignments.reduce<
    Record<string, EnrichedAssignment[]>
  >((acc, assignment) => {
    const monthKey = assignment.serviceDate
      ? format(assignment.serviceDate, "MMMM yyyy")
      : "Unknown";
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(assignment);
    return acc;
  }, {});

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
      <PageHeader
        backHref="/my-schedule"
        icon={CalendarDays}
        tone="periwinkle"
        title="Service History"
        description="Your complete past service record"
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          icon={CalendarDays}
          tone="periwinkle"
          label="Total Services"
          value={pastAssignments.length}
        />
        <StatTile
          icon={CheckCircle2}
          tone="teal"
          label="Confirmed"
          value={pastAssignments.filter((a) => a.status === "CONFIRMED").length}
        />
        <StatTile
          icon={Clock3}
          tone="gold"
          label="Pending"
          value={pastAssignments.filter((a) => a.status === "PENDING").length}
        />
        <StatTile
          icon={XCircle}
          tone="blush"
          label="Declined"
          value={pastAssignments.filter((a) => a.status === "DECLINED").length}
        />
      </div>

      {/* Past assignments grouped by month */}
      {pastAssignments.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          tone="clay"
          title="No Past Services"
          description="Your service history will appear here after your first completed assignment."
        />
      ) : (
        Object.entries(groupedByMonth).map(([month, monthAssignments]) => (
          <div key={month}>
            <SectionHeading className="mb-3">{month}</SectionHeading>
            <div className="space-y-3">
              {monthAssignments.map((assignment) => (
                <Card key={assignment.id}>
                  <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-clay-100 shrink-0">
                        <CalendarDays className="h-5 w-5 text-clay-400" />
                      </div>
                      <div>
                        <p className="font-medium text-clay-700">
                          {assignment.roleName}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-clay-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {assignment.serviceDate
                              ? format(assignment.serviceDate, "EEE, MMM d")
                              : "Unknown"}
                          </span>
                          {assignment.serviceTime && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {assignment.serviceTime}
                            </span>
                          )}
                          {assignment.venue && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {assignment.venue}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={assignment.status} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
