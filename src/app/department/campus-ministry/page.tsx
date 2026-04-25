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
import {
  GraduationCap,
  Plus,
  Phone,
  User as UserIcon,
  Calendar,
  FileText,
  Building2,
  Users,
  BookOpen,
  CheckCircle2,
  XCircle,
  ClipboardCheck,
  Pencil,
} from "lucide-react";
import { format, startOfWeek } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  Department,
  Institution,
  User,
  FollowUpCard,
  Devotional,
} from "@/types";

const DEFAULT_INSTITUTIONS: Institution[] = [
  { id: "unza", name: "UNZA", isActive: true, order: 1, createdAt: new Date() },
  { id: "texila", name: "Texila American University", isActive: true, order: 2, createdAt: new Date() },
  { id: "evelyn-hone", name: "Evelyn Hone College", isActive: true, order: 3, createdAt: new Date() },
  { id: "apex", name: "Apex Medical University", isActive: true, order: 4, createdAt: new Date() },
  { id: "nipa", name: "NIPA", isActive: true, order: 5, createdAt: new Date() },
  { id: "zcas", name: "ZCAS University", isActive: true, order: 6, createdAt: new Date() },
  { id: "chreso", name: "Chreso University", isActive: true, order: 7, createdAt: new Date() },
  { id: "cavendish", name: "Cavendish University", isActive: true, order: 8, createdAt: new Date() },
  { id: "eden", name: "Eden University", isActive: true, order: 9, createdAt: new Date() },
];

const STATUS_LABELS: Record<string, string> = {
  PENDING_LEAD_APPROVAL: "Pending Approval",
  REJECTED: "Rejected",
  NEW_CONTACT: "New Contact",
  ASSIGNED: "Assigned",
  CONTACTED: "Contacted",
  FIRST_VISIT: "First Visit",
  REGULAR_ATTENDEE: "Regular Attendee",
  MEMBER: "Member",
};

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "warning" | "success" | "gold" | "destructive"
> = {
  PENDING_LEAD_APPROVAL: "warning",
  REJECTED: "destructive",
  NEW_CONTACT: "secondary",
  ASSIGNED: "warning",
  CONTACTED: "warning",
  FIRST_VISIT: "gold",
  REGULAR_ATTENDEE: "success",
  MEMBER: "default",
};

function isoWeekStart(d: Date): string {
  return startOfWeek(d, { weekStartsOn: 1 }).toISOString().split("T")[0];
}

