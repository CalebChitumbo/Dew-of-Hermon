"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CAMPS, DEFAULT_CAMP_ID } from "@/lib/camps";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCampLeadAccess } from "@/hooks/useCampLeadAccess";
import { PageLoader } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  StatCardLux,
  EmptyStateLux,
  DecorImage,
  luxSurface,
} from "@/components/shared/lux";
import { TentScene } from "@/components/shared/illustrations";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { format, parseISO } from "date-fns";
import {
  Search,
  Tent,
  Users,
  CheckCircle2,
  Clock,
  DollarSign,
  HeartHandshake,
  Mail,
  Megaphone,
  ScanLine,
  Ticket,
  DoorOpen,
  Trash2,
  RefreshCw,
  UserCheck,
  UserPlus,
  UtensilsCrossed,
  Printer,
  SlidersHorizontal,
  FileSpreadsheet,
} from "lucide-react";
import { downloadCampQrTags } from "@/lib/camp-qr-tags";
import { cn } from "@/lib/utils";
import type { CampPaymentStatus } from "@/types";

interface RegistrationRow {
  id: string;
  campId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: "MALE" | "FEMALE";
  phone: string;
  email: string | null;
  churchOrSchool: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string | null;
  medicalNotes: string | null;
  allergies: string | null;
  medications: string | null;
  tshirtSize: string;
  dietaryPreference: string | null;
  parentName: string | null;
  parentRelationship: string | null;
  parentAltPhone: string | null;
  parentEmail: string | null;
  address: string | null;
  dropoffLocation: "CHURCH" | "CAMPSITE" | null;
  notes: string | null;
  consentGiven: boolean;
  paymentStatus: CampPaymentStatus;
  paymentAmount: number | null;
  paymentReference: string | null;
  paymentNotes: string | null;
  paymentMarkedByName: string | null;
  paymentMarkedAt: string | null;
  sponsorshipId: string | null;
  sponsorName: string | null;
  sponsorshipAssignedAt: string | null;
  checkInCode: string | null;
  checkedIn: boolean;
  checkedInAt: string | null;
  checkedInByName: string | null;
  /** Temporarily off-site on an approved exit pass. */
  onPass: boolean;
  qrEmailSentAt: string | null;
  qrEmailSentTo: string | null;
  qrEmailCount: number;
  createdAt: string;
}

/** Live registration cap for a camp, as returned by the capacity endpoint. */
interface CapacitySettings {
  campId: string;
  capacity: number;
  /** Capacity the camp was planned with, before any admin override. */
  defaultCapacity: number | null;
  isOverridden: boolean;
  capacityUpdatedAt: string | null;
  capacityUpdatedByName: string | null;
  registered: number;
}

/** Recipient the QR/details email would go to, mirroring the server rule. */
function emailRecipient(row: RegistrationRow): string | null {
  return row.parentEmail ?? row.email ?? null;
}

/** Grid cell for a "Camp tools" entry — a full-width tile until the row wraps. */
const toolShell = "w-full lg:w-auto";
/** The tool's button face: label pinned left so the strip reads as a list. */
const toolButton = "w-full justify-start rounded-xl";

export default function RopsCampAdminPage() {
  const { loading, canManage } = useCampLeadAccess();
  if (loading) return <PageLoader />;
  if (!canManage) {
    return (
      <EmptyStateLux
        icon={Tent}
        tone="clay"
        title="Access Denied"
        description="You don't have permission to view ROPs Camp registrations."
        className="min-h-[60vh] justify-center"
      />
    );
  }
  return <RopsCampAdminInner />;
}

