"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, query, where, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { RoleProtected } from "@/components/shared/RoleProtected";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Calendar,
  MapPin,
  Clock,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Users,
} from "lucide-react";
import { format, isPast, isToday, isTomorrow, formatDistanceToNow } from "date-fns";
import { Service, AppEvent } from "@/types";

interface ServiceWithEvent extends Service {
  event: AppEvent | null;
  assignmentCount: number;
}

const TOTAL_ROLES = 13;

function getReadinessColor(count: number): string {
  const ratio = count / TOTAL_ROLES;
  if (ratio >= 1) return "bg-green-500";
  if (ratio >= 0.7) return "bg-teal";
  if (ratio >= 0.4) return "bg-gold";
  return "bg-red-500";
}

function getReadinessTextColor(count: number): string {
  const ratio = count / TOTAL_ROLES;
  if (ratio >= 1) return "text-green-700";
  if (ratio >= 0.7) return "text-teal-dark";
  if (ratio >= 0.4) return "text-gold-dark";
  return "text-red-700";
}

function getDateLabel(date: Date): { label: string; className: string } {
  if (isToday(date)) return { label: "Today", className: "bg-teal/10 text-teal-dark border-teal/30" };
  if (isTomorrow(date)) return { label: "Tomorrow", className: "bg-gold/10 text-gold-dark border-gold/30" };
  if (isPast(date)) return { label: "Past", className: "bg-clay-100 text-clay-500 border-clay-200" };
  return { label: formatDistanceToNow(date, { addSuffix: true }), className: "bg-cream text-clay-600 border-clay-200" };
}

