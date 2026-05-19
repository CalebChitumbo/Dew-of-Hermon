"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getDocs, query, orderBy, where } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Department, EventType, LifeGroup, User } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ArrowLeft, CalendarPlus, Users, Shield, CheckCircle2, Clock, Bus, Banknote, Mic, Target, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import { hasMinRole } from "@/lib/permissions";

// ─── Event type config ───

const EVENT_TYPE_CONFIG: Record<EventType, { label: string; dotColor: string }> = {
  POTTERS_WHEEL_SERVICE: { label: "Potter's Wheel Service", dotColor: "bg-[#C8963E]" },
  ROPS_CAMP: { label: "ROPS Camp", dotColor: "bg-green-500" },
  RETREAT: { label: "Retreat", dotColor: "bg-blue-500" },
  MEETING: { label: "Meeting", dotColor: "bg-gray-500" },
  SPECIAL_EVENT: { label: "Special Event", dotColor: "bg-purple-500" },
  OUTREACH: { label: "Outreach", dotColor: "bg-teal-500" },
};

const LIFE_GROUP_OPTIONS: { value: LifeGroup | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Life Groups" },
  { value: "BRIDGE", label: "Bridge (15-20 years)" },
  { value: "ANCHOR", label: "Anchor (21-25 years)" },
  { value: "CORNERSTONE", label: "Cornerstone (26+ years)" },
];

// ─── Core role templates ───

const CORE_ROLE_NAMES = [
  "Event Lead / Coordinator",
  "Registration / Reception",
  "MC / Timekeeper",
  "Prayer / Devotion Lead",
  "Venue Setup Lead",
];

interface CoreRoleState {
  role: string;
  assignedUserId: string | null;
  assignedUserName: string | null;
}

