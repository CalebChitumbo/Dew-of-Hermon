"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getDocs, query, orderBy, where } from "firebase/firestore";
import { format } from "date-fns";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Department, EventType, LifeGroup, User } from "@/types";
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
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  luxSurface,
  BotanicalCorner,
  DecorImage,
} from "@/components/shared/lux";
import { iconTones, type IconTone } from "@/lib/icon-tones";
import {
  CalendarPlus,
  Users,
  Shield,
  CheckCircle2,
  Clock,
  Bus,
  Banknote,
  Mic,
  Target,
  Ticket,
  Clapperboard,
  UtensilsCrossed,
  CalendarRange,
  MapPin,
  Sparkles,
  Lightbulb,
  Tag,
} from "lucide-react";
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

// ─── Guided form section shell ───

function FormSection({
  icon: Icon,
  tone = "gold",
  title,
  helper,
  badge,
  children,
}: {
  icon: React.ElementType;
  tone?: IconTone;
  title: string;
  helper?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("p-5 sm:p-6", luxSurface)}>
      <div className="flex items-start gap-3">
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset ring-white/50", iconTones[tone])}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-clay-700">{title}</h2>
            {badge}
          </div>
          {helper && <p className="mt-0.5 text-sm leading-relaxed text-clay-400">{helper}</p>}
        </div>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

/** Two-option pill toggle used across the logistics flags. */
function PillToggle({
  active,
  onClick,
  children,
  activeClass,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  activeClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border-2 px-3 py-2.5 text-center text-sm font-medium transition-all",
        active ? activeClass : "border-clay-200 text-clay-500 hover:border-clay-300 hover:bg-clay-50"
      )}
    >
      {children}
    </button>
  );
}

const inputCls = "h-11 rounded-xl";

