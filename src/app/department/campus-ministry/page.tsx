"use client";

import { useEffect, useState, useMemo } from "react";
import {
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { hasMinRole } from "@/lib/permissions";
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
} from "lucide-react";
import { format } from "date-fns";
import { Department, Institution, User, FollowUpCard } from "@/types";

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

export default function CampusMinistryPage() {
  const { userData } = useAuth();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [myCards, setMyCards] = useState<FollowUpCard[]>([]);
  const [studentMembers, setStudentMembers] = useState<User[]>([]);
  const [campusDeptId, setCampusDeptId] = useState<string | null>(null);
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

  // Check access
  const hasAccess = useMemo(() => {
    if (!userData || !campusDeptId) return false;
    if (hasMinRole(userData.role, "ADMIN")) return true;
    return userData.departmentIds.includes(campusDeptId);
  }, [userData, campusDeptId]);

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
      setInstitutions(insts);
    });
    return () => unsub();
  }, []);

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
        setLoading(false);
      }
    );

    return () => unsub();
  }, [userData?.id]);

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
      setFormName("");
      setFormPhone("");
      setFormInstitution("");
      setFormDate(new Date().toISOString().split("T")[0]);
      setFormNotes("");
      setDialogOpen(false);
    } catch (error) {
      console.error("Error creating follow-up card:", error);
      alert(error instanceof Error ? error.message : "Failed to create contact");
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

      <Tabs defaultValue="contacts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="contacts">My Contacts</TabsTrigger>
          <TabsTrigger value="students">Student Register</TabsTrigger>
        </TabsList>

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
            Object.entries(studentsByInstitution).map(
              ([instId, students]) => (
                <Card key={instId}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <GraduationCap className="h-5 w-5 text-gold-dark" />
                      {institutionMap[instId] || "Unknown Institution"}
                    </CardTitle>
                    <CardDescription>
                      {students.length} student{students.length !== 1 ? "s" : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {students.map((student) => (
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
                          {student.phone && (
                            <span className="text-xs text-clay-500">
                              {student.phone}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            )
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
    </div>
  );
}
