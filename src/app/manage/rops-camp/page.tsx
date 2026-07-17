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
  Trash2,
  RefreshCw,
  UserPlus,
} from "lucide-react";
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
  createdAt: string;
}

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
  const [editing, setEditing] = useState<RegistrationRow | null>(null);
  const [deleting, setDeleting] = useState<RegistrationRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

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

  const stats = useMemo(() => {
    const paid = rows.filter((r) => r.paymentStatus === "PAID").length;
    const unpaid = rows.filter((r) => r.paymentStatus === "UNPAID").length;
    const refunded = rows.filter((r) => r.paymentStatus === "REFUNDED").length;
    const revenue = rows
      .filter((r) => r.paymentStatus === "PAID")
      .reduce((sum, r) => sum + (r.paymentAmount ?? camp.fee), 0);
    return { total: rows.length, paid, unpaid, refunded, revenue };
  }, [rows, camp.fee]);

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
                <SelectTrigger className="w-[220px] rounded-xl">
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
            <Link href="/manage/rops-camp/sponsorships">
              <Button variant="outline" className="rounded-xl">
                <HeartHandshake className="mr-2 h-4 w-4" />
                Sponsorships
              </Button>
            </Link>
            <Button variant="outline" className="rounded-xl" onClick={load} disabled={loading}>
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCardLux
          icon={Users}
          tone="teal"
          label="Registered"
          value={stats.total}
          hint="campers signed up"
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
          icon={DollarSign}
          tone="gold"
          label="Revenue"
          value={`${camp.currency} ${stats.revenue.toLocaleString()}`}
          hint="collected so far"
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
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-clay-400" />
              <Input
                placeholder="Search name, phone, church..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 w-[200px] rounded-xl pl-9 sm:w-[260px]"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="h-11 w-[150px] rounded-xl">
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
            <div className="-mx-2 overflow-x-auto">
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
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center justify-end gap-2">
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
    </div>
  );
}

function PaymentBadge({ status }: { status: CampPaymentStatus }) {
  if (status === "PAID")
    return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Paid</Badge>;
  if (status === "REFUNDED")
    return <Badge className="bg-clay-200 text-clay-700 hover:bg-clay-200">Refunded</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Unpaid</Badge>;
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
