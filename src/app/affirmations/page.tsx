"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDoc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { safeCollection, safeDoc } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Affirmation, Service, AppEvent } from "@/types";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Sparkles,
  Plus,
  CalendarDays,
  User,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";

export default function AffirmationsPage() {
  const { userData } = useAuth();
  const { canManageAffirmations: canManageAffirmationsFlag } = usePermissions();
  const [affirmations, setAffirmations] = useState<Affirmation[]>([]);
  const [services, setServices] = useState<Map<string, Service>>(new Map());
  const [events, setEvents] = useState<Map<string, AppEvent>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    // Only the latest affirmation plus a collapsed "previous" list is shown,
    // so cap the live query instead of streaming the whole collection.
    const affirmationsQuery = query(
      safeCollection("affirmations"),
      orderBy("createdAt", "desc"),
      limit(25)
    );

    const unsub = onSnapshot(affirmationsQuery, (snapshot) => {
      const data = snapshot.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          ...raw,
          createdAt: raw.createdAt?.toDate?.() || new Date(),
          updatedAt: raw.updatedAt?.toDate?.() || new Date(),
        } as Affirmation;
      });
      setAffirmations(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Resolve service→event dates for just the affirmations on screen instead
  // of subscribing to the entire services and events collections.
  useEffect(() => {
    const serviceIds = Array.from(
      new Set(
        affirmations
          .map((a) => a.serviceId)
          .filter((id): id is string => !!id)
      )
    ).filter((id) => !services.has(id));
    if (serviceIds.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const serviceSnaps = await Promise.all(
          serviceIds.map((id) => getDoc(safeDoc("services", id)))
        );
        const newServices: Service[] = [];
        serviceSnaps.forEach((snap) => {
          if (!snap.exists()) return;
          const data = snap.data();
          newServices.push({
            id: snap.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
          } as Service);
        });

        const eventIds = Array.from(
          new Set(newServices.map((s) => s.eventId).filter(Boolean))
        );
        const eventSnaps = await Promise.all(
          eventIds.map((id) => getDoc(safeDoc("events", id)))
        );
        if (cancelled) return;

        setServices((prev) => {
          const next = new Map(prev);
          newServices.forEach((s) => next.set(s.id, s));
          return next;
        });
        setEvents((prev) => {
          const next = new Map(prev);
          eventSnaps.forEach((snap) => {
            if (!snap.exists()) return;
            const data = snap.data();
            next.set(snap.id, {
              id: snap.id,
              ...data,
              startDate: data.startDate?.toDate?.() || new Date(),
              endDate: data.endDate?.toDate?.() || null,
              createdAt: data.createdAt?.toDate?.() || new Date(),
              updatedAt: data.updatedAt?.toDate?.() || new Date(),
            } as AppEvent);
          });
          return next;
        });
      } catch (error) {
        console.error("Failed to load service dates for affirmations:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [affirmations]);

  const getServiceDate = (serviceId: string | null): Date | null => {
    if (!serviceId) return null;
    const service = services.get(serviceId);
    if (!service) return null;
    const event = events.get(service.eventId);
    return event?.startDate || null;
  };

  const latestAffirmation = affirmations[0] || null;
  const pastAffirmations = affirmations.slice(1);

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
        icon={Sparkles}
        tone="blush"
        title="Affirmations"
        description="Potter's Wheel words of encouragement and affirmation"
        actions={
          userData && canManageAffirmationsFlag ? (
            <Link href="/manage/affirmations">
              <Button variant="gold">
                <Plus className="mr-2 h-4 w-4" />
                Create New
              </Button>
            </Link>
          ) : undefined
        }
      />

      {/* Empty state */}
      {affirmations.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          tone="blush"
          title="No Affirmations Yet"
          description="Affirmations will appear here as they are shared by leadership."
        />
      ) : (
        <>
          {/* Latest Affirmation - Featured */}
          {latestAffirmation && (
            <Card className="border-gold/40 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-gold via-gold-dark to-gold" />
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <Badge variant="gold" className="mb-2">Latest</Badge>
                    <CardTitle className="text-xl md:text-2xl text-clay-700">
                      {latestAffirmation.title}
                    </CardTitle>
                  </div>
                  <Sparkles className="h-6 w-6 text-gold shrink-0" />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-clay-400">
                  <span className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {latestAffirmation.authorName}
                  </span>
                  {latestAffirmation.serviceId && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {(() => {
                        const svcDate = getServiceDate(latestAffirmation.serviceId);
                        return svcDate
                          ? format(svcDate, "EEEE, MMMM d, yyyy")
                          : "Linked service";
                      })()}
                    </span>
                  )}
                  <span>
                    {format(latestAffirmation.createdAt, "MMM d, yyyy")}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-clay max-w-none">
                  <p className="text-clay-600 whitespace-pre-wrap leading-relaxed">
                    {latestAffirmation.content}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Past Affirmations */}
          {pastAffirmations.length > 0 && (
            <div>
              <SectionHeading className="mb-4">Previous Affirmations</SectionHeading>
              <div className="space-y-3">
                {pastAffirmations.map((affirmation) => {
                  const isExpanded = expandedId === affirmation.id;
                  const svcDate = getServiceDate(affirmation.serviceId);

                  return (
                    <Card
                      key={affirmation.id}
                      className="overflow-hidden transition-all hover:bg-white hover:shadow-[0_8px_24px_-16px_rgba(91,58,41,0.18)]"
                    >
                      <button
                        className="w-full text-left"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : affirmation.id)
                        }
                      >
                        <CardContent className="flex items-center justify-between p-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-display font-semibold text-clay-700 truncate">
                              {affirmation.title}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-clay-400 mt-1">
                              <span>{affirmation.authorName}</span>
                              <span>&middot;</span>
                              <span>
                                {format(affirmation.createdAt, "MMM d, yyyy")}
                              </span>
                              {svcDate && (
                                <>
                                  <span>&middot;</span>
                                  <span className="flex items-center gap-1">
                                    <CalendarDays className="h-3 w-3" />
                                    {format(svcDate, "MMM d")}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-clay-400 shrink-0 ml-2" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-clay-400 shrink-0 ml-2" />
                          )}
                        </CardContent>
                      </button>
                      {isExpanded && (
                        <>
                          <Separator />
                          <CardContent className="p-4 pt-4">
                            <p className="text-clay-600 whitespace-pre-wrap leading-relaxed text-sm">
                              {affirmation.content}
                            </p>
                          </CardContent>
                        </>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
