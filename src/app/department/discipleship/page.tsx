"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  Users,
  Phone,
  Calendar,
  ArrowRight,
  UserPlus,
  BarChart3,
  GraduationCap,
  Heart,
  Filter,
  ChevronRight,
  TrendingUp,
  UserCheck,
  Clock,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Department, FollowUpCard, FollowUpStatus, User } from "@/types";

const STATUS_ORDER: FollowUpStatus[] = [
  "NEW_CONTACT",
  "CONTACTED",
  "FIRST_VISIT",
  "REGULAR_ATTENDEE",
  "MEMBER",
];

const STATUS_LABELS: Record<FollowUpStatus, string> = {
  NEW_CONTACT: "New Contact",
  CONTACTED: "Contacted",
  FIRST_VISIT: "First Visit",
  REGULAR_ATTENDEE: "Regular Attendee",
  MEMBER: "Member",
};

const STATUS_COLORS: Record<FollowUpStatus, string> = {
  NEW_CONTACT: "bg-gray-100 border-gray-300",
  CONTACTED: "bg-yellow-50 border-yellow-300",
  FIRST_VISIT: "bg-blue-50 border-blue-300",
  REGULAR_ATTENDEE: "bg-green-50 border-green-300",
  MEMBER: "bg-purple-50 border-purple-300",
};

const STATUS_BADGE_VARIANT: Record<
  FollowUpStatus,
  "default" | "secondary" | "warning" | "success" | "gold"
> = {
  NEW_CONTACT: "secondary",
  CONTACTED: "warning",
  FIRST_VISIT: "gold",
  REGULAR_ATTENDEE: "success",
  MEMBER: "default",
};

const SOURCE_LABELS: Record<string, string> = {
  CAMPUS_MINISTRY: "Campus",
  LIFE_GROUPS: "Life Groups",
};

