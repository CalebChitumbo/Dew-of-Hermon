"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { RoleProtected } from "@/components/shared/RoleProtected";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  StatCardLux,
  EmptyStateLux,
  SegmentedTabsList,
  SegmentedTab,
  SoftWaves,
  luxSurface,
  luxSurfaceHover,
} from "@/components/shared/lux";
import {
  Plus,
  Calendar,
  MapPin,
  Clock,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Users,
  ClipboardList,
  ArrowRight,
  Church,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isPast, isToday, isTomorrow, formatDistanceToNow } from "date-fns";

interface ServiceEvent {
  id: string;
  title: string;
  description: string | null;
  type: string;
  startDate: string | null;
  endDate: string | null;
  venue: string;
  isRecurring: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface ServiceWithEvent {
  id: string;
  eventId: string;
  theme: string | null;
  serviceTime: string;
  programNotes: string | null;
  attendanceCount: number | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  event: ServiceEvent | null;
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

/** Capitalise the first letter (e.g. "in 2 days" → "In 2 days"). */
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Featured (next upcoming) service — the page hero ─────────────────────────

function FeaturedServiceCard({ service }: { service: ServiceWithEvent }) {
  const eventDate = service.event?.startDate ? new Date(service.event.startDate) : null;
  const dateLabel = eventDate ? getDateLabel(eventDate) : null;
  const filled = Math.min(service.assignmentCount, TOTAL_ROLES);
  const pct = Math.min((service.assignmentCount / TOTAL_ROLES) * 100, 100);
  const isFull = service.assignmentCount >= TOTAL_ROLES;

  return (
    <Link
      href={`/manage/services/${service.id}`}
      className={cn("group block overflow-hidden", luxSurface, luxSurfaceHover)}
    >
      <div className="grid md:grid-cols-[minmax(0,260px)_1fr]">
        {/* Decorative image panel */}
        <div className="relative min-h-[160px] overflow-hidden bg-gradient-to-br from-gold/25 via-clay-100 to-cream md:min-h-full">
          <span className="absolute inset-0 flex items-center justify-center text-gold/40">
            <Church className="h-16 w-16" />
          </span>
          {/* curve connecting image into the content */}
          <SoftWaves className="absolute -right-px bottom-0 hidden h-20 w-24 text-white/85 md:block" />
          <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gold-dark shadow-sm backdrop-blur">
            <ClipboardList className="h-3.5 w-3.5" />
            Next service
          </span>
        </div>

        {/* Content */}
        <div className="relative p-6 md:p-7">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-display text-xl font-bold text-clay-700 md:text-2xl">
                {service.theme || "Potter's Wheel Youth Service"}
              </h3>
              {eventDate && (
                <p className="mt-1 text-sm text-clay-500">
                  {format(eventDate, "EEEE, d MMMM yyyy")}
                </p>
              )}
            </div>
            {dateLabel && (
              <Badge className={cn("shrink-0 border text-xs font-medium", dateLabel.className)}>
                {cap(dateLabel.label)}
              </Badge>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-clay-500">
            {service.event?.venue && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-clay-400" />
                {service.event.venue}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-clay-400" />
              {service.serviceTime}
            </span>
          </div>

          {/* Staffing progress */}
          <div className="mt-6 rounded-2xl border border-clay-100/80 bg-cream/50 p-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-clay-600">
                {isFull ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <Users className="h-4 w-4 text-clay-400" />
                )}
                Staffing
              </span>
              <span className={cn("font-display text-lg font-bold", getReadinessTextColor(service.assignmentCount))}>
                {filled}/{TOTAL_ROLES}
              </span>
            </div>
            <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-clay-100">
              <div
                className={cn("h-full rounded-full transition-all duration-700", getReadinessColor(service.assignmentCount))}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-clay-400">
              {isFull
                ? "Fully staffed and ready to serve."
                : `${TOTAL_ROLES - filled} role${TOTAL_ROLES - filled === 1 ? "" : "s"} still to assign.`}
            </p>
          </div>

          {/* Arrow action */}
          <div className="mt-5 flex items-center justify-between">
            <span className="text-sm font-medium text-clay-500 transition-colors group-hover:text-gold-dark">
              Open rota board
            </span>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-clay-700 text-cream shadow-sm transition-all duration-300 group-hover:bg-clay-600 group-hover:shadow-md">
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Regular service row card ────────────────────────────────────────────────

function ServiceCard({ service }: { service: ServiceWithEvent }) {
  const eventDate = service.event?.startDate ? new Date(service.event.startDate) : null;
  const dateLabel = eventDate ? getDateLabel(eventDate) : null;
  const readinessColor = getReadinessColor(service.assignmentCount);
  const readinessText = getReadinessTextColor(service.assignmentCount);
  const isFull = service.assignmentCount >= TOTAL_ROLES;

  return (
    <Link
      href={`/manage/services/${service.id}`}
      className={cn("group block p-5", luxSurface, luxSurfaceHover)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="truncate font-display text-lg font-semibold text-clay-700">
            {service.theme || "Untitled Service"}
          </h3>
          {eventDate && (
            <div className="flex items-center gap-2 text-sm text-clay-500">
              <Calendar className="h-3.5 w-3.5" />
              <span>{format(eventDate, "EEEE, d MMMM yyyy")}</span>
            </div>
          )}
        </div>
        {dateLabel && (
          <Badge className={cn("shrink-0 border text-xs font-medium", dateLabel.className)}>
            {cap(dateLabel.label)}
          </Badge>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-clay-500">
          {service.event?.venue && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {service.event.venue}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {service.serviceTime}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {isFull ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <Users className="h-4 w-4 text-clay-400" />
            )}
            <span className={cn("text-sm font-semibold", readinessText)}>
              {Math.min(service.assignmentCount, TOTAL_ROLES)}/{TOTAL_ROLES}
            </span>
          </div>
          <div className="h-2 w-16 overflow-hidden rounded-full bg-clay-100">
            <div
              className={cn("h-full rounded-full transition-all", readinessColor)}
              style={{ width: `${Math.min((service.assignmentCount / TOTAL_ROLES) * 100, 100)}%` }}
            />
          </div>
          <ChevronRight className="h-4 w-4 text-clay-300 transition-all group-hover:translate-x-0.5 group-hover:text-gold" />
        </div>
      </div>
    </Link>
  );
}

function ServicesListContent() {
  const { userData } = useAuth();
  const [upcomingServices, setUpcomingServices] = useState<ServiceWithEvent[]>([]);
  const [pastServices, setPastServices] = useState<ServiceWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("upcoming");

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/services?limit=100");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.details || data?.error || `HTTP ${res.status}`);
      }
      const servicesData: ServiceWithEvent[] = data.services || [];

      const upcoming: ServiceWithEvent[] = [];
      const past: ServiceWithEvent[] = [];

      servicesData.forEach((s: ServiceWithEvent) => {
        const eventDate = s.event?.startDate ? new Date(s.event.startDate) : null;
        if (eventDate && isPast(eventDate) && !isToday(eventDate)) {
          past.push(s);
        } else {
          upcoming.push(s);
        }
      });

      upcoming.sort((a, b) => {
        const dateA = a.event?.startDate ? new Date(a.event.startDate).getTime() : 0;
        const dateB = b.event?.startDate ? new Date(b.event.startDate).getTime() : 0;
        return dateA - dateB;
      });

      past.sort((a, b) => {
        const dateA = a.event?.startDate ? new Date(a.event.startDate).getTime() : 0;
        const dateB = b.event?.startDate ? new Date(b.event.startDate).getTime() : 0;
        return dateB - dateA;
      });

      setUpcomingServices(upcoming);
      setPastServices(past);
    } catch (err) {
      console.error("Error fetching services:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to load services: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userData) return;
    fetchServices();
  }, [userData, fetchServices]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyStateLux
        icon={AlertCircle}
        tone="rose"
        title="Something went wrong"
        description={error}
        action={
          <Button variant="outline" onClick={fetchServices}>
            Try Again
          </Button>
        }
      />
    );
  }

  const needAssignments = upcomingServices.filter((s) => s.assignmentCount < TOTAL_ROLES).length;
  const fullyStaffed = upcomingServices.filter((s) => s.assignmentCount >= TOTAL_ROLES).length;
  const [featured, ...restUpcoming] = upcomingServices;

  return (
    <div className="space-y-7">
      <PageHeader
        title="Services"
        description="Manage service schedules and rota assignments"
        icon={ClipboardList}
        tone="sage"
        actions={
          <Link href="/manage/services/new">
            <Button className="gap-2 rounded-xl shadow-sm">
              <Plus className="h-4 w-4" />
              Create Service
            </Button>
          </Link>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCardLux
          icon={Calendar}
          tone="teal"
          label="Upcoming"
          value={upcomingServices.length}
          hint="services scheduled"
          accent="bg-teal"
          art={<Calendar className="h-24 w-24" strokeWidth={1} />}
        />
        <StatCardLux
          icon={AlertCircle}
          tone="amber"
          label="Need Assignments"
          value={needAssignments}
          hint="still need a full rota"
          accent="bg-gold"
          highlight={needAssignments > 0}
          art={<Users className="h-24 w-24" strokeWidth={1} />}
        />
        <StatCardLux
          icon={CheckCircle2}
          tone="emerald"
          label="Fully Staffed"
          value={fullyStaffed}
          hint="ready to serve"
          accent="bg-green-500"
          art={<CheckCircle2 className="h-24 w-24" strokeWidth={1} />}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <SegmentedTabsList className="sm:max-w-md">
          <SegmentedTab value="upcoming" icon={Calendar} count={upcomingServices.length}>
            Upcoming
          </SegmentedTab>
          <SegmentedTab value="past" icon={Clock} count={pastServices.length}>
            Past
          </SegmentedTab>
        </SegmentedTabsList>

        <TabsContent value="upcoming" className="mt-0 space-y-4">
          {upcomingServices.length === 0 ? (
            <Card className={cn("border-0 bg-transparent shadow-none")}>
              <EmptyStateLux
                icon={Calendar}
                tone="sage"
                title="No upcoming services"
                description="Create a new service to get started with rota assignments."
                action={
                  <Link href="/manage/services/new">
                    <Button className="gap-2 rounded-xl">
                      <Plus className="h-4 w-4" />
                      Create Service
                    </Button>
                  </Link>
                }
              />
            </Card>
          ) : (
            <>
              {featured && <FeaturedServiceCard service={featured} />}
              {restUpcoming.length > 0 && (
                <div className="space-y-3">
                  {restUpcoming.map((service) => (
                    <ServiceCard key={service.id} service={service} />
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-0">
          {pastServices.length === 0 ? (
            <EmptyStateLux
              icon={Clock}
              tone="clay"
              title="No past services"
              description="Past services will appear here after their date has passed."
            />
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
      <ServicesListContent />
    </RoleProtected>
  );
}
