"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useAccessControl } from "@/contexts/AccessControlContext";
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
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Users,
  Plus,
  Phone,
  User as UserIcon,
  Calendar,
  FileText,
  Heart,
  BookOpen,
  Pencil,
  XCircle,
} from "lucide-react";
import { format, startOfWeek } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Department, Devotional, FollowUpCard, FollowUpReason } from "@/types";

function isoWeekStart(d: Date): string {
  return startOfWeek(d, { weekStartsOn: 1 }).toISOString().split("T")[0];
}

const STATUS_LABELS: Record<string, string> = {
  NEW_CONTACT: "New Contact",
  CONTACTED: "Contacted",
  FIRST_VISIT: "First Visit",
  REGULAR_ATTENDEE: "Regular Attendee",
  MEMBER: "Member",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "warning" | "success" | "gold"> = {
  NEW_CONTACT: "secondary",
  CONTACTED: "warning",
  FIRST_VISIT: "gold",
  REGULAR_ATTENDEE: "success",
  MEMBER: "default",
};

const LIFE_GROUP_OPTIONS = [
  { value: "Bridge", label: "Bridge (15-20 years)" },
  { value: "Anchor", label: "Anchor (21-25 years)" },
  { value: "Cornerstone", label: "Cornerstone (26+ years)" },
];

const REASON_OPTIONS: { value: FollowUpReason; label: string }[] = [
  { value: "NEW_VISITOR", label: "New Visitor" },
  { value: "RETURNING_AFTER_ABSENCE", label: "Returning After Absence" },
  { value: "NEEDS_PASTORAL_SUPPORT", label: "Needs Pastoral Support" },
  { value: "OTHER", label: "Other" },
];

export default function LifeGroupsPage() {
  const { userData } = useAuth();
  const { checkFeatureAccess } = usePermissions();
  const { loading: acLoading } = useAccessControl();
  const { toast } = useToast();
  const [lifeGroupsDeptId, setLifeGroupsDeptId] = useState<string | null>(null);
  const [myCards, setMyCards] = useState<FollowUpCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formLifeGroup, setFormLifeGroup] = useState("");
  const [formReason, setFormReason] = useState<FollowUpReason | "">("");
  const [formDate, setFormDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [formNotes, setFormNotes] = useState("");

  // Devotional state
  const [devotionals, setDevotionals] = useState<Devotional[]>([]);
  const [devDialogOpen, setDevDialogOpen] = useState(false);
  const [editingDevotional, setEditingDevotional] = useState<Devotional | null>(
    null
  );
  const [devTitle, setDevTitle] = useState("");
  const [devContent, setDevContent] = useState("");
  const [devScripture, setDevScripture] = useState("");
  const [devWeek, setDevWeek] = useState(isoWeekStart(new Date()));
  const [devSubmitting, setDevSubmitting] = useState(false);

  // Get Life Groups department ID
  useEffect(() => {
    const unsub = onSnapshot(safeCollection("departments"), (snapshot) => {
      const depts = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
      })) as Department[];

      const lgDept = depts.find((d) => d.name === "Life Groups");
      setLifeGroupsDeptId(lgDept?.id || null);
    });
    return () => unsub();
  }, []);

  // Check access via configurable feature permissions
  const hasAccess = useMemo(() => {
    if (!userData || !lifeGroupsDeptId) return false;
    return checkFeatureAccess(
      "submit_life_group_lead",
      userData.departmentIds,
      userData.leadsDepartmentIds,
      { "Life Groups": lifeGroupsDeptId }
    );
  }, [userData, lifeGroupsDeptId, checkFeatureAccess]);

  const canManageDevotionals = useMemo(() => {
    if (!userData || !lifeGroupsDeptId) return false;
    return checkFeatureAccess(
      "manage_life_group_devotionals",
      userData.departmentIds,
      userData.leadsDepartmentIds,
      { "Life Groups": lifeGroupsDeptId }
    );
  }, [userData, lifeGroupsDeptId, checkFeatureAccess]);

  // Fetch my cards from API (fallback when onSnapshot fails)
  const fetchMyCardsFromApi = useCallback(async () => {
    try {
      const res = await fetch("/api/follow-up-cards?source=LIFE_GROUPS");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apiCards = (data.cards || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((c: any) => c.createdBy === userData?.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((c: any) => ({
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
        }))
        .sort(
          (a: FollowUpCard, b: FollowUpCard) =>
            b.createdAt.getTime() - a.createdAt.getTime()
        ) as FollowUpCard[];
      setMyCards(apiCards);
    } catch (err) {
      console.error("API fallback also failed:", err);
    }
  }, [userData?.id]);

  // Load my follow-up cards
  useEffect(() => {
    if (!userData) {
      setLoading(false);
      return;
    }

    const q = query(
      safeCollection("followUpCards"),
      where("source", "==", "LIFE_GROUPS"),
      where("createdBy", "==", userData.id)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const cards = snapshot.docs
          .map((d) => {
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
          })
          .sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
          );
        setMyCards(cards);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading follow-up cards:", error);
        // Fallback: fetch via API when real-time listener fails
        fetchMyCardsFromApi().finally(() => setLoading(false));
      }
    );

    return () => unsub();
  }, [userData?.id, fetchMyCardsFromApi]);

  // Devotional list — falls back to API when the realtime listener is denied
  // (e.g. before firestore.rules has been redeployed for /devotionals).
  const fetchDevotionalsFromApi = useCallback(async () => {
    try {
      const res = await fetch("/api/devotionals?scope=LIFE_GROUPS");
      if (!res.ok) return;
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list = (data.devotionals || []).map((d: any) => ({
        id: d.id,
        scope: d.scope || "LIFE_GROUPS",
        title: d.title || "",
        content: d.content || "",
        weekStartDate: d.weekStartDate || "",
        scriptureReference: d.scriptureReference || null,
        authorId: d.authorId || "",
        authorName: d.authorName || "",
        createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
        updatedAt: d.updatedAt ? new Date(d.updatedAt) : new Date(),
      })) as Devotional[];
      setDevotionals(list);
    } catch (err) {
      console.error("Devotionals API fallback failed:", err);
    }
  }, []);

  useEffect(() => {
    fetchDevotionalsFromApi();

    const q = query(
      safeCollection("devotionals"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) return;
        const list = snapshot.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              scope: (data.scope as Devotional["scope"]) || "CAMPUS_MINISTRY",
              title: data.title || "",
              content: data.content || "",
              weekStartDate: data.weekStartDate || "",
              scriptureReference: data.scriptureReference || null,
              authorId: data.authorId || "",
              authorName: data.authorName || "",
              createdAt: data.createdAt?.toDate?.() || new Date(),
              updatedAt: data.updatedAt?.toDate?.() || new Date(),
            } as Devotional;
          })
          .filter((d) => d.scope === "LIFE_GROUPS")
          .sort((a, b) =>
            (b.weekStartDate || "").localeCompare(a.weekStartDate || "")
          );
        setDevotionals(list);
      },
      (error) => {
        console.error("Error loading devotionals:", error);
        fetchDevotionalsFromApi();
      }
    );
    return () => unsub();
  }, [fetchDevotionalsFromApi]);

  const openDevotionalDialog = (existing?: Devotional) => {
    if (existing) {
      setEditingDevotional(existing);
      setDevTitle(existing.title);
      setDevContent(existing.content);
      setDevScripture(existing.scriptureReference || "");
      setDevWeek(existing.weekStartDate);
    } else {
      setEditingDevotional(null);
      setDevTitle("");
      setDevContent("");
      setDevScripture("");
      setDevWeek(isoWeekStart(new Date()));
    }
    setDevDialogOpen(true);
  };

  const handleDevotionalSubmit = async () => {
    if (!devTitle.trim() || !devContent.trim() || !devWeek) return;
    setDevSubmitting(true);
    try {
      const url = editingDevotional
        ? `/api/devotionals/${editingDevotional.id}`
        : "/api/devotionals";
      const method = editingDevotional ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "LIFE_GROUPS",
          title: devTitle.trim(),
          content: devContent.trim(),
          weekStartDate: devWeek,
          scriptureReference: devScripture.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save devotional");
      }
      setDevDialogOpen(false);
      fetchDevotionalsFromApi();
      toast({
        title: editingDevotional
          ? "Devotional updated"
          : "Devotional posted",
        description: editingDevotional
          ? "Your changes are live for the life groups."
          : "All Life Groups members have been notified.",
      });
    } catch (error) {
      toast({
        title: "Failed to save devotional",
        description:
          error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
    setDevSubmitting(false);
  };

  const handleDeleteDevotional = async (devId: string) => {
    if (!confirm("Delete this devotional? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/devotionals/${devId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete");
      }
      fetchDevotionalsFromApi();
      toast({ title: "Devotional removed" });
    } catch (error) {
      toast({
        title: "Failed to delete devotional",
        description:
          error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async () => {
    if (!formName || !formPhone || !formLifeGroup) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/follow-up-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          phone: formPhone,
          source: "LIFE_GROUPS",
          sourceDetail: formLifeGroup,
          reason: formReason || null,
          dateOfContact: formDate,
          notes: formNotes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create follow-up lead");
      }

      // Reset form
      const savedName = formName;
      setFormName("");
      setFormPhone("");
      setFormLifeGroup("");
      setFormReason("");
      setFormDate(new Date().toISOString().split("T")[0]);
      setFormNotes("");
      setDialogOpen(false);
      toast({
        title: "Follow-up lead submitted",
        description: `${savedName} has been sent to the Discipleship team for follow-up.`,
      });
    } catch (error) {
      console.error("Error creating follow-up lead:", error);
      toast({
        title: "Failed to submit lead",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
    setSubmitting(false);
  };

  if (loading || acLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <EmptyState
        icon={Users}
        tone="clay"
        title="Access Restricted"
        description="This page is only accessible to Life Group leaders (Department Lead or Youth Leader in Life Groups department)."
        className="py-20"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={Users}
        tone="teal"
        title="Life Groups Follow-Up"
        description="Submit follow-up leads for people encountered in Life Groups"
        actions={
          <Button variant="gold" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Submit Follow-Up Lead
          </Button>
        }
      />

      <Tabs defaultValue="devotional" className="space-y-4">
        <TabsList>
          <TabsTrigger value="devotional">Devotional Focus</TabsTrigger>
          <TabsTrigger value="leads">My Leads</TabsTrigger>
        </TabsList>

        {/* Devotional Focus Tab */}
        <TabsContent value="devotional" className="space-y-4">
          <div className="space-y-1">
            <SectionHeading
              actions={
                canManageDevotionals ? (
                  <Button variant="gold" onClick={() => openDevotionalDialog()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Post Devotional
                  </Button>
                ) : undefined
              }
            >
              Weekly Devotional Focus
            </SectionHeading>
            <p className="text-sm text-clay-500">
              Posted by the Life Groups coordinator for every life group.
            </p>
          </div>

          {devotionals.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              tone="teal"
              title="No Devotionals Posted Yet"
              description={
                canManageDevotionals
                  ? "Post the first devotional focus to share with every life group this week."
                  : "Check back soon — your coordinator will post this week's focus here."
              }
            />
          ) : (
            <div className="space-y-4">
              {devotionals.map((dev, idx) => (
                <Card key={dev.id} className={idx === 0 ? "border-gold/40" : ""}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {dev.title}
                          {idx === 0 && (
                            <Badge variant="gold">This Week</Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Week of{" "}
                          {dev.weekStartDate
                            ? format(
                                new Date(dev.weekStartDate),
                                "MMM d, yyyy"
                              )
                            : "—"}
                          {dev.scriptureReference
                            ? ` • ${dev.scriptureReference}`
                            : ""}
                        </CardDescription>
                      </div>
                      {canManageDevotionals && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDevotionalDialog(dev)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {userData?.role === "SUPER_ADMIN" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => handleDeleteDevotional(dev.id)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-clay-600 whitespace-pre-wrap">
                      {dev.content}
                    </p>
                    <p className="text-xs text-clay-400 mt-3">
                      Posted by {dev.authorName} •{" "}
                      {format(dev.createdAt, "MMM d, yyyy")}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* My Leads Tab */}
        <TabsContent value="leads" className="space-y-4">
          {myCards.length === 0 ? (
            <EmptyState
              icon={FileText}
              tone="teal"
              title="No Follow-Up Leads Submitted"
              description="Submit follow-up leads for new visitors or members needing support in your Life Group."
              action={
                <Button variant="gold" onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Submit First Lead
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myCards.map((card) => (
                <Card key={card.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-medium text-clay-700">{card.name}</p>
                        <div className="flex items-center gap-2 text-xs text-clay-500 mt-1">
                          <Phone className="h-3 w-3" />
                          <span>{card.phone}</span>
                        </div>
                      </div>
                      <Badge variant={STATUS_VARIANT[card.status] || "secondary"}>
                        {STATUS_LABELS[card.status] || card.status}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-xs text-clay-500">
                      <div className="flex items-center gap-2">
                        <Users className="h-3 w-3" />
                        <span>{card.sourceDetail}</span>
                      </div>
                      {card.reason && (
                        <div className="flex items-center gap-2">
                          <Heart className="h-3 w-3" />
                          <span>
                            {REASON_OPTIONS.find((r) => r.value === card.reason)
                              ?.label || card.reason}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>{format(card.dateOfContact, "MMM d, yyyy")}</span>
                      </div>
                      {card.notes && (
                        <p className="text-clay-400 mt-2 line-clamp-2">
                          {card.notes}
                        </p>
                      )}
                    </div>
                    {card.assigneeName && (
                      <div className="mt-3 pt-3 border-t border-clay-100">
                        <p className="text-xs text-clay-500">
                          Assigned to:{" "}
                          <span className="font-medium text-clay-700">
                            {card.assigneeName}
                          </span>
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Submit Follow-Up Lead Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Follow-Up Lead</DialogTitle>
            <DialogDescription>
              Record a person encountered in Life Groups who needs follow-up
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lead-name">Name *</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-clay-400" />
                <Input
                  id="lead-name"
                  placeholder="Full name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-phone">Phone *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-clay-400" />
                <Input
                  id="lead-phone"
                  placeholder="Phone number"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-life-group">Life Group Encountered In *</Label>
              <Select
                value={formLifeGroup}
                onValueChange={setFormLifeGroup}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Life Group" />
                </SelectTrigger>
                <SelectContent>
                  {LIFE_GROUP_OPTIONS.map((lg) => (
                    <SelectItem key={lg.value} value={lg.value}>
                      {lg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-reason">Reason</Label>
              <Select
                value={formReason}
                onValueChange={(v) => setFormReason(v as FollowUpReason)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select reason (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {REASON_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-date">Date</Label>
              <Input
                id="lead-date"
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-notes">Notes</Label>
              <Textarea
                id="lead-notes"
                placeholder="Any additional context..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="gold"
              onClick={handleSubmit}
              disabled={submitting || !formName || !formPhone || !formLifeGroup}
            >
              {submitting ? <LoadingSpinner size="sm" /> : "Submit Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Devotional Dialog */}
      <Dialog open={devDialogOpen} onOpenChange={setDevDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingDevotional
                ? "Edit Devotional"
                : "Post Weekly Devotional"}
            </DialogTitle>
            <DialogDescription>
              Share the focus for the week with every life group.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lg-dev-title">Title *</Label>
              <Input
                id="lg-dev-title"
                placeholder="e.g. Walking in Faith"
                value={devTitle}
                onChange={(e) => setDevTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lg-dev-week">Week starting (Monday) *</Label>
              <Input
                id="lg-dev-week"
                type="date"
                value={devWeek}
                onChange={(e) => setDevWeek(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lg-dev-scripture">Scripture reference</Label>
              <Input
                id="lg-dev-scripture"
                placeholder="e.g. Hebrews 11:1-6"
                value={devScripture}
                onChange={(e) => setDevScripture(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lg-dev-content">Devotional content *</Label>
              <Textarea
                id="lg-dev-content"
                placeholder="Write the focus, key points, and application..."
                value={devContent}
                onChange={(e) => setDevContent(e.target.value)}
                rows={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDevDialogOpen(false)}
              disabled={devSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="gold"
              onClick={handleDevotionalSubmit}
              disabled={
                devSubmitting ||
                !devTitle.trim() ||
                !devContent.trim() ||
                !devWeek
              }
            >
              {devSubmitting ? (
                <LoadingSpinner size="sm" />
              ) : editingDevotional ? (
                "Save Changes"
              ) : (
                "Post Devotional"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