export default function DiscipleshipPipelinePage() {
  const { userData } = useAuth();
  const { checkFeatureAccess } = usePermissions();
  const router = useRouter();
  const { toast } = useToast();
  const [cards, setCards] = useState<FollowUpCard[]>([]);
  const [discipleshipDeptId, setDiscipleshipDeptId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  // Filter state
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");

  // Detail dialog
  const [selectedCard, setSelectedCard] = useState<FollowUpCard | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editAssignee, setEditAssignee] = useState("");

  // Member registration dialog
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [registerCard, setRegisterCard] = useState<FollowUpCard | null>(null);

  // Get Discipleship department ID
  useEffect(() => {
    const unsub = onSnapshot(safeCollection("departments"), (snapshot) => {
      const depts = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
      })) as Department[];

      const discDept = depts.find((d) => d.name === "Discipleship & Follow-Up");
      setDiscipleshipDeptId(discDept?.id || null);
    });
    return () => unsub();
  }, []);

  // Check access via configurable feature permissions
  const hasAccess = useMemo(() => {
    if (!userData || !discipleshipDeptId) return false;
    return checkFeatureAccess(
      "manage_follow_ups",
      userData.departmentIds,
      userData.leadsDepartmentIds,
      { "Discipleship & Follow-Up": discipleshipDeptId }
    );
  }, [userData, discipleshipDeptId, checkFeatureAccess]);

  // Fetch cards from API (fallback when onSnapshot fails)
  const fetchCardsFromApi = useCallback(async () => {
    try {
      const res = await fetch("/api/follow-up-cards");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apiCards = (data.cards || []).map((c: any) => ({
        ...c,
        dateOfContact: c.dateOfContact ? new Date(c.dateOfContact) : new Date(),
        createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
        updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
        statusHistory: (c.statusHistory || []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (h: any) => ({
            ...h,
            changedAt: h.changedAt ? new Date(h.changedAt) : new Date(),
          })
        ),
      })) as FollowUpCard[];
      setCards(apiCards);
    } catch (err) {
      console.error("API fallback also failed:", err);
    }
  }, []);

  // Load all follow-up cards
  useEffect(() => {
    const q = query(
      safeCollection("followUpCards"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const allCards = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            dateOfContact: data.dateOfContact?.toDate?.() || new Date(),
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
            statusHistory: (data.statusHistory || []).map(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (h: any) => ({
                ...h,
                changedAt: h.changedAt?.toDate?.() || new Date(),
              })
            ),
          } as FollowUpCard;
        });
        setCards(allCards);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading follow-up cards:", error);
        // Fallback: fetch via API when real-time listener fails
        fetchCardsFromApi().finally(() => setLoading(false));
      }
    );

    return () => unsub();
  }, [fetchCardsFromApi]);

  // Load team members for assignment
  useEffect(() => {
    if (!discipleshipDeptId) return;

    const q = query(
      safeCollection("users"),
      where("departmentIds", "array-contains", discipleshipDeptId),
      where("isActive", "==", true)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const members = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
        updatedAt: d.data().updatedAt?.toDate?.() || new Date(),
      })) as User[];
      setTeamMembers(members);
    });

    return () => unsub();
  }, [discipleshipDeptId]);

  // Filtered cards
  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      if (sourceFilter !== "ALL" && card.source !== sourceFilter) return false;
      if (assigneeFilter !== "ALL") {
        if (assigneeFilter === "UNASSIGNED" && card.assigneeId) return false;
        if (
          assigneeFilter !== "UNASSIGNED" &&
          card.assigneeId !== assigneeFilter
        )
          return false;
      }
      return true;
    });
  }, [cards, sourceFilter, assigneeFilter]);

  // Group cards by status for Kanban
  const cardsByStatus = useMemo(() => {
    const grouped: Record<FollowUpStatus, FollowUpCard[]> = {
      NEW_CONTACT: [],
      CONTACTED: [],
      FIRST_VISIT: [],
      REGULAR_ATTENDEE: [],
      MEMBER: [],
    };
    for (const card of filteredCards) {
      if (grouped[card.status]) {
        grouped[card.status].push(card);
      }
    }
    return grouped;
  }, [filteredCards]);

  // Analytics
  const analytics = useMemo(() => {
    const total = cards.length;
    const byCampus = cards.filter((c) => c.source === "CAMPUS_MINISTRY").length;
    const byLifeGroups = cards.filter((c) => c.source === "LIFE_GROUPS").length;
    const memberCount = cards.filter((c) => c.status === "MEMBER").length;

    // Conversion rates
    const statusCounts: Record<FollowUpStatus, number> = {
      NEW_CONTACT: 0,
      CONTACTED: 0,
      FIRST_VISIT: 0,
      REGULAR_ATTENDEE: 0,
      MEMBER: 0,
    };
    for (const card of cards) {
      statusCounts[card.status]++;
    }

    // Cards that reached each stage (including those who have moved past it)
    const reachedStage: Record<FollowUpStatus, number> = {
      NEW_CONTACT: total,
      CONTACTED: 0,
      FIRST_VISIT: 0,
      REGULAR_ATTENDEE: 0,
      MEMBER: 0,
    };
    for (const card of cards) {
      const idx = STATUS_ORDER.indexOf(card.status);
      for (let i = 1; i <= idx; i++) {
        reachedStage[STATUS_ORDER[i]]++;
      }
    }

    // Average time in each stage
    const stageDurations: Record<FollowUpStatus, number[]> = {
      NEW_CONTACT: [],
      CONTACTED: [],
      FIRST_VISIT: [],
      REGULAR_ATTENDEE: [],
      MEMBER: [],
    };
    for (const card of cards) {
      const history = card.statusHistory || [];
      for (let i = 0; i < history.length - 1; i++) {
        const curr = history[i];
        const next = history[i + 1];
        if (curr.changedAt && next.changedAt) {
          const days = differenceInDays(
            new Date(next.changedAt),
            new Date(curr.changedAt)
          );
          if (stageDurations[curr.status as FollowUpStatus]) {
            stageDurations[curr.status as FollowUpStatus].push(days);
          }
        }
      }
    }

    const avgDays: Record<string, number | null> = {};
    for (const status of STATUS_ORDER) {
      const durations = stageDurations[status];
      avgDays[status] =
        durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : null;
    }

    return {
      total,
      byCampus,
      byLifeGroups,
      memberCount,
      statusCounts,
      reachedStage,
      avgDays,
      conversionRate:
        total > 0 ? Math.round((memberCount / total) * 100) : 0,
    };
  }, [cards]);

  const handleAdvanceStatus = useCallback(
    async (card: FollowUpCard) => {
      const currentIndex = STATUS_ORDER.indexOf(card.status);
      if (currentIndex >= STATUS_ORDER.length - 1) return;

      const nextStatus = STATUS_ORDER[currentIndex + 1];
      setUpdating(card.id);

      try {
        const res = await fetch(`/api/follow-up-cards/${card.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to update status");
        }

        const data = await res.json();

        // If reached MEMBER status, show registration prompt
        if (data.reachedMember) {
          setRegisterCard(card);
          setRegisterDialogOpen(true);
        }
      } catch (error) {
        console.error("Error advancing status:", error);
        toast({
          title: "Failed to update status",
          description: error instanceof Error ? error.message : "Something went wrong.",
          variant: "destructive",
        });
      }
      setUpdating(null);
    },
    []
  );

  const handleAssignMember = async (
    cardId: string,
    assigneeId: string,
    assigneeName: string
  ) => {
    try {
      const res = await fetch(`/api/follow-up-cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId, assigneeName }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to assign member");
      }
    } catch (error) {
      console.error("Error assigning member:", error);
      toast({
        title: "Failed to assign member",
        description: error instanceof Error ? error.message : "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateNotes = async (cardId: string, notes: string) => {
    try {
      const res = await fetch(`/api/follow-up-cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update notes");
      }
    } catch (error) {
      console.error("Error updating notes:", error);
    }
  };

  const openCardDetail = (card: FollowUpCard) => {
    setSelectedCard(card);
    setEditNotes(card.notes || "");
    setEditAssignee(card.assigneeId || "");
    setDetailDialogOpen(true);
  };

  const handleSaveDetail = async () => {
    if (!selectedCard) return;

    setUpdating(selectedCard.id);

    const assignee = teamMembers.find((m) => m.id === editAssignee);

    try {
      await fetch(`/api/follow-up-cards/${selectedCard.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: editNotes,
          assigneeId: editAssignee || null,
          assigneeName: assignee?.name || null,
        }),
      });
      setDetailDialogOpen(false);
    } catch (error) {
      console.error("Error saving card detail:", error);
    }
    setUpdating(null);
  };

  const handleBeginRegistration = () => {
    if (!registerCard) return;
    const params = new URLSearchParams();
    params.set("prefillName", registerCard.name);
    if (registerCard.phone) params.set("prefillPhone", registerCard.phone);
    router.push(`/manage/members/new?${params.toString()}`);
    setRegisterDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Heart className="h-12 w-12 text-clay-300 mb-4" />
        <h2 className="text-xl font-display font-semibold text-clay-600">
          Access Restricted
        </h2>
        <p className="text-clay-400 mt-2 text-center max-w-md">
          This page is only accessible to Discipleship & Follow-Up department
          members.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-700">
          Discipleship Pipeline
        </h1>
        <p className="text-clay-500 mt-1">
          Track and manage follow-up contacts through their discipleship journey
        </p>
      </div>

      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline Board</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Pipeline Board Tab */}
        <TabsContent value="pipeline" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-clay-400" />
              <span className="text-sm text-clay-500">Filter:</span>
            </div>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Sources</SelectItem>
                <SelectItem value="CAMPUS_MINISTRY">Campus Ministry</SelectItem>
                <SelectItem value="LIFE_GROUPS">Life Groups</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Assignees</SelectItem>
                <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                {teamMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="ml-auto">
              {filteredCards.length} contact{filteredCards.length !== 1 ? "s" : ""}
            </Badge>
          </div>

          {/* Kanban Board */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {STATUS_ORDER.map((status) => (
              <div key={status} className="space-y-3">
                <div
                  className={`rounded-lg border-2 p-3 ${STATUS_COLORS[status]}`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-clay-700">
                      {STATUS_LABELS[status]}
                    </h3>
                    <Badge variant="outline" className="text-xs">
                      {cardsByStatus[status].length}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2 min-h-[100px]">
                  {cardsByStatus[status].length === 0 ? (
                    <div className="text-center py-6 text-xs text-clay-400">
                      No contacts
                    </div>
                  ) : (
                    cardsByStatus[status].map((card) => (
                      <Card
                        key={card.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => openCardDetail(card)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between mb-2">
                            <p className="text-sm font-medium text-clay-700 truncate">
                              {card.name}
                            </p>
                            <Badge
                              variant={
                                card.source === "CAMPUS_MINISTRY"
                                  ? "gold"
                                  : "secondary"
                              }
                              className="text-[10px] ml-1 shrink-0"
                            >
                              {SOURCE_LABELS[card.source]}
                            </Badge>
                          </div>
                          <div className="space-y-1 text-xs text-clay-500">
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              <span>{card.phone}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>
                                {format(card.dateOfContact, "MMM d")}
                              </span>
                            </div>
                          </div>
                          {card.assigneeName && (
                            <div className="mt-2 pt-2 border-t border-clay-100 text-xs text-clay-500">
                              {card.assigneeName}
                            </div>
                          )}
                          {/* Advance button */}
                          {status !== "MEMBER" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full mt-2 text-xs h-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAdvanceStatus(card);
                              }}
                              disabled={updating === card.id}
                            >
                              {updating === card.id ? (
                                <LoadingSpinner size="sm" />
                              ) : (
                                <>
                                  Advance
                                  <ArrowRight className="ml-1 h-3 w-3" />
                                </>
                              )}
                            </Button>
                          )}
                          {/* Member registration trigger */}
                          {status === "MEMBER" && (
                            <Button
                              variant="gold"
                              size="sm"
                              className="w-full mt-2 text-xs h-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRegisterCard(card);
                                setRegisterDialogOpen(true);
                              }}
                            >
                              <UserPlus className="mr-1 h-3 w-3" />
                              Register as Member
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-clay-100">
                    <Users className="h-5 w-5 text-clay-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-clay-700">
                      {analytics.total}
                    </p>
                    <p className="text-xs text-clay-500">Total Contacts</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/20">
                    <GraduationCap className="h-5 w-5 text-gold-dark" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-clay-700">
                      {analytics.byCampus}
                    </p>
                    <p className="text-xs text-clay-500">From Campus Ministry</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100">
                    <Heart className="h-5 w-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-clay-700">
                      {analytics.byLifeGroups}
                    </p>
                    <p className="text-xs text-clay-500">From Life Groups</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                    <UserCheck className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-clay-700">
                      {analytics.memberCount}
                    </p>
                    <p className="text-xs text-clay-500">Reached Member</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Conversion Funnel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-gold-dark" />
                Conversion Funnel
              </CardTitle>
              <CardDescription>
                How contacts progress through the pipeline
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {STATUS_ORDER.map((status, index) => {
                const count = analytics.statusCounts[status];
                const reached = analytics.reachedStage[status];
                const percent =
                  analytics.total > 0
                    ? Math.round((reached / analytics.total) * 100)
                    : 0;

                return (
                  <div key={status} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={STATUS_BADGE_VARIANT[status]}
                          className="text-xs"
                        >
                          {STATUS_LABELS[status]}
                        </Badge>
                        <span className="text-clay-500">
                          {count} currently
                        </span>
                      </div>
                      <span className="text-clay-700 font-medium">
                        {reached} reached ({percent}%)
                      </span>
                    </div>
                    <Progress value={percent} className="h-2" />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Average Time in Stage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-gold-dark" />
                Average Time in Stage
              </CardTitle>
              <CardDescription>
                How long contacts typically spend at each stage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {STATUS_ORDER.slice(0, -1).map((status) => (
                  <div
                    key={status}
                    className="flex items-center gap-3 p-3 rounded-lg bg-clay-50"
                  >
                    <div className="flex-1">
                      <p className="text-xs text-clay-500">
                        {STATUS_LABELS[status]}
                      </p>
                      <p className="text-lg font-bold text-clay-700">
                        {analytics.avgDays[status] !== null
                          ? `${analytics.avgDays[status]} days`
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Overall Conversion Rate */}
          <Card className="border-gold/30 bg-gold/5">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <h3 className="font-display font-semibold text-clay-700">
                  Overall Conversion Rate
                </h3>
                <p className="text-sm text-clay-500 mt-1">
                  Percentage of contacts that have reached Member status
                </p>
              </div>
              <div className="text-3xl font-bold text-gold-dark">
                {analytics.conversionRate}%
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Card Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedCard?.name}</DialogTitle>
            <DialogDescription>
              Follow-up card details and management
            </DialogDescription>
          </DialogHeader>
          {selectedCard && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge
                  variant={STATUS_BADGE_VARIANT[selectedCard.status]}
                >
                  {STATUS_LABELS[selectedCard.status]}
                </Badge>
                <Badge
                  variant={
                    selectedCard.source === "CAMPUS_MINISTRY"
                      ? "gold"
                      : "secondary"
                  }
                >
                  {SOURCE_LABELS[selectedCard.source]}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-clay-500">Phone</p>
                  <p className="font-medium text-clay-700">
                    {selectedCard.phone}
                  </p>
                </div>
                <div>
                  <p className="text-clay-500">Source Detail</p>
                  <p className="font-medium text-clay-700">
                    {selectedCard.sourceDetail}
                  </p>
                </div>
                <div>
                  <p className="text-clay-500">Date of Contact</p>
                  <p className="font-medium text-clay-700">
                    {format(selectedCard.dateOfContact, "MMM d, yyyy")}
                  </p>
                </div>
                <div>
                  <p className="text-clay-500">Submitted By</p>
                  <p className="font-medium text-clay-700">
                    {selectedCard.createdByName}
                  </p>
                </div>
              </div>

              {selectedCard.reason && (
                <div className="text-sm">
                  <p className="text-clay-500">Reason</p>
                  <p className="font-medium text-clay-700">
                    {selectedCard.reason.replace(/_/g, " ")}
                  </p>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <Label>Assign Team Member</Label>
                <Select
                  value={editAssignee}
                  onValueChange={setEditAssignee}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {teamMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  placeholder="Add notes about this contact..."
                />
              </div>

              {/* Status History */}
              {selectedCard.statusHistory.length > 0 && (
                <div className="space-y-2">
                  <Label>Status History</Label>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {selectedCard.statusHistory.map((h, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs text-clay-500"
                      >
                        <Badge
                          variant={
                            STATUS_BADGE_VARIANT[h.status as FollowUpStatus] ||
                            "secondary"
                          }
                          className="text-[10px]"
                        >
                          {STATUS_LABELS[h.status as FollowUpStatus] ||
                            h.status}
                        </Badge>
                        <span>
                          {h.changedAt
                            ? format(
                                new Date(h.changedAt),
                                "MMM d, yyyy HH:mm"
                              )
                            : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDetailDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="gold"
              onClick={handleSaveDetail}
              disabled={updating === selectedCard?.id}
            >
              {updating === selectedCard?.id ? (
                <LoadingSpinner size="sm" />
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Registration Trigger Dialog */}
      <Dialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-gold-dark" />
              Begin Member Registration
            </DialogTitle>
            <DialogDescription>
              {registerCard?.name} has reached Member status in the discipleship
              pipeline. Would you like to register them as a church member?
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm text-green-800">
              The registration form will be pre-filled with:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-green-700">
              <li>
                <strong>Name:</strong> {registerCard?.name}
              </li>
              <li>
                <strong>Phone:</strong> {registerCard?.phone}
              </li>
            </ul>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRegisterDialogOpen(false)}
            >
              Later
            </Button>
            <Button variant="gold" onClick={handleBeginRegistration}>
              Begin Registration
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