function ServiceCard({ service }: { service: ServiceWithEvent }) {
  const eventDate = service.event?.startDate
    ? new Date(service.event.startDate as unknown as string)
    : null;

  const dateLabel = eventDate ? getDateLabel(eventDate) : null;
  const readinessColor = getReadinessColor(service.assignmentCount);
  const readinessText = getReadinessTextColor(service.assignmentCount);
  const isFull = service.assignmentCount >= TOTAL_ROLES;

  return (
    <Link href={`/manage/services/${service.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer border-clay-200 hover:border-clay-300">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-display text-clay-700">
                {service.theme || "Untitled Service"}
              </CardTitle>
              {eventDate && (
                <div className="flex items-center gap-2 text-sm text-clay-500">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{format(eventDate, "EEEE, d MMMM yyyy")}</span>
                </div>
              )}
            </div>
            {dateLabel && (
              <Badge
                className={`${dateLabel.className} border text-xs font-medium`}
              >
                {dateLabel.label}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-clay-500">
              {service.event?.venue && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{service.event.venue}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>{service.serviceTime}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Readiness indicator */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  {isFull ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Users className="h-4 w-4 text-clay-400" />
                  )}
                  <span className={`text-sm font-semibold ${readinessText}`}>
                    {service.assignmentCount}/{TOTAL_ROLES}
                  </span>
                </div>
                <div className="w-16 h-2 bg-clay-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${readinessColor}`}
                    style={{
                      width: `${Math.min((service.assignmentCount / TOTAL_ROLES) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-clay-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ServicesListContent() {
  const { userData } = useAuth();
  const [upcomingServices, setUpcomingServices] = useState<ServiceWithEvent[]>([]);
  const [pastServices, setPastServices] = useState<ServiceWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("upcoming");

  useEffect(() => {
    if (!userData) return;

    // Listen to active (non-archived) services
    const servicesRef = collection(db, "services");
    const activeQuery = query(
      servicesRef,
      where("isArchived", "==", false),
      orderBy("createdAt", "desc")
    );

    const unsubActive = onSnapshot(activeQuery, async (snapshot) => {
      const servicesData: ServiceWithEvent[] = [];
      const eventIds = new Set<string>();

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.eventId) eventIds.add(data.eventId);
        servicesData.push({
          id: doc.id,
          eventId: data.eventId,
          theme: data.theme || null,
          serviceTime: data.serviceTime,
          programNotes: data.programNotes || null,
          attendanceCount: data.attendanceCount || null,
          isArchived: data.isArchived || false,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
          event: null,
          assignmentCount: 0,
        });
      });

      // Fetch events for these services (client-side join)
      if (eventIds.size > 0) {
        const { getDocs, documentId } = await import("firebase/firestore");
        const eventIdArray = Array.from(eventIds);
        // Process in chunks of 30 (Firestore 'in' limit)
        for (let i = 0; i < eventIdArray.length; i += 30) {
          const chunk = eventIdArray.slice(i, i + 30);
          const eventsQuery = query(
            collection(db, "events"),
            where(documentId(), "in", chunk)
          );
          const eventsSnap = await getDocs(eventsQuery);
          eventsSnap.docs.forEach((eventDoc) => {
            const eventData = eventDoc.data();
            const event: AppEvent = {
              id: eventDoc.id,
              title: eventData.title,
              description: eventData.description || null,
              type: eventData.type,
              startDate: eventData.startDate?.toDate?.() || new Date(),
              endDate: eventData.endDate?.toDate?.() || null,
              venue: eventData.venue,
              isRecurring: eventData.isRecurring || false,
              createdBy: eventData.createdBy,
              createdAt: eventData.createdAt?.toDate?.() || new Date(),
              updatedAt: eventData.updatedAt?.toDate?.() || new Date(),
            };
            servicesData.forEach((s) => {
              if (s.eventId === eventDoc.id) {
                s.event = event;
              }
            });
          });
        }
      }

      // Fetch assignment counts
      const serviceIds = servicesData.map((s) => s.id);
      if (serviceIds.length > 0) {
        const { getDocs } = await import("firebase/firestore");
        for (let i = 0; i < serviceIds.length; i += 30) {
          const chunk = serviceIds.slice(i, i + 30);
          const assignQuery = query(
            collection(db, "serviceAssignments"),
            where("serviceId", "in", chunk)
          );
          const assignSnap = await getDocs(assignQuery);
          const counts: Record<string, number> = {};
          assignSnap.docs.forEach((doc) => {
            const sid = doc.data().serviceId;
            counts[sid] = (counts[sid] || 0) + 1;
          });
          servicesData.forEach((s) => {
            if (counts[s.id]) {
              s.assignmentCount = counts[s.id];
            }
          });
        }
      }

      // Sort by event date, splitting into upcoming and past
      const now = new Date();
      const upcoming: ServiceWithEvent[] = [];
      const past: ServiceWithEvent[] = [];

      servicesData.forEach((s) => {
        const eventDate = s.event?.startDate;
        if (eventDate && isPast(eventDate) && !isToday(eventDate)) {
          past.push(s);
        } else {
          upcoming.push(s);
        }
      });

      // Sort upcoming by date ascending (nearest first)
      upcoming.sort((a, b) => {
        const dateA = a.event?.startDate ? new Date(a.event.startDate).getTime() : 0;
        const dateB = b.event?.startDate ? new Date(b.event.startDate).getTime() : 0;
        return dateA - dateB;
      });

      // Sort past by date descending (most recent first)
      past.sort((a, b) => {
        const dateA = a.event?.startDate ? new Date(a.event.startDate).getTime() : 0;
        const dateB = b.event?.startDate ? new Date(b.event.startDate).getTime() : 0;
        return dateB - dateA;
      });

      setUpcomingServices(upcoming);
      setPastServices(past);
      setLoading(false);
    });

    return () => unsubActive();
  }, [userData]);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-clay-700">
            Services
          </h1>
          <p className="mt-1 text-clay-500">
            Manage service schedules and rota assignments
          </p>
        </div>
        <Link href="/manage/services/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Service
          </Button>
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-teal/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-teal" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-clay-700">
                  {upcomingServices.length}
                </p>
                <p className="text-sm text-clay-500">Upcoming</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gold/10 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-gold" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-clay-700">
                  {upcomingServices.filter((s) => s.assignmentCount < TOTAL_ROLES).length}
                </p>
                <p className="text-sm text-clay-500">Need Assignments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-clay-700">
                  {upcomingServices.filter((s) => s.assignmentCount >= TOTAL_ROLES).length}
                </p>
                <p className="text-sm text-clay-500">Fully Staffed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Services tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="upcoming" className="gap-1.5">
            Upcoming
            <Badge variant="secondary" className="ml-1 text-xs">
              {upcomingServices.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="past" className="gap-1.5">
            Past
            <Badge variant="secondary" className="ml-1 text-xs">
              {pastServices.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          {upcomingServices.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 text-clay-300 mx-auto mb-4" />
                <h3 className="text-lg font-display text-clay-600 mb-2">
                  No upcoming services
                </h3>
                <p className="text-sm text-clay-400 mb-4">
                  Create a new service to get started with rota assignments.
                </p>
                <Link href="/manage/services/new">
                  <Button variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Service
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {upcomingServices.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past">
          {pastServices.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="h-12 w-12 text-clay-300 mx-auto mb-4" />
                <h3 className="text-lg font-display text-clay-600 mb-2">
                  No past services
                </h3>
                <p className="text-sm text-clay-400">
                  Past services will appear here after their date has passed.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pastServices.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ServicesPage() {
  return (
    <RoleProtected requiredRole="DEPARTMENT_LEAD">
      <div className="min-h-screen bg-cream">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <ServicesListContent />
        </div>
      </div>
    </RoleProtected>
  );
}
