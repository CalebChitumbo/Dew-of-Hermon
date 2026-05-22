"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  onSnapshot,
  setDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { safeCollection, safeDoc } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvailability, AssignmentStatus } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
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

interface EnrichedAssignment {
  id: string;
  kind?: "service" | "braai";
  parentId?: string;
  serviceId: string;
  roleId: string;
  roleName: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: AssignmentStatus;
  serviceDate?: Date | null;
  serviceTime?: string | null;
  eventTitle?: string | null;
  venue?: string | null;
  theme?: string | null;
  arrivalTime?: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string | null;
}

function buildAssignmentUrl(assignment: EnrichedAssignment): string {
  if (assignment.kind === "braai") {
    return `/api/fundraising/braai/events/${assignment.parentId ?? assignment.serviceId}/assignments/${assignment.id}`;
  }
  return `/api/services/${assignment.serviceId}/assignments/${assignment.id}`;
}

export default function MySchedulePage() {
  const { firebaseUser, userData } = useAuth();
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<EnrichedAssignment[]>([]);
  const [availability, setAvailability] = useState<UserAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Availability form state
  const [unavailableDate, setUnavailableDate] = useState("");
  const [unavailableReason, setUnavailableReason] = useState("");
  const [savingAvailability, setSavingAvailability] = useState(false);

  // Fetch assignments via server-side API (bypasses Firestore rules)
  const fetchAssignments = useCallback(async () => {
    if (!firebaseUser) return;

    try {
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch("/api/my-assignments", {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch assignments");
      }

      const data = await response.json();
      const enriched = data.assignments.map((a: EnrichedAssignment & { serviceDate?: string | null }) => ({
        ...a,
        serviceDate: a.serviceDate ? new Date(a.serviceDate) : null,
      }));
      setAssignments(enriched);
      setQueryError(null);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      setQueryError(error instanceof Error ? error.message : "Failed to load assignments");
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  // Fetch assignments on mount and when user changes
  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

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
      },
      (error) => {
        console.error("Error listening to availability:", error);
      }
    );

    return () => unsubAvailability();
  }, [firebaseUser]);

  const upcomingAssignments = assignments
    .filter((a) => {
      if (!a.serviceDate) return true;
      return isFuture(a.serviceDate) || isToday(a.serviceDate);
    })
    .sort((a, b) => {
      if (!a.serviceDate && !b.serviceDate) return 0;
      if (!a.serviceDate) return -1;
      if (!b.serviceDate) return 1;
      return a.serviceDate.getTime() - b.serviceDate.getTime();
    });

  const pastAssignments = assignments
    .filter((a) => a.serviceDate && isPast(a.serviceDate) && !isToday(a.serviceDate))
    .sort((a, b) => (b.serviceDate!.getTime() - a.serviceDate!.getTime()))
    .slice(0, 5);

  // Mark unread notifications related to an assignment as read
  const markRelatedNotificationsAsRead = async (roleName: string) => {
    if (!firebaseUser) return;
    try {
      const q = query(
        safeCollection("notifications"),
        where("userId", "==", firebaseUser.uid),
        where("isRead", "==", false)
      );
      const snapshot = await getDocs(q);
      const updatePromises = snapshot.docs
        .filter((doc) => {
          const title = doc.data().title as string;
          return title?.includes(roleName);
        })
        .map((doc) => updateDoc(safeDoc("notifications", doc.id), { isRead: true }));
      await Promise.all(updatePromises);
    } catch (error) {
      console.error("Failed to mark related notifications as read:", error);
    }
  };

  const handleConfirm = async (assignmentId: string) => {
    if (!firebaseUser) return;
    setActionLoading(assignmentId);
    try {
      const idToken = await firebaseUser.getIdToken();
      // Find the assignment to get serviceId
      const assignment = assignments.find((a) => a.id === assignmentId);
      if (!assignment) throw new Error("Assignment not found");

      const response = await fetch(buildAssignmentUrl(assignment), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          status: "CONFIRMED",
          callerRole: userData?.role,
          callerId: firebaseUser.uid,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to confirm assignment");
      }

      toast({
        title: "Assignment confirmed",
        description: "You have confirmed your assignment.",
        variant: "success",
      });
      markRelatedNotificationsAsRead(assignment.roleName);
      // Refresh assignments from API
      fetchAssignments();
    } catch (error) {
      console.error("Error confirming assignment:", error);
      toast({
        title: "Error",
        description: "Failed to confirm assignment. Please try again.",
        variant: "destructive",
      });
    }
    setActionLoading(null);
  };

  const handleDecline = async (assignmentId: string) => {
    if (!firebaseUser) return;
    setActionLoading(assignmentId);
    try {
      const idToken = await firebaseUser.getIdToken();
      const assignment = assignments.find((a) => a.id === assignmentId);
      if (!assignment) throw new Error("Assignment not found");

      const response = await fetch(buildAssignmentUrl(assignment), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          status: "DECLINED",
          callerRole: userData?.role,
          callerId: firebaseUser.uid,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to decline assignment");
      }

      toast({
        title: "Assignment declined",
        description: "You have declined this assignment.",
      });
      markRelatedNotificationsAsRead(assignment.roleName);
      fetchAssignments();
    } catch (error) {
      console.error("Error declining assignment:", error);
      toast({
        title: "Error",
        description: "Failed to decline assignment. Please try again.",
        variant: "destructive",
      });
    }
    setActionLoading(null);
  };

  const handleSetUnavailable = async () => {
    if (!firebaseUser || !unavailableDate) return;
    setSavingAvailability(true);
    try {
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
        {queryError ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
              <h3 className="text-lg font-display font-semibold text-clay-600">
                Unable to Load Assignments
              </h3>
              <p className="text-clay-400 text-sm mt-1 text-center max-w-md">
                There was a problem loading your assignments. Please try refreshing the page.
              </p>
            </CardContent>
          </Card>
        ) : upcomingAssignments.length === 0 ? (
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
                      {userData?.role === "SUPER_ADMIN" && (
                        <button
                          onClick={() => handleRemoveUnavailable(a.date)}
                          className="ml-1 hover:text-red-500 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
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