export default function NewEventPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [coreRolePickerIdx, setCoreRolePickerIdx] = useState<number | null>(null);
  const [coreRoleSearch, setCoreRoleSearch] = useState("");
  const [submitted, setSubmitted] = useState<{
    approvalStatus: string;
    title: string;
  } | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [type, setType] = useState<EventType>("SPECIAL_EVENT");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");
  const [lifeGroupTarget, setLifeGroupTarget] = useState<LifeGroup | "ALL" | "">("ALL");
  const [createdByDepartmentId, setCreatedByDepartmentId] = useState("");
  const [coreRoles, setCoreRoles] = useState<CoreRoleState[]>(
    CORE_ROLE_NAMES.map((name) => ({
      role: name,
      assignedUserId: null,
      assignedUserName: null,
    }))
  );
  const [speaker, setSpeaker] = useState("");
  const [objective, setObjective] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [attendanceFee, setAttendanceFee] = useState("");
  const [attendanceFeeCurrency, setAttendanceFeeCurrency] = useState("ZMW");
  const [transportRequired, setTransportRequired] = useState(false);
  const [transportNeeds, setTransportNeeds] = useState("");
  const [budgetRequested, setBudgetRequested] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetCurrency, setBudgetCurrency] = useState("ZMW");
  const [budgetPurpose, setBudgetPurpose] = useState("");

  // Access: DEPARTMENT_LEAD+
  const hasAccess = userData ? hasMinRole(userData.role, "DEPARTMENT_LEAD") : false;

  useEffect(() => {
    async function loadDepartments() {
      try {
        const snap = await getDocs(
          query(safeCollection("departments"), orderBy("order", "asc"))
        );
        const depts: Department[] = snap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            description: data.description || null,
            icon: data.icon || "",
            order: data.order || 0,
            createdAt: data.createdAt?.toDate?.() || new Date(),
          };
        });
        setDepartments(depts);
      } catch (err) {
        console.error("Failed to load departments:", err);
      } finally {
        setLoadingDepts(false);
      }
    }

    async function loadUsers() {
      try {
        const snap = await getDocs(
          query(
            safeCollection("users"),
            where("isActive", "==", true),
            orderBy("name", "asc")
          )
        );
        const users: User[] = snap.docs.map((doc) => {
          const u = doc.data();
          return {
            id: doc.id,
            name: u.name || "",
            email: u.email || "",
            phone: u.phone || null,
            role: u.role,
            departmentIds: u.departmentIds || [],
            leadsDepartmentIds: u.leadsDepartmentIds || [],
            profileImage: u.profileImage || null,
            isActive: true,
            lifeGroup: u.lifeGroup || null,
            isStudent: u.isStudent || false,
            institutionId: u.institutionId || null,
            createdAt: u.createdAt?.toDate?.() || new Date(),
            updatedAt: u.updatedAt?.toDate?.() || new Date(),
          };
        });
        setActiveUsers(users);
      } catch (err) {
        console.error("Failed to load users:", err);
      }
    }

    loadDepartments();
    loadUsers();
  }, []);

  function updateCoreRole(index: number, userId: string | null, userName: string | null) {
    setCoreRoles((prev) =>
      prev.map((role, i) =>
        i === index
          ? { ...role, assignedUserName: userName || null, assignedUserId: userId || null }
          : role
      )
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !date || !venue || !userData) return;
    if (!objective.trim()) {
      toast({
        title: "Objective required",
        description: "Describe what this event aims to achieve.",
        variant: "destructive",
      });
      return;
    }
    if (isPaid) {
      const fee = Number(attendanceFee);
      if (!Number.isFinite(fee) || fee <= 0) {
        toast({
          title: "Attendance fee required",
          description: "Enter a positive fee, or switch to free attendance.",
          variant: "destructive",
        });
        return;
      }
      if (!attendanceFeeCurrency.trim()) {
        toast({
          title: "Currency required",
          description: "Enter the currency for the attendance fee.",
          variant: "destructive",
        });
        return;
      }
    }
    if (transportRequired && !transportNeeds.trim()) {
      toast({
        title: "Transport details required",
        description:
          "Please describe what transport is needed so the coordinator can plan and cost it.",
        variant: "destructive",
      });
      return;
    }

    if (budgetRequested) {
      const amount = Number(budgetAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        toast({
          title: "Budget amount required",
          description: "Enter a positive amount you are requesting from the treasury.",
          variant: "destructive",
        });
        return;
      }
      if (!budgetCurrency.trim()) {
        toast({
          title: "Currency required",
          description: "Enter the currency for the requested funds (e.g. ZMW).",
          variant: "destructive",
        });
        return;
      }
      if (!budgetPurpose.trim()) {
        toast({
          title: "Purpose required",
          description: "Describe what the requested funds will be used for.",
          variant: "destructive",
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      const startDate = new Date(`${date}T${time || "09:00"}`);

      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          type,
          startDate: startDate.toISOString(),
          endDate: endDate ? new Date(`${endDate}T09:00`).toISOString() : null,
          venue: venue.trim(),
          description: description.trim() || null,
          isRecurring: false,
          lifeGroupTarget: lifeGroupTarget || null,
          createdByDepartmentId: createdByDepartmentId || null,
          coreRoles: coreRoles.filter((r) => r.assignedUserName),
          speaker: speaker.trim() || null,
          objective: objective.trim(),
          isPaid,
          attendanceFee: isPaid ? Number(attendanceFee) : null,
          attendanceFeeCurrency: isPaid ? attendanceFeeCurrency.trim() : null,
          transportRequired,
          transportNeeds: transportRequired ? transportNeeds.trim() : null,
          budgetRequested,
          budgetAmount: budgetRequested ? Number(budgetAmount) : null,
          budgetCurrency: budgetRequested ? budgetCurrency.trim() : null,
          budgetPurpose: budgetRequested ? budgetPurpose.trim() : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create event");
      }

      const data = await res.json();
      setSubmitted({ approvalStatus: data.approvalStatus, title });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-16 w-16 text-clay-300 mb-4" />
        <h2 className="text-xl font-display font-semibold text-clay-700">
          Access Denied
        </h2>
        <p className="text-clay-500 mt-2">
          You need Department Lead access or higher to create events.
        </p>
        <Link href="/calendar" className="mt-4">
          <Button variant="outline">Back to Calendar</Button>
        </Link>
      </div>
    );
  }

  if (submitted) {
    const isApproved = submitted.approvalStatus === "APPROVED";
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <CheckCircle2
          className={cn(
            "h-16 w-16 mb-4",
            isApproved ? "text-green-500" : "text-amber-500"
          )}
        />
        <h2 className="text-xl font-display font-semibold text-clay-700 text-center">
          {isApproved ? "Event Created!" : "Event Submitted for Approval"}
        </h2>
        <p className="text-clay-500 mt-2 text-center max-w-md">
          {isApproved
            ? `"${submitted.title}" is now visible on the calendar.`
            : `"${submitted.title}" has been submitted and is pending review by the Events & Fellowship team.`}
        </p>
        {!isApproved && (
          <div className="mt-4 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <Clock className="h-4 w-4 flex-shrink-0" />
            <span>You will receive a notification once it is reviewed.</span>
          </div>
        )}
        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            onClick={() => {
              setSubmitted(null);
              setTitle("");
              setDate("");
              setVenue("");
              setDescription("");
              setLifeGroupTarget("ALL");
              setCreatedByDepartmentId("");
              setCoreRoles(
                CORE_ROLE_NAMES.map((name) => ({
                  role: name,
                  assignedUserId: null,
                  assignedUserName: null,
                }))
              );
            }}
          >
            Create Another Event
          </Button>
          <Button
            className="bg-[#C8963E] hover:bg-[#B8862E] text-white"
            onClick={() => router.push("/calendar")}
          >
            Go to Calendar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Link href="/calendar">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-900">
            Create New Event
          </h1>
          <p className="text-sm text-clay-500 mt-1">
            {userData && hasMinRole(userData.role, "ADMIN")
              ? "Events you create will be automatically approved."
              : "Events will be reviewed by the Events & Fellowship team before appearing on the calendar."}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarPlus className="h-4 w-4 text-[#C8963E]" />
              Event Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Event title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Event Type *</Label>
                <Select
                  value={type}
                  onValueChange={(v: EventType) => setType(v)}
                >
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVENT_TYPE_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <span className={cn("w-2 h-2 rounded-full", cfg.dotColor)} />
                          {cfg.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dept">Initiating Department</Label>
                <Select
                  value={createdByDepartmentId}
                  onValueChange={setCreatedByDepartmentId}
                  disabled={loadingDepts}
                >
                  <SelectTrigger id="dept">
                    <SelectValue
                      placeholder={
                        loadingDepts ? "Loading..." : "Select department"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.icon} {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Start Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Start Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="venue">Venue *</Label>
                <Input
                  id="venue"
                  placeholder="Event venue or location"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="objective" className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-[#C8963E]" />
                Objective *
              </Label>
              <Textarea
                id="objective"
                placeholder="What does this event aim to achieve?"
                rows={2}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Any additional details or context (optional)"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="speaker" className="flex items-center gap-1.5">
                <Mic className="h-3.5 w-3.5 text-[#C8963E]" />
                Speaker
              </Label>
              <Input
                id="speaker"
                placeholder="Name of the speaker (leave blank if none)"
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Attendance Fee */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Ticket className="h-4 w-4 text-[#C8963E]" />
              Attendance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-clay-500">
              Is there a cost for attendees, or is the event free to attend?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsPaid(false)}
                className={cn(
                  "rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all text-center",
                  !isPaid
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-clay-200 text-clay-500 hover:border-clay-300 hover:bg-clay-50"
                )}
              >
                Free to attend
              </button>
              <button
                type="button"
                onClick={() => setIsPaid(true)}
                className={cn(
                  "rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all text-center",
                  isPaid
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-clay-200 text-clay-500 hover:border-clay-300 hover:bg-clay-50"
                )}
              >
                Payment required
              </button>
            </div>
            {isPaid && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="attendance-fee" className="text-sm">
                    Fee per attendee *
                  </Label>
                  <Input
                    id="attendance-fee"
                    type="number"
                    min={1}
                    step="0.01"
                    placeholder="e.g. 50"
                    value={attendanceFee}
                    onChange={(e) => setAttendanceFee(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="attendance-fee-currency" className="text-sm">
                    Currency *
                  </Label>
                  <Input
                    id="attendance-fee-currency"
                    placeholder="ZMW"
                    value={attendanceFeeCurrency}
                    onChange={(e) => setAttendanceFeeCurrency(e.target.value)}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Life Group Targeting */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-[#C8963E]" />
              Life Group Targeting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-clay-500">
              Specify which Life Group this event is targeted at. Members of the selected group will receive notifications.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {LIFE_GROUP_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLifeGroupTarget(opt.value)}
                  className={cn(
                    "rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all text-center",
                    lifeGroupTarget === opt.value
                      ? opt.value === "ALL"
                        ? "border-yellow-500 bg-yellow-50 text-yellow-700"
                        : opt.value === "BRIDGE"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : opt.value === "ANCHOR"
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-purple-500 bg-purple-50 text-purple-700"
                      : "border-clay-200 text-clay-500 hover:border-clay-300 hover:bg-clay-50"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {lifeGroupTarget && lifeGroupTarget !== "ALL" && (
              <p className="text-xs text-clay-400">
                Only members of the <strong>{lifeGroupTarget}</strong> Life Group will receive event notifications.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Core Roles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-[#C8963E]" />
              Core Roles
              <Badge variant="outline" className="text-xs ml-auto font-normal">
                Optional — fill in known assignments
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-clay-500">
              These are the key coordination roles for this event. You can assign members now or leave them for later assignment.
            </p>
            <div className="space-y-2">
              {coreRoles.map((role, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="flex-1">
                    <Label className="text-xs text-clay-500 mb-1 block">
                      {role.role}
                    </Label>
                    <div className="relative">
                      {role.assignedUserName ? (
                        <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-green-50 border-green-200">
                          <span className="text-sm text-clay-800 flex-1 truncate">
                            {role.assignedUserName}
                          </span>
                          <button
                            type="button"
                            className="text-xs text-red-400 hover:text-red-600"
                            onClick={() => updateCoreRole(idx, null, null)}
                          >
                            Clear
                          </button>
                        </div>
                      ) : (
                        <div>
                          <Input
                            placeholder="Search member to assign..."
                            value={coreRolePickerIdx === idx ? coreRoleSearch : ""}
                            onFocus={() => {
                              setCoreRolePickerIdx(idx);
                              setCoreRoleSearch("");
                            }}
                            onChange={(e) => {
                              setCoreRolePickerIdx(idx);
                              setCoreRoleSearch(e.target.value);
                            }}
                            className="h-9"
                          />
                          {coreRolePickerIdx === idx && (
                            <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto bg-white border border-clay-200 rounded-md shadow-lg">
                              {activeUsers
                                .filter(
                                  (u) =>
                                    u.name.toLowerCase().includes(coreRoleSearch.toLowerCase()) ||
                                    u.email.toLowerCase().includes(coreRoleSearch.toLowerCase())
                                )
                                .slice(0, 8)
                                .map((user) => (
                                  <button
                                    key={user.id}
                                    type="button"
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-clay-50 flex items-center gap-2"
                                    onClick={() => {
                                      updateCoreRole(idx, user.id, user.name);
                                      setCoreRolePickerIdx(null);
                                      setCoreRoleSearch("");
                                    }}
                                  >
                                    <div className="h-6 w-6 rounded-full bg-[#C8963E]/20 flex items-center justify-center flex-shrink-0">
                                      <span className="text-xs font-bold text-[#C8963E]">
                                        {user.name.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm text-clay-800 truncate">{user.name}</p>
                                      <p className="text-xs text-clay-400 truncate">{user.email}</p>
                                    </div>
                                  </button>
                                ))}
                              {activeUsers.filter(
                                (u) =>
                                  u.name.toLowerCase().includes(coreRoleSearch.toLowerCase()) ||
                                  u.email.toLowerCase().includes(coreRoleSearch.toLowerCase())
                              ).length === 0 && (
                                <p className="px-3 py-2 text-xs text-clay-400">No members found</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Transport */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bus className="h-4 w-4 text-[#C8963E]" />
              Transport
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-clay-500">
              If transport is needed for this event, flag it here. The Events
              Coordinator will route the request to the Transport Coordinator
              for costing before the event is approved.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTransportRequired(false)}
                className={cn(
                  "rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all text-center",
                  !transportRequired
                    ? "border-clay-400 bg-clay-50 text-clay-700"
                    : "border-clay-200 text-clay-500 hover:border-clay-300 hover:bg-clay-50"
                )}
              >
                No transport needed
              </button>
              <button
                type="button"
                onClick={() => setTransportRequired(true)}
                className={cn(
                  "rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all text-center",
                  transportRequired
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-clay-200 text-clay-500 hover:border-clay-300 hover:bg-clay-50"
                )}
              >
                Transport required
              </button>
            </div>
            {transportRequired && (
              <div className="space-y-1.5">
                <Label htmlFor="transport-needs" className="text-sm">
                  Describe transport needs *
                </Label>
                <Textarea
                  id="transport-needs"
                  placeholder="e.g. Pickup from UNZA and TAU campuses, ~40 people, return after the event ends"
                  rows={3}
                  value={transportNeeds}
                  onChange={(e) => setTransportNeeds(e.target.value)}
                />
                <p className="text-xs text-clay-400">
                  The Transport Coordinator will use this to plan vehicles,
                  schedule, and cost.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Budget Request */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Banknote className="h-4 w-4 text-[#C8963E]" />
              Funds Request
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-clay-500">
              If this event needs extra funds from the treasury (e.g. catering,
              materials, honoraria), request it here. The treasurer will review
              and confirm what can be funded before the event is approved.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBudgetRequested(false)}
                className={cn(
                  "rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all text-center",
                  !budgetRequested
                    ? "border-clay-400 bg-clay-50 text-clay-700"
                    : "border-clay-200 text-clay-500 hover:border-clay-300 hover:bg-clay-50"
                )}
              >
                No funds needed
              </button>
              <button
                type="button"
                onClick={() => setBudgetRequested(true)}
                className={cn(
                  "rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all text-center",
                  budgetRequested
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-clay-200 text-clay-500 hover:border-clay-300 hover:bg-clay-50"
                )}
              >
                Request funds
              </button>
            </div>
            {budgetRequested && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="budget-amount" className="text-sm">
                      Amount *
                    </Label>
                    <Input
                      id="budget-amount"
                      type="number"
                      min={1}
                      step="0.01"
                      placeholder="e.g. 1500"
                      value={budgetAmount}
                      onChange={(e) => setBudgetAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="budget-currency" className="text-sm">
                      Currency *
                    </Label>
                    <Input
                      id="budget-currency"
                      placeholder="ZMW"
                      value={budgetCurrency}
                      onChange={(e) => setBudgetCurrency(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="budget-purpose" className="text-sm">
                    What are the funds for? *
                  </Label>
                  <Textarea
                    id="budget-purpose"
                    placeholder="e.g. Refreshments for ~60 attendees and printed booklets"
                    rows={3}
                    value={budgetPurpose}
                    onChange={(e) => setBudgetPurpose(e.target.value)}
                  />
                  <p className="text-xs text-clay-400">
                    The treasurer may approve the full amount, reduce it, or
                    reject the request with feedback.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-3">
          <Link href="/calendar" className="flex-1">
            <Button type="button" variant="outline" className="w-full">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={
              submitting ||
              !title ||
              !date ||
              !venue ||
              !objective.trim() ||
              (isPaid && (!attendanceFee.trim() || !attendanceFeeCurrency.trim())) ||
              (transportRequired && !transportNeeds.trim()) ||
              (budgetRequested &&
                (!budgetAmount.trim() ||
                  !budgetCurrency.trim() ||
                  !budgetPurpose.trim()))
            }
            className="flex-1 bg-[#C8963E] hover:bg-[#B8862E] text-white"
          >
            {submitting ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Submitting...
              </>
            ) : (
              "Submit Event"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