function RopsCampAdminInner() {
  const { toast } = useToast();
  const { userData } = useAuth();
  const isSuperAdmin = userData?.role === "SUPER_ADMIN";
  const [campId, setCampId] = useState<string>(DEFAULT_CAMP_ID);
  const camp = useMemo(() => CAMPS.find((c) => c.id === campId)!, [campId]);

  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | CampPaymentStatus | "SPONSORED" | "UNSPONSORED"
  >("all");
  const [tagsBusy, setTagsBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [editing, setEditing] = useState<RegistrationRow | null>(null);
  const [deleting, setDeleting] = useState<RegistrationRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkOnlyUnsent, setBulkOnlyUnsent] = useState(true);
  const [capacity, setCapacity] = useState<CapacitySettings | null>(null);
  const [capacityOpen, setCapacityOpen] = useState(false);

  const loadCapacity = useCallback(async () => {
    try {
      const res = await fetchWithAuth(
        `/api/camp-registrations/capacity?campId=${campId}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load capacity");
      setCapacity(json);
    } catch {
      // The cap is a display detail here — the registrations table still loads.
      setCapacity(null);
    }
  }, [campId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/camp-registrations?campId=${campId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setRows(json.registrations);
    } catch (err) {
      toast({
        title: "Failed to load registrations",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [campId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadCapacity();
  }, [loadCapacity]);

  const stats = useMemo(() => {
    const paid = rows.filter((r) => r.paymentStatus === "PAID").length;
    const unpaid = rows.filter((r) => r.paymentStatus === "UNPAID").length;
    const refunded = rows.filter((r) => r.paymentStatus === "REFUNDED").length;
    const checkedIn = rows.filter((r) => r.checkedIn).length;
    const onPass = rows.filter((r) => r.onPass).length;
    const revenue = rows
      .filter((r) => r.paymentStatus === "PAID")
      .reduce((sum, r) => sum + (r.paymentAmount ?? camp.fee), 0);
    return { total: rows.length, paid, unpaid, refunded, checkedIn, onPass, revenue };
  }, [rows, camp.fee]);

  /** The cap in force — the live setting, falling back to the catalog value. */
  const effectiveCapacity = capacity?.capacity ?? camp.capacity;
  const spotsLeft = Math.max(0, effectiveCapacity - stats.total);

  const bulkTargets = useMemo(() => {
    const withEmail = rows.filter((r) => emailRecipient(r));
    return {
      all: withEmail,
      unsent: withEmail.filter((r) => !r.qrEmailSentAt),
      noEmail: rows.length - withEmail.length,
    };
  }, [rows]);

  /**
   * Build the printable QR tag sheet. The tags are cut out and stuck onto the
   * camp IDs, so a camper's ID doubles as their gate pass and meal card and the
   * meal register never depends on a camper owning a phone.
   */
  const printQrTags = async () => {
    setTagsBusy(true);
    try {
      await downloadCampQrTags(
        rows.map((r) => ({
          id: r.id,
          firstName: r.firstName,
          lastName: r.lastName,
          checkInCode: r.checkInCode,
        })),
        camp.name,
        window.location.origin
      );
      const missing = rows.filter((r) => !r.checkInCode).length;
      const printed = rows.length - missing;
      toast({
        title: "QR tag sheet downloaded",
        description: missing
          ? `${printed} tags. ${missing} camper(s) have no code yet — email their QR pass first.`
          : `${printed} tags, 20 per page. Each camper's name prints above the cut line.`,
      });
    } catch (err) {
      toast({
        title: "Couldn't build the QR tags",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setTagsBusy(false);
    }
  };

  /**
   * Download the camper register as a spreadsheet. Built server-side so the
   * sheet carries every stored field — including the ones this table never
   * loads — rather than only what's on screen. Always the whole camp, not the
   * current search/filter.
   */
  const exportToExcel = async () => {
    setExportBusy(true);
    try {
      const res = await fetchWithAuth(
        `/api/camp-registrations/export?campId=${campId}`
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to build the spreadsheet");
      }
      const blob = await res.blob();
      // Filename comes from the server's Content-Disposition; fall back to a
      // sensible one if a proxy strips the header.
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = match?.[1] ?? "campers.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Deferred — Safari cancels the download if the blob URL is revoked in
      // the same tick as the click.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({
        title: "Register exported",
        description: `${rows.length} camper${rows.length === 1 ? "" : "s"}, every field, plus a summary sheet. Contains medical and guardian details — handle it accordingly.`,
      });
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setExportBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter === "SPONSORED") {
        if (!r.sponsorshipId) return false;
      } else if (statusFilter === "UNSPONSORED") {
        if (r.sponsorshipId) return false;
      } else if (statusFilter !== "all" && r.paymentStatus !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const hay = `${r.firstName} ${r.lastName} ${r.phone} ${r.email ?? ""} ${r.churchOrSchool} ${r.parentName ?? ""} ${r.parentEmail ?? ""} ${r.sponsorName ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, statusFilter]);

  const quickToggle = async (row: RegistrationRow) => {
    const next: CampPaymentStatus = row.paymentStatus === "PAID" ? "UNPAID" : "PAID";
    try {
      const res = await fetchWithAuth(`/api/camp-registrations/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentStatus: next,
          paymentAmount: next === "PAID" ? row.paymentAmount ?? camp.fee : row.paymentAmount,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast({
        title: next === "PAID" ? "Marked as paid" : "Marked as unpaid",
        description: `${row.firstName} ${row.lastName}`,
      });
      await load();
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const sendQrEmail = async (row: RegistrationRow) => {
    const recipient = emailRecipient(row);
    if (!recipient) {
      toast({
        title: "No email address",
        description: `${row.firstName} ${row.lastName}'s registration has no email on file. Add one via Details first.`,
        variant: "destructive",
      });
      return;
    }
    setSendingIds((prev) => new Set(prev).add(row.id));
    try {
      const res = await fetchWithAuth(`/api/camp-registrations/send-qr-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [row.id] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      const outcome = json.outcomes?.[0];
      if (outcome?.status === "sent") {
        toast({
          title: "Email sent",
          description: `Registration details + QR pass sent to ${outcome.to}`,
        });
        await load();
      } else {
        throw new Error(outcome?.reason || "Email could not be sent");
      }
    } catch (err) {
      toast({
        title: "Send failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSendingIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  };

  const bulkSend = async () => {
    const targets = bulkOnlyUnsent ? bulkTargets.unsent : bulkTargets.all;
    if (targets.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetchWithAuth(`/api/camp-registrations/send-qr-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: targets.map((r) => r.id) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast({
        title: `Emails queued: ${json.sent}`,
        description:
          json.failed > 0 || json.skipped > 0
            ? `${json.skipped} skipped, ${json.failed} failed — see per-camper status in the table.`
            : "Every camper received their registration details and QR pass.",
        variant: json.failed > 0 ? "destructive" : undefined,
      });
      setBulkOpen(false);
      await load();
    } catch (err) {
      toast({
        title: "Bulk send failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBulkBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await fetchWithAuth(`/api/camp-registrations/${deleting.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed");
      }
      toast({
        title: "Registration deleted",
        description: `${deleting.firstName} ${deleting.lastName}`,
      });
      setDeleting(null);
      await load();
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-7">
      <PageHeader
        icon={Tent}
        tone="gold"
        title={camp.name}
        description={
          <>
            {format(parseISO(camp.startDate), "MMMM d")}–
            {format(parseISO(camp.endDate), "d, yyyy")} · Registrations & payments
          </>
        }
        actions={
          <>
            {CAMPS.length > 1 && (
              <Select value={campId} onValueChange={setCampId}>
                <SelectTrigger className="w-full rounded-xl sm:w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPS.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Link href="/manage/rops-camp/check-in" className="flex-1 sm:flex-none">
              <Button variant="gold" className="w-full rounded-xl">
                <ScanLine className="mr-2 h-4 w-4" />
                Check-in
              </Button>
            </Link>
            <Button
              variant="outline"
              className="flex-1 rounded-xl sm:flex-none"
              onClick={load}
              disabled={loading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </>
        }
      />

      {/* Scenic camp banner — fades softly into the cream background */}
      <div className={cn("relative h-32 overflow-hidden sm:h-44", luxSurface)}>
        <div className="absolute inset-0 bg-gradient-to-br from-teal/25 via-[#E6EDE4] to-cream" />
        <DecorImage
          src="/images/dashboard/asset-camp-landscape-wide.png"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-cream via-cream/45 to-transparent" />
        <span aria-hidden className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-cream/60 to-transparent" />
        <div className="relative flex h-full flex-col justify-end p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-dark">Camp season</p>
          <p className="font-display text-2xl font-bold text-clay-700 drop-shadow-sm sm:text-3xl">
            {camp.name}
          </p>
        </div>
      </div>

      {/*
        Camp tools — the secondary actions live in their own strip rather than
        the header, so the title keeps its width and nothing overflows sideways.
        Full-width tiles on phones, a wrapping row from lg up.
      */}
      <div className={cn("p-4 sm:p-5", luxSurface)}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-clay-400">
          Camp tools
        </p>
        {/* One column on the narrowest phones — "Email QR passes" needs ~148px
            and a half-width tile only offers ~141px below 380px. */}
        <div className="mt-3 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap">
          <Link href="/manage/rops-camp/announcements" className={toolShell}>
            <Button variant="outline" className={toolButton}>
              <Megaphone className="mr-2 h-4 w-4 shrink-0" />
              Announcements
            </Button>
          </Link>
          <Link href="/manage/rops-camp/meals" className={toolShell}>
            <Button variant="outline" className={toolButton}>
              <UtensilsCrossed className="mr-2 h-4 w-4 shrink-0" />
              Meals
            </Button>
          </Link>
          <Link href="/manage/rops-camp/passes" className={toolShell}>
            <Button variant="outline" className={toolButton}>
              <Ticket className="mr-2 h-4 w-4 shrink-0" />
              Exit passes
            </Button>
          </Link>
          <Link href="/manage/rops-camp/sponsorships" className={toolShell}>
            <Button variant="outline" className={toolButton}>
              <HeartHandshake className="mr-2 h-4 w-4 shrink-0" />
              Sponsorships
            </Button>
          </Link>
          <Button
            variant="outline"
            className={cn(toolShell, toolButton)}
            onClick={exportToExcel}
            disabled={loading || exportBusy || rows.length === 0}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4 shrink-0" />
            {exportBusy ? "Exporting..." : "Export to Excel"}
          </Button>
          <Button
            variant="outline"
            className={cn(toolShell, toolButton)}
            onClick={printQrTags}
            disabled={loading || tagsBusy || rows.length === 0}
          >
            <Printer className="mr-2 h-4 w-4 shrink-0" />
            {tagsBusy ? "Building..." : "Print QR tags"}
          </Button>
          <Button
            variant="outline"
            className={cn(toolShell, toolButton)}
            onClick={() => setBulkOpen(true)}
            disabled={loading || bulkTargets.all.length === 0}
          >
            <Mail className="mr-2 h-4 w-4 shrink-0" />
            Email QR passes
          </Button>
          <Button
            variant="outline"
            className={cn(toolShell, toolButton)}
            onClick={() => setCapacityOpen(true)}
          >
            <SlidersHorizontal className="mr-2 h-4 w-4 shrink-0" />
            Capacity
          </Button>
        </div>
      </div>

      {/*
        Stat cards — six across only once the columns are genuinely wide enough.
        At xl (1280px) minus the sidebar each column is ~145px, which breaks
        "80 / 200" onto two lines, so the switch waits for ~1400px.
      */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 [@media(min-width:1400px)]:grid-cols-6">
        <StatCardLux
          icon={Users}
          tone="teal"
          label="Registered"
          value={`${stats.total} / ${effectiveCapacity}`}
          hint={
            spotsLeft > 0
              ? `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`
              : "camp is full — raise the cap to reopen"
          }
          highlight={spotsLeft <= 0}
          accent="bg-teal"
          art={<Users className="h-24 w-24" strokeWidth={1} />}
        />
        <StatCardLux
          icon={CheckCircle2}
          tone="emerald"
          label="Paid"
          value={stats.paid}
          hint="payments received"
          accent="bg-green-500"
          art={<CheckCircle2 className="h-24 w-24" strokeWidth={1} />}
        />
        <StatCardLux
          icon={Clock}
          tone="amber"
          label="Unpaid"
          value={stats.unpaid}
          hint="awaiting payment"
          accent="bg-gold"
          highlight={stats.unpaid > 0}
          art={<Clock className="h-24 w-24" strokeWidth={1} />}
        />
        <StatCardLux
          icon={UserCheck}
          tone="teal"
          label="In camp"
          value={stats.checkedIn}
          hint="checked in at the gate"
          accent="bg-teal"
          art={<UserCheck className="h-24 w-24" strokeWidth={1} />}
        />
        <StatCardLux
          icon={DoorOpen}
          tone="clay"
          label="Out on pass"
          value={stats.onPass}
          hint="signed out at the gate"
          accent="bg-clay-400"
          href="/manage/rops-camp/passes"
          art={<DoorOpen className="h-24 w-24" strokeWidth={1} />}
        />
        <StatCardLux
          icon={DollarSign}
          tone="gold"
          label="Revenue"
          value={stats.revenue.toLocaleString()}
          hint={`${camp.currency} collected so far`}
          accent="bg-gold"
          art={<DollarSign className="h-24 w-24" strokeWidth={1} />}
        />
      </div>

      {/* Registrations panel */}
      <div className={cn(luxSurface)}>
        <div className="flex flex-col gap-3 border-b border-clay-100/80 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold/15 text-gold-dark">
              <Users className="h-5 w-5" />
            </span>
            <h2 className="font-display text-lg font-semibold text-clay-700">Registrations</h2>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-clay-400" />
              <Input
                placeholder="Search name, phone, church..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 w-full rounded-xl pl-9 sm:w-[240px]"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="h-11 w-full rounded-xl sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="UNPAID">Unpaid</SelectItem>
                <SelectItem value="REFUNDED">Refunded</SelectItem>
                <SelectItem value="SPONSORED">Sponsored</SelectItem>
                <SelectItem value="UNSPONSORED">Not sponsored</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="p-3 sm:p-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : filtered.length === 0 ? (
            <div
              className={cn(
                "rounded-2xl",
                rows.length === 0 && "border-2 border-dashed border-clay-200/80 bg-cream/30"
              )}
            >
              <EmptyStateLux
                illustration={rows.length === 0 ? <TentScene /> : undefined}
                icon={rows.length === 0 ? undefined : Search}
                tone="teal"
                title={rows.length === 0 ? "No registrations yet" : "No matches"}
                description={
                  rows.length === 0
                    ? "Registrations will appear here once campers sign up."
                    : "No registrations match your filters."
                }
                action={
                  rows.length === 0 ? (
                    <Link href="/rops-camp">
                      <Button variant="gold" className="gap-2 rounded-xl">
                        <UserPlus className="h-4 w-4" />
                        Register camper
                      </Button>
                    </Link>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
            {/* Desktop: full table. Phones get the stacked cards below. */}
            <div className="-mx-2 hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-clay-100 text-left text-xs uppercase tracking-wider text-clay-500">
                    <th className="px-2 py-3 font-medium">Camper</th>
                    <th className="px-2 py-3 font-medium">Contact</th>
                    <th className="px-2 py-3 font-medium">Parent / guardian</th>
                    <th className="px-2 py-3 font-medium">Drop-off</th>
                    <th className="px-2 py-3 font-medium">Status</th>
                    <th className="px-2 py-3 font-medium">Registered</th>
                    <th className="px-2 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-clay-100">
                  {filtered.map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-cream/50">
                      <td className="px-2 py-3">
                        <div className="font-medium text-clay-800">
                          {row.firstName} {row.lastName}
                        </div>
                        <div className="text-xs text-clay-500">
                          {row.gender === "MALE" ? "Male" : "Female"} · DOB {row.dateOfBirth}
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <div className="text-clay-700">{row.phone}</div>
                        {row.email && <div className="text-xs text-clay-500">{row.email}</div>}
                      </td>
                      <td className="px-2 py-3">
                        <div className="text-clay-700">{row.parentName ?? "—"}</div>
                        <div className="text-xs text-clay-500">
                          {row.parentRelationship ?? "Guardian"}
                          {row.parentAltPhone ? ` · ${row.parentAltPhone}` : ""}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-xs text-clay-700">
                        {row.dropoffLocation === "CHURCH"
                          ? "Church"
                          : row.dropoffLocation === "CAMPSITE"
                          ? "Camp site"
                          : "—"}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <PaymentBadge status={row.paymentStatus} />
                          {row.sponsorshipId && (
                            <Badge className="bg-teal/15 text-teal-dark hover:bg-teal/15">
                              Sponsored
                            </Badge>
                          )}
                          {row.onPass ? (
                            <Badge className="bg-clay-800 text-white hover:bg-clay-800">
                              <DoorOpen className="mr-1 h-3 w-3" />
                              Out on pass
                            </Badge>
                          ) : row.checkedIn ? (
                            <Badge className="bg-green-600 text-white hover:bg-green-600">
                              <UserCheck className="mr-1 h-3 w-3" />
                              In camp
                            </Badge>
                          ) : null}
                        </div>
                        {row.sponsorName && (
                          <div className="mt-1 text-[11px] text-clay-500">
                            by {row.sponsorName}
                          </div>
                        )}
                        {row.paymentMarkedAt && row.paymentStatus !== "UNPAID" && (
                          <div className="mt-1 text-[11px] text-clay-500">
                            by {row.paymentMarkedByName ?? "admin"} ·{" "}
                            {format(new Date(row.paymentMarkedAt), "MMM d")}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-3 text-xs text-clay-600">
                        {format(new Date(row.createdAt), "MMM d, yyyy")}
                        {row.qrEmailSentAt && (
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-clay-500">
                            <Mail className="h-3 w-3" />
                            QR sent {format(new Date(row.qrEmailSentAt), "MMM d")}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-lg"
                            onClick={() => sendQrEmail(row)}
                            disabled={sendingIds.has(row.id)}
                            title={
                              emailRecipient(row)
                                ? `Email registration details + QR pass to ${emailRecipient(row)}`
                                : "No email address on this registration"
                            }
                            aria-label={`Email QR pass to ${row.firstName} ${row.lastName}`}
                          >
                            {sendingIds.has(row.id) ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Mail className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant={row.paymentStatus === "PAID" ? "outline" : "default"}
                            className="rounded-lg"
                            onClick={() => quickToggle(row)}
                          >
                            {row.paymentStatus === "PAID" ? "Mark unpaid" : "Mark paid"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>
                            Details
                          </Button>
                          {isSuperAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => setDeleting(row)}
                              aria-label={`Delete registration for ${row.firstName} ${row.lastName}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: one card per camper, same actions as the table row. */}
            <div className="space-y-3 md:hidden">
              {filtered.map((row) => (
                <RegistrationCardLux
                  key={row.id}
                  row={row}
                  sending={sendingIds.has(row.id)}
                  canDelete={isSuperAdmin}
                  onEmail={() => sendQrEmail(row)}
                  onToggle={() => quickToggle(row)}
                  onDetails={() => setEditing(row)}
                  onDelete={() => setDeleting(row)}
                />
              ))}
            </div>
            </>
          )}
        </div>
      </div>

      {editing && (
        <RegistrationDialog
          row={editing}
          camp={camp}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}

      {bulkOpen && (
        <Dialog open onOpenChange={(open) => !open && !bulkBusy && setBulkOpen(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Email QR passes</DialogTitle>
              <DialogDescription>
                Sends each camper (or their parent/guardian) an email with their
                registration details, payment status, a link to create an
                account and track the registration, and their QR check-in pass
                for the camp gate.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setBulkOnlyUnsent(true)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left text-sm transition-colors",
                  bulkOnlyUnsent
                    ? "border-gold bg-gold/10"
                    : "border-clay-200 hover:bg-cream/60"
                )}
              >
                <div className="font-medium text-clay-800">
                  Only campers not yet emailed ({bulkTargets.unsent.length})
                </div>
                <div className="text-xs text-clay-500">
                  Recommended — reaches everyone who registered before this
                  feature existed.
                </div>
              </button>
              <button
                type="button"
                onClick={() => setBulkOnlyUnsent(false)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left text-sm transition-colors",
                  !bulkOnlyUnsent
                    ? "border-gold bg-gold/10"
                    : "border-clay-200 hover:bg-cream/60"
                )}
              >
                <div className="font-medium text-clay-800">
                  Everyone with an email ({bulkTargets.all.length})
                </div>
                <div className="text-xs text-clay-500">
                  Resends to campers who already received one, with their
                  current payment status.
                </div>
              </button>
              {bulkTargets.noEmail > 0 && (
                <p className="text-xs text-amber-700">
                  {bulkTargets.noEmail} registration
                  {bulkTargets.noEmail === 1 ? " has" : "s have"} no email
                  address and will be skipped.
                </p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkBusy}>
                Cancel
              </Button>
              <Button
                onClick={bulkSend}
                disabled={
                  bulkBusy ||
                  (bulkOnlyUnsent ? bulkTargets.unsent : bulkTargets.all).length === 0
                }
              >
                {bulkBusy ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send{" "}
                    {(bulkOnlyUnsent ? bulkTargets.unsent : bulkTargets.all).length}{" "}
                    email
                    {(bulkOnlyUnsent ? bulkTargets.unsent : bulkTargets.all).length === 1
                      ? ""
                      : "s"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {deleting && (
        <Dialog open onOpenChange={(open) => !open && !deleteBusy && setDeleting(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete registration?</DialogTitle>
              <DialogDescription>
                This permanently removes{" "}
                <span className="font-medium text-clay-800">
                  {deleting.firstName} {deleting.lastName}
                </span>
                &rsquo;s registration and can&rsquo;t be undone. Use this to clear duplicate entries
                or campers who have cancelled.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)} disabled={deleteBusy}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteBusy}>
                {deleteBusy ? "Deleting..." : "Delete registration"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {capacityOpen && (
        <CapacityDialog
          campId={campId}
          campName={camp.name}
          registered={stats.total}
          settings={capacity}
          fallbackCapacity={camp.capacity}
          onClose={() => setCapacityOpen(false)}
          onSaved={async () => {
            setCapacityOpen(false);
            await loadCapacity();
          }}
        />
      )}
    </div>
  );
}

/**
 * Raise (or lower) the maximum number of campers who may register. The cap
 * lives in Firestore, so changing it here takes effect on the public
 * registration page immediately — no deploy.
 */
function CapacityDialog({
  campId,
  campName,
  registered,
  settings,
  fallbackCapacity,
  onClose,
  onSaved,
}: {
  campId: string;
  campName: string;
  registered: number;
  settings: CapacitySettings | null;
  fallbackCapacity: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const current = settings?.capacity ?? fallbackCapacity;
  const [value, setValue] = useState<string>(String(current));
  const [busy, setBusy] = useState(false);

  const save = async (capacity: number | null) => {
    setBusy(true);
    try {
      const res = await fetchWithAuth(`/api/camp-registrations/capacity`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campId, capacity }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update capacity");
      toast({
        title: "Capacity updated",
        description:
          capacity === null
            ? `${campName} is back to its default of ${json.capacity} campers.`
            : `${campName} can now take ${json.capacity} campers.`,
      });
      onSaved();
    } catch (err) {
      toast({
        title: "Couldn't update capacity",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const parsed = Number(value);
  const valid =
    Number.isInteger(parsed) && parsed >= Math.max(1, registered) && parsed <= 5000;

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registration capacity</DialogTitle>
          <DialogDescription>
            The maximum number of campers who can register for {campName}. Once
            it&rsquo;s reached, the public form turns new registrations away —
            raise it here to reopen more spots.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-clay-200 bg-cream/60 p-3 text-sm text-clay-600">
            <div className="flex items-center justify-between">
              <span>Registered so far</span>
              <span className="font-medium text-clay-800">{registered}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Current maximum</span>
              <span className="font-medium text-clay-800">{current}</span>
            </div>
            {settings?.isOverridden && settings.capacityUpdatedByName && (
              <p className="mt-2 text-xs text-clay-500">
                Last changed by {settings.capacityUpdatedByName}
                {settings.capacityUpdatedAt
                  ? ` on ${format(new Date(settings.capacityUpdatedAt), "MMM d, yyyy")}`
                  : ""}
                {settings.defaultCapacity !== null
                  ? ` · planned capacity was ${settings.defaultCapacity}`
                  : ""}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="camp-capacity">New maximum</Label>
            <Input
              id="camp-capacity"
              type="number"
              min={Math.max(1, registered)}
              max={5000}
              step={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={busy}
            />
            <p className="text-xs text-clay-500">
              {registered > 0
                ? `Must be at least ${registered} — the campers already registered.`
                : "Whole number between 1 and 5000."}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {settings?.isOverridden && settings.defaultCapacity !== null && (
            <Button
              variant="outline"
              onClick={() => save(null)}
              disabled={busy}
              className="sm:mr-auto"
            >
              Reset to {settings.defaultCapacity}
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="gold"
            onClick={() => save(parsed)}
            disabled={busy || !valid || parsed === current}
          >
            {busy ? "Saving..." : "Save capacity"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentBadge({ status }: { status: CampPaymentStatus }) {
  if (status === "PAID")
    return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Paid</Badge>;
  if (status === "REFUNDED")
    return <Badge className="bg-clay-200 text-clay-700 hover:bg-clay-200">Refunded</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Unpaid</Badge>;
}

/**
 * One registration as a phone card — the table's seven columns stacked into a
 * readable block, with the same row actions along the bottom.
 */
function RegistrationCardLux({
  row,
  sending,
  canDelete,
  onEmail,
  onToggle,
  onDetails,
  onDelete,
}: {
  row: RegistrationRow;
  sending: boolean;
  canDelete: boolean;
  onEmail: () => void;
  onToggle: () => void;
  onDetails: () => void;
  onDelete: () => void;
}) {
  const dropoff =
    row.dropoffLocation === "CHURCH"
      ? "Church"
      : row.dropoffLocation === "CAMPSITE"
      ? "Camp site"
      : "—";

  return (
    <div className="rounded-2xl border border-clay-100/80 bg-white/70 p-4">
      <div className="min-w-0">
        <div className="truncate font-medium text-clay-800">
          {row.firstName} {row.lastName}
        </div>
        <div className="mt-0.5 text-xs text-clay-500">
          {row.gender === "MALE" ? "Male" : "Female"} · DOB {row.dateOfBirth}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <PaymentBadge status={row.paymentStatus} />
        {row.sponsorshipId && (
          <Badge className="bg-teal/15 text-teal-dark hover:bg-teal/15">Sponsored</Badge>
        )}
        {row.onPass ? (
          <Badge className="bg-clay-800 text-white hover:bg-clay-800">
            <DoorOpen className="mr-1 h-3 w-3" />
            Out on pass
          </Badge>
        ) : row.checkedIn ? (
          <Badge className="bg-green-600 text-white hover:bg-green-600">
            <UserCheck className="mr-1 h-3 w-3" />
            In camp
          </Badge>
        ) : null}
      </div>

      <dl className="mt-3 space-y-1.5 text-xs">
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-clay-400">Contact</dt>
          <dd className="min-w-0 flex-1 break-words text-clay-700">
            {row.phone}
            {row.email && <span className="block text-clay-500">{row.email}</span>}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-clay-400">Guardian</dt>
          <dd className="min-w-0 flex-1 break-words text-clay-700">
            {row.parentName ?? "—"}
            <span className="block text-clay-500">
              {row.parentRelationship ?? "Guardian"}
              {row.parentAltPhone ? ` · ${row.parentAltPhone}` : ""}
            </span>
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-clay-400">Drop-off</dt>
          <dd className="min-w-0 flex-1 text-clay-700">{dropoff}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-clay-400">Registered</dt>
          <dd className="min-w-0 flex-1 text-clay-700">
            {format(new Date(row.createdAt), "MMM d, yyyy")}
            {row.qrEmailSentAt && (
              <span className="block text-clay-500">
                QR sent {format(new Date(row.qrEmailSentAt), "MMM d")}
              </span>
            )}
          </dd>
        </div>
        {row.sponsorName && (
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-clay-400">Sponsor</dt>
            <dd className="min-w-0 flex-1 break-words text-clay-700">{row.sponsorName}</dd>
          </div>
        )}
      </dl>

      {/* The payment toggle takes its own row on the narrowest phones, where the
          four actions cannot share a line. */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-clay-100/80 pt-3">
        <Button
          size="sm"
          variant={row.paymentStatus === "PAID" ? "outline" : "default"}
          className="w-full rounded-lg min-[380px]:w-auto min-[380px]:flex-1"
          onClick={onToggle}
        >
          {row.paymentStatus === "PAID" ? "Mark unpaid" : "Mark paid"}
        </Button>
        <Button size="sm" variant="ghost" className="rounded-lg" onClick={onDetails}>
          Details
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-lg"
          onClick={onEmail}
          disabled={sending}
          title={
            emailRecipient(row)
              ? `Email registration details + QR pass to ${emailRecipient(row)}`
              : "No email address on this registration"
          }
          aria-label={`Email QR pass to ${row.firstName} ${row.lastName}`}
        >
          {sending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
        </Button>
        {canDelete && (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={onDelete}
            aria-label={`Delete registration for ${row.firstName} ${row.lastName}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function RegistrationDialog({
  row,
  camp,
  onClose,
  onSaved,
}: {
  row: RegistrationRow;
  camp: { id: string; fee: number; currency: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const { userData } = useAuth();
  const isSuperAdmin = userData?.role === "SUPER_ADMIN";
  const [status, setStatus] = useState<CampPaymentStatus>(row.paymentStatus);
  const [amount, setAmount] = useState<string>(
    row.paymentAmount?.toString() ?? camp.fee.toString()
  );
  const [reference, setReference] = useState(row.paymentReference ?? "");
  const [notes, setNotes] = useState(row.paymentNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/camp-registrations/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentStatus: status,
          paymentAmount: amount === "" ? null : Number(amount),
          paymentReference: reference,
          paymentNotes: notes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast({ title: "Registration updated" });
      onSaved();
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/camp-registrations/${row.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed");
      }
      toast({ title: "Registration deleted" });
      onSaved();
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {row.firstName} {row.lastName}
          </DialogTitle>
          <DialogDescription>
            Registered {format(new Date(row.createdAt), "MMM d, yyyy")}
            {row.churchOrSchool ? ` · ${row.churchOrSchool}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          <Section title="Camper">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Info label="Date of birth" value={row.dateOfBirth} />
              <Info label="Gender" value={row.gender === "MALE" ? "Male" : "Female"} />
              <Info label="T-shirt size" value={row.tshirtSize || "—"} />
              <Info label="Dietary" value={row.dietaryPreference ?? "No restrictions"} />
            </div>
          </Section>

          <Section title="Parent / guardian">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Info label="Name" value={row.parentName ?? "—"} />
              <Info label="Relationship" value={row.parentRelationship ?? "—"} />
              <Info label="Primary phone" value={row.phone} />
              <Info label="Alternative phone" value={row.parentAltPhone ?? "—"} />
              <Info label="Email" value={row.parentEmail ?? row.email ?? "—"} full />
              <Info label="Home address" value={row.address ?? "—"} full />
            </div>
          </Section>

          <Section title="Emergency contact">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Info label="Name" value={row.emergencyContactName} />
              <Info label="Relationship" value={row.emergencyContactRelationship ?? "—"} />
              <Info label="Phone" value={row.emergencyContactPhone} full />
            </div>
          </Section>

          <Section title="Health">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Info label="Allergies" value={row.allergies ?? "None reported"} />
              <Info label="Medications" value={row.medications ?? "None reported"} />
              <Info label="Medical notes" value={row.medicalNotes ?? "None reported"} full />
            </div>
          </Section>

          <Section title="Logistics">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Info
                label="Drop-off location"
                value={
                  row.dropoffLocation === "CHURCH"
                    ? "At the church"
                    : row.dropoffLocation === "CAMPSITE"
                    ? "At the camp site"
                    : "—"
                }
              />
              <Info label="Consent given" value={row.consentGiven ? "Yes" : "No"} />
              <Info label="Notes" value={row.notes ?? "—"} full />
            </div>
          </Section>

          <Section title="Check-in">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Info
                label="Status"
                value={
                  row.checkedIn
                    ? `In camp${
                        row.checkedInAt
                          ? ` since ${format(new Date(row.checkedInAt), "MMM d, HH:mm")}`
                          : ""
                      }${row.checkedInByName ? ` (by ${row.checkedInByName})` : ""}`
                    : "Not checked in yet"
                }
              />
              <Info
                label="Pass code"
                value={
                  row.checkInCode
                    ? row.checkInCode.replace(/(.{4})(?=.)/g, "$1-")
                    : "Generated when the QR email is sent"
                }
              />
              <Info
                label="QR email"
                value={
                  row.qrEmailSentAt
                    ? `Sent ${format(new Date(row.qrEmailSentAt), "MMM d, yyyy")} to ${
                        row.qrEmailSentTo ?? "—"
                      }${row.qrEmailCount > 1 ? ` (${row.qrEmailCount}×)` : ""}`
                    : "Not sent yet"
                }
                full
              />
            </div>
          </Section>
        </div>

        <div className="space-y-4 border-t border-clay-200 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-clay-500">Payment</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as CampPaymentStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNPAID">Unpaid</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="REFUNDED">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Amount ({camp.currency})</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={camp.fee.toString()}
              />
            </div>
            <div className="col-span-2">
              <Label className="mb-1.5 block">Reference</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Mobile money txn ID, receipt #, etc."
              />
            </div>
            <div className="col-span-2">
              <Label className="mb-1.5 block">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Internal notes about this payment"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {confirmDelete ? (
            <>
              <span className="mr-auto self-center text-sm text-red-600">Delete this registration?</span>
              <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={remove} disabled={saving}>
                Confirm delete
              </Button>
            </>
          ) : (
            <>
              {isSuperAdmin && (
                <Button
                  variant="ghost"
                  className="mr-auto text-red-600 hover:text-red-700"
                  onClick={() => setConfirmDelete(true)}
                  disabled={saving}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Delete
                </Button>
              )}
              <Button variant="outline" onClick={onClose} disabled={saving}>
                Close
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="text-xs uppercase tracking-wider text-clay-500">{label}</div>
      <div className="mt-0.5 whitespace-pre-wrap break-words text-clay-800">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-clay-200 pt-4 first:border-t-0 first:pt-0">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-clay-500">{title}</h3>
      {children}
    </div>
  );
}
