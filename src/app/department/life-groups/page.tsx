"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { canSubmitLifeGroupLead, hasMinRole } from "@/lib/permissions";
import {
  Card,
  CardContent,
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
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  Users,
  Plus,
  Phone,
  User as UserIcon,
  Calendar,
  FileText,
  Heart,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Department, FollowUpCard, FollowUpReason } from "@/types";

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

  // Check access: Life Group leaders (DEPARTMENT_LEAD or YOUTH_LEADER in Life Groups dept)
  const hasAccess = useMemo(() => {
    if (!userData || !lifeGroupsDeptId) return false;
    return canSubmitLifeGroupLead(
      userData.role,
      userData.departmentIds,
      lifeGroupsDeptId
    );
  }, [userData, lifeGroupsDeptId]);

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
        <Users className="h-12 w-12 text-clay-300 mb-4" />
        <h2 className="text-xl font-display font-semibold text-clay-600">
          Access Restricted
        </h2>
        <p className="text-clay-400 mt-2 text-center max-w-md">
          This page is only accessible to Life Group leaders (Department Lead or
          Youth Leader in Life Groups department).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-700">
            Life Groups Follow-Up
          </h1>
          <p className="text-clay-500 mt-1">
            Submit follow-up leads for people encountered in Life Groups
          </p>
        </div>
        <Button variant="gold" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Submit Follow-Up Lead
        </Button>
      </div>

      {/* My Submitted Leads */}
      {myCards.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-clay-300 mb-4" />
            <h3 className="text-lg font-display font-semibold text-clay-600">
              No Follow-Up Leads Submitted
            </h3>
            <p className="text-clay-400 text-sm mt-1 text-center max-w-md">
              Submit follow-up leads for new visitors or members needing support
              in your Life Group.
            </p>
            <Button
              variant="gold"
              className="mt-4"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Submit First Lead
            </Button>
          </CardContent>
        </Card>
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
    </div>
  );
}