export default function CampusMinistryPage() {
  const { userData } = useAuth();
  const { checkFeatureAccess } = usePermissions();
  const { loading: acLoading } = useAccessControl();
  const { toast } = useToast();
  const [institutions, setInstitutions] = useState<Institution[]>(DEFAULT_INSTITUTIONS);
  const [myCards, setMyCards] = useState<FollowUpCard[]>([]);
  const [pendingCards, setPendingCards] = useState<FollowUpCard[]>([]);
  const [studentMembers, setStudentMembers] = useState<User[]>([]);
  const [campusDeptId, setCampusDeptId] = useState<string | null>(null);
  const [devotionals, setDevotionals] = useState<Devotional[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formInstitution, setFormInstitution] = useState("");
  const [formDate, setFormDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [formNotes, setFormNotes] = useState("");

  // Devotional dialog state
  const [devDialogOpen, setDevDialogOpen] = useState(false);
  const [editingDevotional, setEditingDevotional] = useState<Devotional | null>(
    null
  );
  const [devTitle, setDevTitle] = useState("");
  const [devContent, setDevContent] = useState("");
  const [devScripture, setDevScripture] = useState("");
  const [devWeek, setDevWeek] = useState(isoWeekStart(new Date()));
  const [devSubmitting, setDevSubmitting] = useState(false);

  // Approval state
  const [approving, setApproving] = useState<string | null>(null);
  const [rejectCardId, setRejectCardId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Institution-edit state for student register
  const [institutionEditId, setInstitutionEditId] = useState<string | null>(
    null
  );
  const [institutionEditValue, setInstitutionEditValue] = useState("");
  const [savingInstitution, setSavingInstitution] = useState(false);

  // Check if user is in Campus Ministry department
  useEffect(() => {
    const unsub = onSnapshot(safeCollection("departments"), (snapshot) => {
      const depts = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
      })) as Department[];

      const campusDept = depts.find((d) => d.name === "Campus Ministry");
      setCampusDeptId(campusDept?.id || null);
    });
    return () => unsub();
  }, []);

  // Check access via configurable feature permissions
  const hasAccess = useMemo(() => {
    if (!userData || !campusDeptId) return false;
    return checkFeatureAccess(
      "submit_follow_up",
      userData.departmentIds,
      userData.leadsDepartmentIds,
      { "Campus Ministry": campusDeptId }
    );
  }, [userData, campusDeptId, checkFeatureAccess]);

  const canManageDevotionals = useMemo(() => {
    if (!userData || !campusDeptId) return false;
    return checkFeatureAccess(
      "manage_devotionals",
      userData.departmentIds,
      userData.leadsDepartmentIds,
      { "Campus Ministry": campusDeptId }
    );
  }, [userData, campusDeptId, checkFeatureAccess]);

  const canApproveFollowUp = useMemo(() => {
    if (!userData || !campusDeptId) return false;
    return checkFeatureAccess(
      "approve_follow_up",
      userData.departmentIds,
      userData.leadsDepartmentIds,
      { "Campus Ministry": campusDeptId }
    );
  }, [userData, campusDeptId, checkFeatureAccess]);

  // Load institutions
  useEffect(() => {
    const q = query(
      safeCollection("institutions"),
      orderBy("order", "asc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const insts = (snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate?.() || new Date(),
        })) as Institution[]).filter((inst) => inst.isActive !== false);
      setInstitutions(insts.length > 0 ? insts : DEFAULT_INSTITUTIONS);
    }, (error) => {
      console.error("Error fetching institutions:", error);
      setInstitutions(DEFAULT_INSTITUTIONS);
    });
    return () => unsub();
  }, []);

  // Fetch my cards from API (fallback when onSnapshot fails)
  const fetchMyCardsFromApi = useCallback(async () => {
    try {
      const res = await fetch("/api/follow-up-cards?source=CAMPUS_MINISTRY");
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

  // Load my follow-up cards (created by me, from campus ministry)
  useEffect(() => {
    if (!userData) {
      setLoading(false);
      return;
    }

    const q = query(
      safeCollection("followUpCards"),
      where("source", "==", "CAMPUS_MINISTRY"),
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

  // Load student members for sub-register
  useEffect(() => {
    const q = query(
      safeCollection("users"),
      where("isStudent", "==", true),
      where("isActive", "==", true)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const students = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
        updatedAt: d.data().updatedAt?.toDate?.() || new Date(),
      })) as User[];
      setStudentMembers(students);
    });

    return () => unsub();
  }, []);

  // Load weekly devotional posts
  // Load weekly devotional posts. Falls back to the API when the realtime
  // read is denied (e.g. before firestore.rules has been deployed with the
  // new /devotionals collection rule).
  const fetchDevotionalsFromApi = useCallback(async () => {
    try {
      const res = await fetch("/api/devotionals");
      if (!res.ok) return;
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list = (data.devotionals || []).map((d: any) => ({
        id: d.id,
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
    // Always fetch via API so the list populates even if the realtime
    // listener never delivers (e.g. rules not yet redeployed for the new
    // collection, or denied-but-no-error edge cases).
    fetchDevotionalsFromApi();

    const q = query(
      safeCollection("devotionals"),
      orderBy("weekStartDate", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) return;
        const list = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title || "",
            content: data.content || "",
            weekStartDate: data.weekStartDate || "",
            scriptureReference: data.scriptureReference || null,
            authorId: data.authorId || "",
            authorName: data.authorName || "",
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
          } as Devotional;
        });
        setDevotionals(list);
      },
      (error) => {
        console.error("Error loading devotionals:", error);
        fetchDevotionalsFromApi();
      }
    );
    return () => unsub();
  }, [fetchDevotionalsFromApi]);

  // Load pending-approval cards (only for the Campus Ministry coordinator)
  useEffect(() => {
    if (!canApproveFollowUp) {
      setPendingCards([]);
      return;
    }
    const q = query(
      safeCollection("followUpCards"),
      where("source", "==", "CAMPUS_MINISTRY"),
      where("status", "==", "PENDING_LEAD_APPROVAL")
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs
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
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setPendingCards(list);
      },
      (error) => {
        console.error("Error loading pending cards:", error);
      }
    );
    return () => unsub();
  }, [canApproveFollowUp]);

  // Group students by institution
  const studentsByInstitution = useMemo(() => {
    const groups: Record<string, User[]> = {};
    for (const student of studentMembers) {
      const instId = student.institutionId || "unknown";
      if (!groups[instId]) groups[instId] = [];
      groups[instId].push(student);
    }
    return groups;
  }, [studentMembers]);

  const institutionMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const inst of institutions) m[inst.id] = inst.name;
    return m;
  }, [institutions]);

  const handleSubmit = async () => {
    if (!formName || !formPhone || !formInstitution) return;

    setSubmitting(true);
    try {
      const institutionName =
        institutions.find((i) => i.id === formInstitution)?.name || formInstitution;

      const res = await fetch("/api/follow-up-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          phone: formPhone,
          source: "CAMPUS_MINISTRY",
          sourceDetail: institutionName,
          dateOfContact: formDate,
          notes: formNotes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create contact");
      }

      // Reset form
      const savedName = formName;
      setFormName("");
      setFormPhone("");
      setFormInstitution("");
      setFormDate(new Date().toISOString().split("T")[0]);
      setFormNotes("");
      setDialogOpen(false);
      const submitterRole = userData?.role;
      const goesToApproval =
        submitterRole === "YOUTH_LEADER" || submitterRole === "MEMBER";
      toast({
        title: "Contact logged",
        description: goesToApproval
          ? `${savedName} has been submitted to the department lead for approval.`
          : `${savedName} has been sent to the Discipleship team for follow-up.`,
      });
    } catch (error) {
      console.error("Error creating follow-up card:", error);
      toast({
        title: "Failed to log contact",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
    setSubmitting(false);
  };

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
      // Refresh via API in case the realtime listener is denied (e.g. before
      // firestore.rules redeployment includes /devotionals).
      fetchDevotionalsFromApi();
      toast({
        title: editingDevotional
          ? "Devotional updated"
          : "Devotional posted",
        description: editingDevotional
          ? "Your changes are live for the campus."
          : "All Campus Ministry members have been notified.",
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

  const handleApprove = async (cardId: string) => {
    setApproving(cardId);
    try {
      const res = await fetch(`/api/follow-up-cards/${cardId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to approve");
      }
      toast({
        title: "Approved",
        description: "Sent to the discipleship team.",
      });
    } catch (error) {
      toast({
        title: "Failed to approve",
        description:
          error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
    setApproving(null);
  };

  const handleReject = async () => {
    if (!rejectCardId) return;
    setApproving(rejectCardId);
    try {
      const res = await fetch(
        `/api/follow-up-cards/${rejectCardId}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "REJECT",
            reason: rejectReason.trim() || null,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to reject");
      }
      toast({ title: "Submission rejected" });
      setRejectCardId(null);
      setRejectReason("");
    } catch (error) {
      toast({
        title: "Failed to reject",
        description:
          error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
    setApproving(null);
  };

  const beginEditInstitution = (student: User) => {
    setInstitutionEditId(student.id);
    setInstitutionEditValue(student.institutionId || "");
  };

  const cancelEditInstitution = () => {
    setInstitutionEditId(null);
    setInstitutionEditValue("");
  };

  const saveInstitution = async (studentId: string) => {
    setSavingInstitution(true);
    try {
      const res = await fetch(`/api/members/${studentId}/institution`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionId: institutionEditValue || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update");
      }
      toast({ title: "Campus updated" });
      cancelEditInstitution();
    } catch (error) {
      toast({
        title: "Failed to update campus",
        description:
          error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
    setSavingInstitution(false);
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
      <div className="flex flex-col items-center justify-center py-20">
        <GraduationCap className="h-12 w-12 text-clay-300 mb-4" />
        <h2 className="text-xl font-display font-semibold text-clay-600">
          Access Restricted
        </h2>
        <p className="text-clay-400 mt-2 text-center max-w-md">
          This page is only accessible to Campus Ministry department members.
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
            Campus Ministry
          </h1>
          <p className="text-clay-500 mt-1">
            Log contacts from campus outreach and track their journey
          </p>
        </div>
        <Button variant="gold" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Log New Contact
        </Button>
      </div>

      <Tabs defaultValue="devotional" className="space-y-4">
        <TabsList>
          <TabsTrigger value="devotional">Devotional Focus</TabsTrigger>
          <TabsTrigger value="contacts">My Contacts</TabsTrigger>
          {canApproveFollowUp && (
            <TabsTrigger value="approvals">
              Pending Approvals
              {pendingCards.length > 0 && (
                <Badge variant="warning" className="ml-2 text-[10px]">
                  {pendingCards.length}
                </Badge>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="students">Student Register</TabsTrigger>
        </TabsList>

        {/* Devotional Focus Tab */}
        <TabsContent value="devotional" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-display font-semibold text-clay-700 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-gold-dark" />
                Weekly Devotional Focus
              </h2>
              <p className="text-sm text-clay-500">
                Posted by the Campus Ministry coordinator for every campus.
              </p>
            </div>
            {canManageDevotionals && (
              <Button variant="gold" onClick={() => openDevotionalDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Post Devotional
              </Button>
            )}
          </div>

          {devotionals.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="h-12 w-12 text-clay-300 mb-4" />
                <h3 className="text-lg font-display font-semibold text-clay-600">
                  No Devotionals Posted Yet
                </h3>
                <p className="text-clay-400 text-sm mt-1 text-center max-w-md">
                  {canManageDevotionals
                    ? "Post the first devotional focus to share with every campus this week."
                    : "Check back soon — your coordinator will post this week's focus here."}
                </p>
              </CardContent>
            </Card>
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
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => handleDeleteDevotional(dev.id)}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
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

        {/* Pending Approvals Tab */}
        {canApproveFollowUp && (
          <TabsContent value="approvals" className="space-y-4">
            <div>
              <h2 className="text-lg font-display font-semibold text-clay-700 flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-gold-dark" />
                Submissions Awaiting Approval
              </h2>
              <p className="text-sm text-clay-500">
                Youth-leader submissions only reach the discipleship team after
                you approve them.
              </p>
            </div>

            {pendingCards.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="h-12 w-12 text-clay-300 mb-4" />
                  <h3 className="text-lg font-display font-semibold text-clay-600">
                    Nothing Pending
                  </h3>
                  <p className="text-clay-400 text-sm mt-1">
                    All caught up — no submissions awaiting your approval.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {pendingCards.map((card) => (
                  <Card key={card.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-clay-700">
                            {card.name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-clay-500 mt-1">
                            <Phone className="h-3 w-3" />
                            <span>{card.phone}</span>
                          </div>
                        </div>
                        <Badge variant="warning">Pending</Badge>
                      </div>
                      <div className="space-y-1 text-xs text-clay-500">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3 w-3" />
                          <span>{card.sourceDetail}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {format(card.dateOfContact, "MMM d, yyyy")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-3 w-3" />
                          <span>
                            Submitted by {card.createdByName}
                            {card.submittedByRole
                              ? ` (${card.submittedByRole.replace(/_/g, " ")})`
                              : ""}
                          </span>
                        </div>
                        {card.notes && (
                          <p className="text-clay-400 mt-2 line-clamp-3">
                            {card.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="gold"
                          size="sm"
                          className="flex-1"
                          disabled={approving === card.id}
                          onClick={() => handleApprove(card.id)}
                        >
                          {approving === card.id ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <>
                              <CheckCircle2 className="mr-1 h-4 w-4" />
                              Approve
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          disabled={approving === card.id}
                          onClick={() => {
                            setRejectCardId(card.id);
                            setRejectReason("");
                          }}
                        >
                          <XCircle className="mr-1 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="space-y-4">
          {myCards.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-clay-300 mb-4" />
                <h3 className="text-lg font-display font-semibold text-clay-600">
                  No Contacts Logged
                </h3>
                <p className="text-clay-400 text-sm mt-1 text-center max-w-md">
                  Start logging contacts from your campus outreach activities.
                </p>
                <Button
                  variant="gold"
                  className="mt-4"
                  onClick={() => setDialogOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Log First Contact
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
                        <Building2 className="h-3 w-3" />
                        <span>{card.sourceDetail}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {format(card.dateOfContact, "MMM d, yyyy")}
                        </span>
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

        {/* Student Register Tab */}
        <TabsContent value="students" className="space-y-4">
          {studentMembers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-clay-300 mb-4" />
                <h3 className="text-lg font-display font-semibold text-clay-600">
                  No Students Registered
                </h3>
                <p className="text-clay-400 text-sm mt-1">
                  No members are currently registered as students.
                </p>
              </CardContent>
            </Card>
          ) : (
            Object.entries(studentsByInstitution)
              .sort(([a], [b]) => {
                // Push "unknown" to the bottom so the coordinator sees real
                // campuses first.
                if (a === "unknown") return 1;
                if (b === "unknown") return -1;
                return (institutionMap[a] || a).localeCompare(
                  institutionMap[b] || b
                );
              })
              .map(([instId, students]) => {
                const isUnknown = instId === "unknown" || !institutionMap[instId];
                return (
                  <Card key={instId} className={isUnknown ? "border-amber-300" : ""}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <GraduationCap className="h-5 w-5 text-gold-dark" />
                        {isUnknown
                          ? "Campus Not Set"
                          : institutionMap[instId]}
                        {isUnknown && (
                          <Badge variant="warning" className="ml-1">
                            Needs assignment
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {students.length} student
                        {students.length !== 1 ? "s" : ""}
                        {isUnknown && canManageDevotionals && (
                          <span className="block mt-1 text-amber-700">
                            Click the pencil next to a student to set their campus.
                          </span>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {students.map((student) => {
                          const isEditing = institutionEditId === student.id;
                          return (
                            <div
                              key={student.id}
                              className="flex items-center gap-3 p-2 rounded-md hover:bg-clay-50"
                            >
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/20 text-gold-dark text-xs font-bold">
                                {student.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-clay-700 truncate">
                                  {student.name}
                                </p>
                                <p className="text-xs text-clay-400 truncate">
                                  {student.email}
                                </p>
                              </div>
                              {student.phone && !isEditing && (
                                <span className="text-xs text-clay-500 hidden sm:inline">
                                  {student.phone}
                                </span>
                              )}
                              {isEditing ? (
                                <div className="flex items-center gap-2">
                                  <Select
                                    value={institutionEditValue}
                                    onValueChange={setInstitutionEditValue}
                                  >
                                    <SelectTrigger className="w-[180px] h-8 text-xs">
                                      <SelectValue placeholder="Pick campus" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {institutions.map((inst) => (
                                        <SelectItem
                                          key={inst.id}
                                          value={inst.id}
                                        >
                                          {inst.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    size="sm"
                                    variant="gold"
                                    disabled={
                                      savingInstitution || !institutionEditValue
                                    }
                                    onClick={() => saveInstitution(student.id)}
                                  >
                                    {savingInstitution ? (
                                      <LoadingSpinner size="sm" />
                                    ) : (
                                      "Save"
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={cancelEditInstitution}
                                    disabled={savingInstitution}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                canManageDevotionals && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => beginEditInstitution(student)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
          )}
        </TabsContent>
      </Tabs>

      {/* Log Contact Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log Campus Contact</DialogTitle>
            <DialogDescription>
              Record a new contact from campus outreach
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Name *</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-clay-400" />
                <Input
                  id="contact-name"
                  placeholder="Full name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-phone">Phone *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-clay-400" />
                <Input
                  id="contact-phone"
                  placeholder="Phone number"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-institution">Institution *</Label>
              <Select
                value={formInstitution}
                onValueChange={setFormInstitution}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select institution" />
                </SelectTrigger>
                <SelectContent>
                  {institutions.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-date">Date of Contact</Label>
              <Input
                id="contact-date"
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-notes">Notes</Label>
              <Textarea
                id="contact-notes"
                placeholder="Any additional notes..."
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
              disabled={submitting || !formName || !formPhone || !formInstitution}
            >
              {submitting ? <LoadingSpinner size="sm" /> : "Save Contact"}
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
              Share the focus for the week with every campus.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dev-title">Title *</Label>
              <Input
                id="dev-title"
                placeholder="e.g. Walking in Faith"
                value={devTitle}
                onChange={(e) => setDevTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dev-week">Week starting (Monday) *</Label>
              <Input
                id="dev-week"
                type="date"
                value={devWeek}
                onChange={(e) => setDevWeek(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dev-scripture">Scripture reference</Label>
              <Input
                id="dev-scripture"
                placeholder="e.g. Hebrews 11:1-6"
                value={devScripture}
                onChange={(e) => setDevScripture(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dev-content">Devotional content *</Label>
              <Textarea
                id="dev-content"
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

      {/* Reject Submission Dialog */}
      <Dialog
        open={!!rejectCardId}
        onOpenChange={(open) => {
          if (!open) {
            setRejectCardId(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Submission</DialogTitle>
            <DialogDescription>
              Let the youth leader know why this submission isn&apos;t moving
              forward (optional).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              placeholder="e.g. Duplicate contact, missing info..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectCardId(null);
                setRejectReason("");
              }}
              disabled={!!approving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!!approving}
            >
              {approving ? <LoadingSpinner size="sm" /> : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
