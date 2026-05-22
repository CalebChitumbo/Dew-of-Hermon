"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { RoleProtected } from "@/components/shared/RoleProtected";
import { useFundraisingAccess } from "@/hooks/useFundraisingAccess";
import { LoadingSpinner, PageLoader } from "@/components/shared/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { BraaiOrdersList } from "@/components/fundraising/BraaiOrdersList";
import { useFundraisingOrdersAccess } from "@/hooks/useFundraisingOrdersAccess";
import {
  ArrowLeft,
  Flame,
  Calendar,
  MapPin,
  Users,
  Trash2,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import {
  BRAAI_RESPONSIBILITIES,
  BRAAI_PHASE_LABELS,
  BRAAI_TOTAL_RESPONSIBILITIES,
} from "@/lib/braai";
import type { AssignmentStatus, BraaiPhase } from "@/types";

interface BraaiEvent {
  id: string;
  title: string;
  eventDate: string | null;
  venue: string | null;
  notes: string | null;
  createdBy: string;
  createdByName: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BraaiAssignment {
  id: string;
  braaiEventId: string;
  responsibilityKey: string;
  responsibilityName: string;
  phase: BraaiPhase;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string | null;
  status: AssignmentStatus;
  emailSent: boolean;
  emailSentAt: string | null;
  confirmedAt: string | null;
}

interface FundraisingMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isLead: boolean;
  isActive: boolean;
}

const PHASE_ORDER: BraaiPhase[] = ["PREPARATION", "EVENT_DAY"];

function BraaiDetailContent() {
  const params = useParams();
  const router = useRouter();
  const braaiId = params.id as string;
  const { firebaseUser, userData } = useAuth();
  const isSuperAdmin = userData?.role === "SUPER_ADMIN";
  const { canPlanBraai, loading: accessLoading } = useFundraisingAccess();
  const { canManageOrders, loading: ordersAccessLoading } =
    useFundraisingOrdersAccess();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"roster" | "orders">("roster");

  const [event, setEvent] = useState<BraaiEvent | null>(null);
  const [assignments, setAssignments] = useState<BraaiAssignment[]>([]);
  const [members, setMembers] = useState<FundraisingMember[]>([]);
  const [departmentExists, setDepartmentExists] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pendingSelection, setPendingSelection] = useState<
    Record<string, string>
  >({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [deleteEventOpen, setDeleteEventOpen] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(false);

  const load = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    setError(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const headers = { Authorization: `Bearer ${idToken}` };

      // Event metadata is shown to anyone who can manage either the roster
      // or the orders. Roster/member data only loads for planners.
      const eventRes = await fetch(
        `/api/fundraising/braai/events/${braaiId}`,
        { headers }
      );
      const eventData = await eventRes.json();
      if (!eventRes.ok)
        throw new Error(eventData?.error || `Event load HTTP ${eventRes.status}`);
      setEvent(eventData.event);

      if (canPlanBraai) {
        const [assignmentsRes, membersRes] = await Promise.all([
          fetch(`/api/fundraising/braai/events/${braaiId}/assignments`, {
            headers,
          }),
          fetch(`/api/fundraising/braai/department-members`, { headers }),
        ]);

        const assignmentsData = await assignmentsRes.json();
        const membersData = await membersRes.json();

        if (!assignmentsRes.ok)
          throw new Error(
            assignmentsData?.error || `Assignments load HTTP ${assignmentsRes.status}`
          );
        if (!membersRes.ok)
          throw new Error(
            membersData?.error || `Members load HTTP ${membersRes.status}`
          );

        setAssignments(assignmentsData.assignments || []);
        setMembers(membersData.members || []);
        setDepartmentExists(Boolean(membersData.departmentId));
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load braai");
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, braaiId, canPlanBraai]);

  useEffect(() => {
    if (
      !firebaseUser ||
      accessLoading ||
      ordersAccessLoading ||
      (!canPlanBraai && !canManageOrders)
    )
      return;
    load();
  }, [
    firebaseUser,
    accessLoading,
    ordersAccessLoading,
    canPlanBraai,
    canManageOrders,
    load,
  ]);

  // If the user can manage orders but can't plan, default the tab to "orders".
  useEffect(() => {
    if (!accessLoading && !ordersAccessLoading) {
      if (!canPlanBraai && canManageOrders) setActiveTab("orders");
    }
  }, [accessLoading, ordersAccessLoading, canPlanBraai, canManageOrders]);

  const assignmentByKey = useMemo(() => {
    const map: Record<string, BraaiAssignment> = {};
    assignments.forEach((a) => {
      map[a.responsibilityKey] = a;
    });
    return map;
  }, [assignments]);

  const assignedUserIds = useMemo(
    () => new Set(assignments.map((a) => a.userId)),
    [assignments]
  );

  const handleAssign = async (responsibilityKey: string) => {
    if (!firebaseUser) return;
    const userId = pendingSelection[responsibilityKey];
    if (!userId) return;
    setSavingKey(responsibilityKey);
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch(
        `/api/fundraising/braai/events/${braaiId}/assignments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ responsibilityKey, userId }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      toast({
        title: "Assigned",
        description: `${data.assignment.userName} has been notified by email.`,
        variant: "success",
      });
      setPendingSelection((prev) => {
        const next = { ...prev };
        delete next[responsibilityKey];
        return next;
      });
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to assign";
      toast({ title: "Assignment failed", description: msg, variant: "destructive" });
    } finally {
      setSavingKey(null);
    }
  };

  const handleRemove = async (assignmentId: string) => {
    if (!firebaseUser) return;
    setRemovingId(assignmentId);
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch(
        `/api/fundraising/braai/events/${braaiId}/assignments/${assignmentId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${idToken}` },
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      toast({ title: "Removed", description: "Assignment cleared." });
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to remove";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  };

  const handleDeleteEvent = async () => {
    if (!firebaseUser) return;
    setDeletingEvent(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch(`/api/fundraising/braai/events/${braaiId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      toast({
        title: "Braai deleted",
        description: "The braai event and its assignments have been removed.",
      });
      router.push("/manage/fundraising");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete braai";
      toast({ title: "Error", description: msg, variant: "destructive" });
      setDeletingEvent(false);
      setDeleteEventOpen(false);
    }
  };

  if (accessLoading || ordersAccessLoading) return <PageLoader />;

  if (!canPlanBraai && !canManageOrders) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-center">
        <div>
          <Flame className="h-12 w-12 text-clay-300 mx-auto mb-4" />
          <h2 className="text-2xl font-display text-clay-700">Fundraising</h2>
          <p className="mt-2 text-clay-500">
            You don&apos;t have access to this braai. Ask your chairperson to add
            you to the Fundraising department.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-gold mx-auto mb-4" />
          <h2 className="text-2xl font-display text-clay-700">Braai not found</h2>
          <p className="mt-2 text-clay-500 mb-4">{error || "This braai may have been deleted."}</p>
          <Link href="/manage/fundraising">
            <Button variant="outline">Back to Fundraising</Button>
          </Link>
        </div>
      </div>
    );
  }

  const date = event.eventDate ? new Date(event.eventDate) : null;
  const filledCount = assignments.length;
  const confirmed = assignments.filter((a) => a.status === "CONFIRMED").length;
  const pending = assignments.filter((a) => a.status === "PENDING").length;
  const declined = assignments.filter((a) => a.status === "DECLINED").length;
  const open = BRAAI_TOTAL_RESPONSIBILITIES - filledCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/manage/fundraising">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-clay-700 truncate">
            {event.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-clay-500">
            {date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {format(date, "EEEE, d MMMM yyyy")}
              </span>
            )}
            {event.venue && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {event.venue}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {filledCount}/{BRAAI_TOTAL_RESPONSIBILITIES} responsibilities assigned
            </span>
          </div>
          {event.notes && (
            <p className="mt-2 text-sm text-clay-600 max-w-prose">{event.notes}</p>
          )}
        </div>
        {isSuperAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteEventOpen(true)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 gap-1 shrink-0"
          >
            <Trash2 className="h-4 w-4" />
            Delete braai
          </Button>
        )}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "roster" | "orders")}
      >
        <TabsList>
          {canPlanBraai && <TabsTrigger value="roster">Roster</TabsTrigger>}
          {canManageOrders && <TabsTrigger value="orders">Orders</TabsTrigger>}
        </TabsList>

        {canPlanBraai && (
          <TabsContent value="roster" className="space-y-6 mt-4">
            {/* Stats */}
            <Card>
              <CardContent className="py-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center sm:text-left">
                  <div>
                    <p className="text-2xl font-display font-bold text-green-600">{confirmed}</p>
                    <p className="text-xs text-clay-500">Confirmed</p>
                  </div>
                  <div>
                    <p className="text-2xl font-display font-bold text-gold">{pending}</p>
                    <p className="text-xs text-clay-500">Pending</p>
                  </div>
                  <div>
                    <p className="text-2xl font-display font-bold text-red-500">{declined}</p>
                    <p className="text-xs text-clay-500">Declined</p>
                  </div>
                  <div>
                    <p className="text-2xl font-display font-bold text-clay-400">{open}</p>
                    <p className="text-xs text-clay-500">Unassigned</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {!departmentExists && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-4 flex items-start gap-3 text-amber-800">
                  <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">No Fundraising department found</p>
                    <p className="text-sm text-amber-700/90 mt-1">
                      Ask your chairperson to create a department called &quot;Fundraising&quot; and
                      add team members to it so you can assign responsibilities here.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {departmentExists && members.length === 0 && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-4 flex items-start gap-3 text-amber-800">
                  <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">No members in the Fundraising department yet</p>
                    <p className="text-sm text-amber-700/90 mt-1">
                      Add members to the Fundraising department before assigning responsibilities.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <RosterSections
              assignmentByKey={assignmentByKey}
              assignedUserIds={assignedUserIds}
              members={members}
              pendingSelection={pendingSelection}
              setPendingSelection={setPendingSelection}
              savingKey={savingKey}
              removingId={removingId}
              onAssign={handleAssign}
              onRemove={handleRemove}
              canDelete={isSuperAdmin}
            />
          </TabsContent>
        )}

        {canManageOrders && (
          <TabsContent value="orders" className="mt-4">
            <BraaiOrdersList braaiId={braaiId} braaiTitle={event.title} />
          </TabsContent>
        )}
      </Tabs>

      <Dialog
        open={deleteEventOpen}
        onOpenChange={(o) => !o && !deletingEvent && setDeleteEventOpen(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this braai?</DialogTitle>
            <DialogDescription>
              This will permanently remove &ldquo;{event.title}&rdquo; and all
              of its assignments. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteEventOpen(false)}
              disabled={deletingEvent}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteEvent}
              disabled={deletingEvent}
            >
              {deletingEvent ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete braai
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Roster sub-component (kept as-is, just lifted into its own function) ───
interface RosterSectionsProps {
  assignmentByKey: Record<string, BraaiAssignment>;
  assignedUserIds: Set<string>;
  members: FundraisingMember[];
  pendingSelection: Record<string, string>;
  setPendingSelection: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  savingKey: string | null;
  removingId: string | null;
  onAssign: (responsibilityKey: string) => void;
  onRemove: (assignmentId: string) => void;
  canDelete: boolean;
}

function RosterSections({
  assignmentByKey,
  assignedUserIds,
  members,
  pendingSelection,
  setPendingSelection,
  savingKey,
  removingId,
  onAssign,
  onRemove,
  canDelete,
}: RosterSectionsProps) {
  return (
    <>
      {PHASE_ORDER.map((phase) => {
        const phaseResponsibilities = BRAAI_RESPONSIBILITIES.filter(
          (r) => r.phase === phase
        );
        return (
          <section key={phase}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-lg font-display font-semibold text-clay-700">
                {BRAAI_PHASE_LABELS[phase]}
              </h2>
              <Badge variant="secondary" className="text-xs">
                {phaseResponsibilities.filter((r) => assignmentByKey[r.key]).length}/
                {phaseResponsibilities.length}
              </Badge>
            </div>
            <div className="space-y-3">
              {phaseResponsibilities.map((resp) => {
                const a = assignmentByKey[resp.key];
                const isFilled = Boolean(a);
                const selectedUserId = pendingSelection[resp.key] || "";
                const eligibleMembers = members.filter(
                  (m) => !assignedUserIds.has(m.id)
                );

                return (
                  <Card
                    key={resp.key}
                    className={`border-l-4 ${
                      isFilled
                        ? a.status === "CONFIRMED"
                          ? "border-l-green-500"
                          : a.status === "DECLINED"
                            ? "border-l-red-500"
                            : "border-l-gold"
                        : "border-l-clay-200"
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-clay-700">
                            {resp.name}
                          </p>
                          {isFilled ? (
                            <div className="mt-2 space-y-1">
                              <p className="text-sm text-clay-700">
                                <span className="font-semibold">{a.userName}</span>
                                <span className="text-clay-400"> · {a.userEmail}</span>
                              </p>
                              <div className="flex items-center gap-2 text-xs text-clay-500">
                                <StatusBadge status={a.status} />
                                {a.emailSent ? (
                                  <span className="inline-flex items-center gap-1 text-clay-400">
                                    <CheckCircle2 className="h-3 w-3" /> Notified
                                  </span>
                                ) : (
                                  <span className="text-clay-400">Notification queued</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p className="mt-1 text-xs text-clay-400 italic">Unassigned</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isFilled ? (
                            canDelete ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onRemove(a.id)}
                                disabled={removingId === a.id}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                              >
                                {removingId === a.id ? (
                                  <LoadingSpinner size="sm" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                                )}
                                Remove
                              </Button>
                            ) : null
                          ) : (
                            <div className="flex items-center gap-2">
                              <Select
                                value={selectedUserId}
                                onValueChange={(value) =>
                                  setPendingSelection((prev) => ({
                                    ...prev,
                                    [resp.key]: value,
                                  }))
                                }
                                disabled={
                                  members.length === 0 || savingKey === resp.key
                                }
                              >
                                <SelectTrigger className="w-[220px]">
                                  <SelectValue
                                    placeholder={
                                      members.length === 0
                                        ? "No members available"
                                        : "Pick a member..."
                                    }
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {eligibleMembers.length === 0 ? (
                                    <div className="px-3 py-2 text-xs text-clay-400">
                                      Everyone is already assigned.
                                    </div>
                                  ) : (
                                    eligibleMembers.map((m) => (
                                      <SelectItem key={m.id} value={m.id}>
                                        {m.name}
                                        {m.isLead && (
                                          <span className="text-clay-400 ml-1">(Lead)</span>
                                        )}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                variant="teal"
                                disabled={
                                  !selectedUserId ||
                                  savingKey === resp.key ||
                                  members.length === 0
                                }
                                onClick={() => onAssign(resp.key)}
                              >
                                {savingKey === resp.key ? (
                                  <LoadingSpinner size="sm" />
                                ) : (
                                  "Assign"
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}

export default function BraaiDetailPage() {
  return (
    <RoleProtected pageKey="fundraising" fallback={<BraaiDetailFallback />}>
      <BraaiDetailContent />
    </RoleProtected>
  );
}

function BraaiDetailFallback() {
  const { canPlanBraai, loading: planLoading } = useFundraisingAccess();
  const { canManageOrders, loading: orderLoading } =
    useFundraisingOrdersAccess();
  if (planLoading || orderLoading) return <PageLoader />;
  if (canPlanBraai || canManageOrders) return <BraaiDetailContent />;
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-display text-clay-700">Access Denied</h2>
        <p className="mt-2 text-clay-500">
          You don&apos;t have permission to view this page.
        </p>
      </div>
    </div>
  );
}