/** A single labelled row in the live Event Summary panel. */
function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-clay-400" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-clay-400">{label}</p>
        <p className="text-sm text-clay-700">{value}</p>
      </div>
    </div>
  );
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
  const [mediaRequired, setMediaRequired] = useState(false);
  const [mediaNeeds, setMediaNeeds] = useState("");
  const [foodRequired, setFoodRequired] = useState(false);
  const [foodNeeds, setFoodNeeds] = useState("");

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

    if (mediaRequired && !mediaNeeds.trim()) {
      toast({
        title: "Media details required",
        description:
          "Describe what media is needed (sound, publicity, coverage) so the Media team can plan.",
        variant: "destructive",
      });
      return;
    }

    if (foodRequired && !foodNeeds.trim()) {
      toast({
        title: "Food details required",
        description:
          "Describe the catering needs so the Food Logistics team can plan and cost it.",
        variant: "destructive",
      });
      return;
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
          mediaRequired,
          mediaNeeds: mediaRequired ? mediaNeeds.trim() : null,
          foodRequired,
          foodNeeds: foodRequired ? foodNeeds.trim() : null,
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
      <EmptyState
        icon={Shield}
        title="Access Denied"
        description="You need Department Lead access or higher to create events."
        className="py-20"
        action={
          <Link href="/calendar">
            <Button variant="outline">Back to Calendar</Button>
          </Link>
        }
      />
    );
  }

  if (submitted) {
    const isApproved = submitted.approvalStatus === "APPROVED";
    return (
      <div className="mx-auto max-w-xl">
        <div className={cn("relative overflow-hidden p-8 text-center sm:p-12", luxSurface)}>
          <span
            aria-hidden
            className={cn(
              "absolute left-1/2 top-10 h-36 w-36 -translate-x-1/2 rounded-full opacity-[0.16] blur-3xl",
              isApproved ? "bg-green-400" : "bg-amber-400"
            )}
          />
          <div className="relative flex flex-col items-center">
            <span
              className={cn(
                "flex h-20 w-20 items-center justify-center rounded-3xl ring-1 ring-inset ring-white/50",
                isApproved ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
              )}
            >
              <CheckCircle2 className="h-10 w-10" />
            </span>
            <h2 className="mt-6 font-display text-2xl font-bold text-clay-700">
              {isApproved ? "Event Created!" : "Submitted for Approval"}
            </h2>
            <p className="mt-2 max-w-md text-clay-500">
              {isApproved
                ? `"${submitted.title}" is now visible on the calendar.`
                : `"${submitted.title}" has been submitted and is pending review by the Events & Fellowship team.`}
            </p>
            {!isApproved && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                <Clock className="h-4 w-4 shrink-0" />
                <span>You will receive a notification once it is reviewed.</span>
              </div>
            )}
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button
                variant="outline"
                className="rounded-xl"
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
              <Button variant="gold" className="rounded-xl" onClick={() => router.push("/calendar")}>
                Go to Calendar
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Live summary derived values ───
  const typeLabel = EVENT_TYPE_CONFIG[type]?.label ?? type;
  const deptName = departments.find((d) => d.id === createdByDepartmentId)?.name ?? null;
  const startPreview = date
    ? format(new Date(`${date}T${time || "09:00"}`), "EEE, d MMM yyyy 'at' h:mm a")
    : null;
  const extraFlags = [
    isPaid && { label: "Paid entry", tone: "bg-amber-50 text-amber-700" },
    transportRequired && { label: "Transport", tone: "bg-teal/10 text-teal-dark" },
    budgetRequested && { label: "Funds", tone: "bg-gold/15 text-gold-dark" },
    mediaRequired && { label: "Media", tone: "bg-[#E6E8F6] text-[#6E74B8]" },
    foodRequired && { label: "Food", tone: "bg-[#F6E6EA] text-[#BC7488]" },
  ].filter(Boolean) as { label: string; tone: string }[];

  const submitDisabled =
    submitting ||
    !title ||
    !date ||
    !venue ||
    !objective.trim() ||
    (isPaid && (!attendanceFee.trim() || !attendanceFeeCurrency.trim())) ||
    (transportRequired && !transportNeeds.trim()) ||
    (budgetRequested &&
      (!budgetAmount.trim() || !budgetCurrency.trim() || !budgetPurpose.trim())) ||
    (mediaRequired && !mediaNeeds.trim()) ||
    (foodRequired && !foodNeeds.trim());

  return (
    <div className="space-y-7">
      <PageHeader
        backHref="/calendar"
        icon={CalendarPlus}
        tone="periwinkle"
        title="Create New Event"
        description={
          userData && hasMinRole(userData.role, "ADMIN")
            ? "Events you create will be automatically approved."
            : "Events will be reviewed by the Events & Fellowship team before appearing on the calendar."
        }
      />

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
        {/* Main form column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Event Details */}
          <FormSection
            icon={CalendarPlus}
            tone="periwinkle"
            title="Event Details"
            helper="The essentials — what it's called, its type, and which department is leading it."
          >
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Event title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="type">Event Type *</Label>
                <Select value={type} onValueChange={(v: EventType) => setType(v)}>
                  <SelectTrigger id="type" className={inputCls}>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVENT_TYPE_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", cfg.dotColor)} />
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
                  <SelectTrigger id="dept" className={inputCls}>
                    <SelectValue placeholder={loadingDepts ? "Loading..." : "Select department"} />
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
          </FormSection>

          {/* Schedule & Location */}
          <FormSection
            icon={CalendarRange}
            tone="teal"
            title="Schedule & Location"
            helper="When the event runs and where it will be held."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date" className="flex items-center gap-1.5">
                  <CalendarRange className="h-3.5 w-3.5 text-teal" />
                  Start Date *
                </Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time" className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-teal" />
                  Start Time
                </Label>
                <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="venue" className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-teal" />
                  Venue *
                </Label>
                <Input
                  id="venue"
                  placeholder="Event venue or location"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  required
                  className={inputCls}
                />
              </div>
            </div>
          </FormSection>

          {/* Purpose & Information */}
          <FormSection
            icon={Target}
            tone="gold"
            title="Purpose & Information"
            helper="Why it's happening and who it's for."
          >
            <div className="space-y-2">
              <Label htmlFor="objective" className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-gold-dark" />
                Objective *
              </Label>
              <Textarea
                id="objective"
                placeholder="What does this event aim to achieve?"
                rows={2}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                required
                className="rounded-xl"
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
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2.5">
              <Label className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-gold-dark" />
                Life Group Targeting
              </Label>
              <p className="text-xs text-clay-400">
                Members of the selected group will receive notifications.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {LIFE_GROUP_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setLifeGroupTarget(opt.value)}
                    className={cn(
                      "rounded-xl border-2 px-3 py-2.5 text-center text-sm font-medium transition-all",
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
            </div>
          </FormSection>

          {/* Speaker & Additional Details */}
          <FormSection
            icon={Mic}
            tone="lavender"
            title="Speaker & Additional Details"
            helper="Name a speaker and assign any known coordination roles."
            badge={
              <Badge variant="outline" className="text-xs font-normal">
                Optional
              </Badge>
            }
          >
            <div className="space-y-2">
              <Label htmlFor="speaker" className="flex items-center gap-1.5">
                <Mic className="h-3.5 w-3.5 text-[#8A6CB0]" />
                Speaker
              </Label>
              <Input
                id="speaker"
                placeholder="Name of the speaker (leave blank if none)"
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="space-y-2.5">
              <Label className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-[#8A6CB0]" />
                Core Roles
              </Label>
              <p className="text-xs text-clay-400">
                Assign members now or leave them for later assignment.
              </p>
              <div className="space-y-2">
                {coreRoles.map((role, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="flex-1">
                      <Label className="mb-1 block text-xs text-clay-500">{role.role}</Label>
                      <div className="relative">
                        {role.assignedUserName ? (
                          <div className="flex h-10 items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3">
                            <span className="flex-1 truncate text-sm text-clay-800">{role.assignedUserName}</span>
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
                              className="h-10 rounded-xl"
                            />
                            {coreRolePickerIdx === idx && (
                              <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-xl border border-clay-200 bg-white shadow-lg">
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
                                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-clay-50"
                                      onClick={() => {
                                        updateCoreRole(idx, user.id, user.name);
                                        setCoreRolePickerIdx(null);
                                        setCoreRoleSearch("");
                                      }}
                                    >
                                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#C8963E]/20">
                                        <span className="text-xs font-bold text-[#C8963E]">
                                          {user.name.charAt(0).toUpperCase()}
                                        </span>
                                      </div>
                                      <div className="min-w-0">
                                        <p className="truncate text-sm text-clay-800">{user.name}</p>
                                        <p className="truncate text-xs text-clay-400">{user.email}</p>
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
            </div>
          </FormSection>

          {/* Attendance & Logistics */}
          <FormSection
            icon={Ticket}
            tone="amber"
            title="Attendance & Logistics"
            helper="Flag attendance fees and any transport, funds, media or catering this event needs. Coordinators handle each before approval."
          >
            {/* Attendance */}
            <div className="space-y-2.5">
              <Label className="flex items-center gap-1.5">
                <Ticket className="h-3.5 w-3.5 text-amber-600" />
                Attendance
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <PillToggle active={!isPaid} onClick={() => setIsPaid(false)} activeClass="border-green-500 bg-green-50 text-green-700">
                  Free to attend
                </PillToggle>
                <PillToggle active={isPaid} onClick={() => setIsPaid(true)} activeClass="border-amber-500 bg-amber-50 text-amber-700">
                  Payment required
                </PillToggle>
              </div>
              {isPaid && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="attendance-fee" className="text-sm">Fee per attendee *</Label>
                    <Input id="attendance-fee" type="number" min={1} step="0.01" placeholder="e.g. 50" value={attendanceFee} onChange={(e) => setAttendanceFee(e.target.value)} className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="attendance-fee-currency" className="text-sm">Currency *</Label>
                    <Input id="attendance-fee-currency" placeholder="ZMW" value={attendanceFeeCurrency} onChange={(e) => setAttendanceFeeCurrency(e.target.value)} className={inputCls} />
                  </div>
                </div>
              )}
            </div>

            <div className="h-px bg-clay-100/80" />

            {/* Transport */}
            <div className="space-y-2.5">
              <Label className="flex items-center gap-1.5">
                <Bus className="h-3.5 w-3.5 text-amber-600" />
                Transport
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <PillToggle active={!transportRequired} onClick={() => setTransportRequired(false)} activeClass="border-clay-400 bg-clay-50 text-clay-700">
                  No transport needed
                </PillToggle>
                <PillToggle active={transportRequired} onClick={() => setTransportRequired(true)} activeClass="border-amber-500 bg-amber-50 text-amber-700">
                  Transport required
                </PillToggle>
              </div>
              {transportRequired && (
                <div className="space-y-1.5">
                  <Label htmlFor="transport-needs" className="text-sm">Describe transport needs *</Label>
                  <Textarea id="transport-needs" placeholder="e.g. Pickup from UNZA and TAU campuses, ~40 people, return after the event ends" rows={3} value={transportNeeds} onChange={(e) => setTransportNeeds(e.target.value)} className="rounded-xl" />
                  <p className="text-xs text-clay-400">The Transport Coordinator will use this to plan vehicles, schedule, and cost.</p>
                </div>
              )}
            </div>

            <div className="h-px bg-clay-100/80" />

            {/* Funds */}
            <div className="space-y-2.5">
              <Label className="flex items-center gap-1.5">
                <Banknote className="h-3.5 w-3.5 text-amber-600" />
                Funds Request
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <PillToggle active={!budgetRequested} onClick={() => setBudgetRequested(false)} activeClass="border-clay-400 bg-clay-50 text-clay-700">
                  No funds needed
                </PillToggle>
                <PillToggle active={budgetRequested} onClick={() => setBudgetRequested(true)} activeClass="border-amber-500 bg-amber-50 text-amber-700">
                  Request funds
                </PillToggle>
              </div>
              {budgetRequested && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="budget-amount" className="text-sm">Amount *</Label>
                      <Input id="budget-amount" type="number" min={1} step="0.01" placeholder="e.g. 1500" value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} className={inputCls} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="budget-currency" className="text-sm">Currency *</Label>
                      <Input id="budget-currency" placeholder="ZMW" value={budgetCurrency} onChange={(e) => setBudgetCurrency(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="budget-purpose" className="text-sm">What are the funds for? *</Label>
                    <Textarea id="budget-purpose" placeholder="e.g. Refreshments for ~60 attendees and printed booklets" rows={3} value={budgetPurpose} onChange={(e) => setBudgetPurpose(e.target.value)} className="rounded-xl" />
                    <p className="text-xs text-clay-400">The treasurer may approve the full amount, reduce it, or reject the request with feedback.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="h-px bg-clay-100/80" />

            {/* Media */}
            <div className="space-y-2.5">
              <Label className="flex items-center gap-1.5">
                <Clapperboard className="h-3.5 w-3.5 text-amber-600" />
                Media
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <PillToggle active={!mediaRequired} onClick={() => setMediaRequired(false)} activeClass="border-clay-400 bg-clay-50 text-clay-700">
                  No media needed
                </PillToggle>
                <PillToggle active={mediaRequired} onClick={() => setMediaRequired(true)} activeClass="border-amber-500 bg-amber-50 text-amber-700">
                  Media required
                </PillToggle>
              </div>
              {mediaRequired && (
                <div className="space-y-1.5">
                  <Label htmlFor="media-needs" className="text-sm">Describe media needs *</Label>
                  <Textarea id="media-needs" placeholder="e.g. Sound system for ~80 people, publicity poster a week before, photo coverage on the day" rows={3} value={mediaNeeds} onChange={(e) => setMediaNeeds(e.target.value)} className="rounded-xl" />
                  <p className="text-xs text-clay-400">The Media coordinator will use this to assign Sound, Publicity, and Coverage.</p>
                </div>
              )}
            </div>

            <div className="h-px bg-clay-100/80" />

            {/* Food */}
            <div className="space-y-2.5">
              <Label className="flex items-center gap-1.5">
                <UtensilsCrossed className="h-3.5 w-3.5 text-amber-600" />
                Food &amp; Catering
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <PillToggle active={!foodRequired} onClick={() => setFoodRequired(false)} activeClass="border-clay-400 bg-clay-50 text-clay-700">
                  No food needed
                </PillToggle>
                <PillToggle active={foodRequired} onClick={() => setFoodRequired(true)} activeClass="border-amber-500 bg-amber-50 text-amber-700">
                  Food required
                </PillToggle>
              </div>
              {foodRequired && (
                <div className="space-y-1.5">
                  <Label htmlFor="food-needs" className="text-sm">Describe food needs *</Label>
                  <Textarea id="food-needs" placeholder="e.g. Lunch for ~60 people, vegetarian options, served after the morning session" rows={3} value={foodNeeds} onChange={(e) => setFoodNeeds(e.target.value)} className="rounded-xl" />
                  <p className="text-xs text-clay-400">The Food Logistics lead will use this to plan catering and request funds if needed.</p>
                </div>
              )}
            </div>
          </FormSection>
        </div>

        {/* Event Summary panel */}
        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-6 space-y-4">
            <div className={cn("relative overflow-hidden p-6", luxSurface)}>
              {/* botanical ornament */}
              <BotanicalCorner className="pointer-events-none absolute -right-2 -top-2 h-24 w-24 text-[#8FAE8B]/40" />
              <DecorImage
                src="/images/dashboard/asset-botanical-corner.png"
                className="absolute right-0 top-0 h-24 w-24 object-contain opacity-50"
              />

              <div className="relative flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/15 text-gold-dark">
                  <Sparkles className="h-4 w-4" />
                </span>
                <h3 className="font-display text-lg font-semibold text-clay-700">Event Summary</h3>
              </div>

              <div className="relative mt-4 divide-y divide-clay-100/80">
                <SummaryRow icon={Tag} label="Title" value={title.trim() || <span className="text-clay-400">Untitled event</span>} />
                <SummaryRow
                  icon={CalendarPlus}
                  label="Type"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <span className={cn("h-2 w-2 rounded-full", EVENT_TYPE_CONFIG[type]?.dotColor)} />
                      {typeLabel}
                    </span>
                  }
                />
                <SummaryRow icon={CalendarRange} label="Date & Time" value={startPreview || <span className="text-clay-400">Not set</span>} />
                <SummaryRow icon={MapPin} label="Venue" value={venue.trim() || <span className="text-clay-400">Not set</span>} />
                <SummaryRow icon={Users} label="Department" value={deptName || <span className="text-clay-400">Not set</span>} />
                <SummaryRow icon={Target} label="Objective" value={objective.trim() || <span className="text-clay-400">Not set</span>} />
              </div>

              {extraFlags.length > 0 && (
                <div className="relative mt-3 flex flex-wrap gap-1.5 border-t border-clay-100/80 pt-3">
                  {extraFlags.map((f) => (
                    <span key={f.label} className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", f.tone)}>
                      {f.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Tip box */}
            <div className="flex items-start gap-3 rounded-2xl border border-gold/25 bg-gold/[0.06] p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold-dark">
                <Lightbulb className="h-4 w-4" />
              </span>
              <p className="text-xs leading-relaxed text-clay-600">
                Add a clear objective and flag any transport, funds, media or food early — coordinators
                are notified the moment your event is created.
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <Button type="submit" variant="gold" disabled={submitDisabled} className="h-12 w-full rounded-xl text-base shadow-sm">
                {submitting ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Creating...
                  </>
                ) : (
                  "Create Event"
                )}
              </Button>
              <Link href="/calendar" className="block">
                <Button type="button" variant="outline" className="w-full rounded-xl">
                  Cancel
                </Button>
              </Link>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}
