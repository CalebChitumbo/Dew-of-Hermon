"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CAMPS, DEFAULT_CAMP_ID } from "@/lib/camps";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCampLeadAccess } from "@/hooks/useCampLeadAccess";
import { PageLoader, LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCardLux, EmptyStateLux, luxSurface } from "@/components/shared/lux";
import { buildPaymentReference } from "@/components/rops-camp/PaymentInstructionsCard";
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
import { format } from "date-fns";
import {
  ArrowLeft,
  CheckCircle2,
  DollarSign,
  HeartHandshake,
  RefreshCw,
  Search,
  Ticket,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CampSponsorshipPaymentStatus,
  CampSponsorshipPledgeType,
} from "@/types";

interface SponsorshipRow {
  id: string;
  campId: string;
  sponsorName: string;
  organization: string | null;
  phone: string;
  email: string | null;
  pledgeType: CampSponsorshipPledgeType;
  slotsPledged: number;
  amountPledged: number;
  slotsAssigned: number;
  notes: string | null;
  paymentStatus: CampSponsorshipPaymentStatus;
  amountReceived: number | null;
  paymentReference: string | null;
  paymentNotes: string | null;
  paymentMarkedByName: string | null;
  paymentMarkedAt: string | null;
  createdAt: string;
}

interface RegistrationLite {
  id: string;
  firstName: string;
  lastName: string;
  gender: "MALE" | "FEMALE";
  phone: string;
  churchOrSchool: string;
  paymentStatus: "UNPAID" | "PAID" | "REFUNDED";
  sponsorshipId: string | null;
  sponsorName: string | null;
  createdAt: string;
}

export default function SponsorshipsAdminPage() {
  const { loading, canManage } = useCampLeadAccess();
  if (loading) return <PageLoader />;
  if (!canManage) {
    return (
      <EmptyStateLux
        icon={HeartHandshake}
        tone="clay"
        title="Access Denied"
        description="You don't have permission to view ROPs Camp sponsorships."
        className="min-h-[60vh] justify-center"
      />
    );
  }
  return <SponsorshipsAdminInner />;
}

function SponsorshipsAdminInner() {
  const { toast } = useToast();
  const { userData } = useAuth();
  const isSuperAdmin = userData?.role === "SUPER_ADMIN";
  const [campId, setCampId] = useState<string>(DEFAULT_CAMP_ID);
  const camp = useMemo(() => CAMPS.find((c) => c.id === campId)!, [campId]);

  const [rows, setRows] = useState<SponsorshipRow[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sponsorshipsRes, registrationsRes] = await Promise.all([
        fetchWithAuth(`/api/camp-sponsorships?campId=${campId}`),
        fetchWithAuth(`/api/camp-registrations?campId=${campId}`),
      ]);
      const sponsorshipsJson = await sponsorshipsRes.json();
      if (!sponsorshipsRes.ok)
        throw new Error(sponsorshipsJson.error || "Failed to load");
      const registrationsJson = await registrationsRes.json();
      if (!registrationsRes.ok)
        throw new Error(registrationsJson.error || "Failed to load");
      setRows(sponsorshipsJson.sponsorships);
      setRegistrations(registrationsJson.registrations);
    } catch (err) {
      toast({
        title: "Failed to load sponsorships",
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
    const pledged = rows.reduce((sum, r) => sum + r.slotsPledged, 0);
    const assigned = rows.reduce((sum, r) => sum + r.slotsAssigned, 0);
    const value = rows.reduce((sum, r) => sum + r.amountPledged, 0);
    const received = rows.reduce((sum, r) => sum + (r.amountReceived ?? 0), 0);
    return { pledged, assigned, available: pledged - assigned, value, received };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.sponsorName} ${r.organization ?? ""} ${r.phone} ${r.email ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  // Dialogs derive their row from state so a reload refreshes their content.
  const editing = rows.find((r) => r.id === editingId) ?? null;
  const assigning = rows.find((r) => r.id === assigningId) ?? null;

  return (
    <div className="space-y-7">
      <PageHeader
        icon={HeartHandshake}
        tone="gold"
        title="Camp Sponsorships"
        description={`${camp.name} · Pledges, slots & allocations`}
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
            <Link href="/manage/rops-camp">
              <Button variant="outline" className="rounded-xl">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Registrations
              </Button>
            </Link>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={load}
              disabled={loading}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCardLux
          icon={Ticket}
          tone="teal"
          label="Slots pledged"
          value={stats.pledged}
          hint={`across ${rows.length} pledge${rows.length === 1 ? "" : "s"}`}
          accent="bg-teal"
          art={<Ticket className="h-24 w-24" strokeWidth={1} />}
        />
        <StatCardLux
          icon={CheckCircle2}
          tone="emerald"
          label="Slots allocated"
          value={stats.assigned}
          hint="campers sponsored"
          accent="bg-green-500"
          art={<CheckCircle2 className="h-24 w-24" strokeWidth={1} />}
        />
        <StatCardLux
          icon={Users}
          tone="amber"
          label="Slots available"
          value={stats.available}
          hint="waiting to be allocated"
          accent="bg-gold"
          highlight={stats.available > 0}
          art={<Users className="h-24 w-24" strokeWidth={1} />}
        />
        <StatCardLux
          icon={DollarSign}
          tone="gold"
          label="Pledged value"
          value={`${camp.currency} ${stats.value.toLocaleString()}`}
          hint={`${camp.currency} ${stats.received.toLocaleString()} received`}
          accent="bg-gold"
          art={<DollarSign className="h-24 w-24" strokeWidth={1} />}
        />
      </div>

      {/* Sponsorships panel */}
      <div className={cn(luxSurface)}>
        <div className="flex flex-col gap-3 border-b border-clay-100/80 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold/15 text-gold-dark">
              <HeartHandshake className="h-5 w-5" />
            </span>
            <h2 className="font-display text-lg font-semibold text-clay-700">
              Sponsorship pledges
            </h2>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-clay-400" />
            <Input
              placeholder="Search sponsor, phone, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-[220px] rounded-xl pl-9 sm:w-[280px]"
            />
          </div>
        </div>

        <div className="p-3 sm:p-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyStateLux
              icon={rows.length === 0 ? HeartHandshake : Search}
              tone="teal"
              title={rows.length === 0 ? "No pledges yet" : "No matches"}
              description={
                rows.length === 0
                  ? "Sponsorship pledges will appear here once sponsors sign up on the camp page."
                  : "No pledges match your search."
              }
              action={
                rows.length === 0 ? (
                  <Link href="/rops-camp/sponsor">
                    <Button variant="gold" className="gap-2 rounded-xl">
                      <HeartHandshake className="h-4 w-4" />
                      Open sponsor page
                    </Button>
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-clay-100 text-left text-xs uppercase tracking-wider text-clay-500">
                    <th className="px-2 py-3 font-medium">Sponsor</th>
                    <th className="px-2 py-3 font-medium">Contact</th>
                    <th className="px-2 py-3 font-medium">Pledge</th>
                    <th className="px-2 py-3 font-medium">Slots</th>
                    <th className="px-2 py-3 font-medium">Payment</th>
                    <th className="px-2 py-3 font-medium">Pledged</th>
                    <th className="px-2 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-clay-100">
                  {filtered.map((row) => {
                    const remaining = row.slotsPledged - row.slotsAssigned;
                    return (
                      <tr key={row.id} className="transition-colors hover:bg-cream/50">
                        <td className="px-2 py-3">
                          <div className="font-medium text-clay-800">
                            {row.sponsorName}
                          </div>
                          <div className="text-xs text-clay-500">
                            {row.organization ?? "Individual"} · Ref{" "}
                            {buildPaymentReference(row.id)}
                          </div>
                        </td>
                        <td className="px-2 py-3">
                          <div className="text-clay-700">{row.phone}</div>
                          {row.email && (
                            <div className="text-xs text-clay-500">{row.email}</div>
                          )}
                        </td>
                        <td className="px-2 py-3">
                          <div className="text-clay-700">
                            {camp.currency} {row.amountPledged.toLocaleString()}
                          </div>
                          <div className="text-xs text-clay-500">
                            {row.pledgeType === "SLOTS"
                              ? `${row.slotsPledged} youth pledged`
                              : `amount · covers ${row.slotsPledged}`}
                          </div>
                        </td>
                        <td className="px-2 py-3">
                          <SlotMeter
                            assigned={row.slotsAssigned}
                            pledged={row.slotsPledged}
                          />
                        </td>
                        <td className="px-2 py-3">
                          <SponsorPaymentBadge status={row.paymentStatus} />
                          {row.amountReceived !== null && (
                            <div className="mt-1 text-[11px] text-clay-500">
                              {camp.currency} {row.amountReceived.toLocaleString()}{" "}
                              received
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
                              variant={remaining > 0 ? "default" : "outline"}
                              className="rounded-lg"
                              disabled={remaining <= 0}
                              onClick={() => setAssigningId(row.id)}
                            >
                              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                              {remaining > 0 ? "Assign" : "Full"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingId(row.id)}
                            >
                              Details
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {assigning && (
        <AssignDialog
          sponsorship={assigning}
          registrations={registrations}
          camp={camp}
          onClose={() => setAssigningId(null)}
          onChanged={load}
        />
      )}

      {editing && (
        <SponsorshipDialog
          row={editing}
          registrations={registrations}
          camp={camp}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setEditingId(null)}
          onChanged={load}
          onSaved={async () => {
            setEditingId(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function SlotMeter({ assigned, pledged }: { assigned: number; pledged: number }) {
  const pct = pledged > 0 ? Math.min(100, (assigned / pledged) * 100) : 0;
  return (
    <div className="min-w-[110px]">
      <div className="text-clay-700">
        {assigned} / {pledged}
        <span className="ml-1.5 text-xs text-clay-500">
          {pledged - assigned > 0 ? `${pledged - assigned} open` : "full"}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-clay-100">
        <div
          className={cn("h-full rounded-full", pct >= 100 ? "bg-green-500" : "bg-teal")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SponsorPaymentBadge({ status }: { status: CampSponsorshipPaymentStatus }) {
  if (status === "PAID")
    return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Paid</Badge>;
  if (status === "PARTIAL")
    return <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100">Partial</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Unpaid</Badge>;
}

function CamperPaymentBadge({
  status,
}: {
  status: RegistrationLite["paymentStatus"];
}) {
  if (status === "PAID")
    return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Paid</Badge>;
  if (status === "REFUNDED")
    return <Badge className="bg-clay-200 text-clay-700 hover:bg-clay-200">Refunded</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Unpaid</Badge>;
}

/**
 * Pick registered campers to fill this pledge's open slots. Stays open after
 * each assignment so several campers can be allocated in one sitting.
 */
function AssignDialog({
  sponsorship,
  registrations,
  camp,
  onClose,
  onChanged,
}: {
  sponsorship: SponsorshipRow;
  registrations: RegistrationLite[];
  camp: { currency: string };
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const remaining = sponsorship.slotsPledged - sponsorship.slotsAssigned;

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return registrations
      .filter((r) => !r.sponsorshipId)
      .filter((r) =>
        q
          ? `${r.firstName} ${r.lastName} ${r.phone} ${r.churchOrSchool}`
              .toLowerCase()
              .includes(q)
          : true
      )
      // Unpaid campers first — they're the ones a sponsorship usually covers.
      .sort((a, b) => {
        if (a.paymentStatus === b.paymentStatus) return 0;
        return a.paymentStatus === "UNPAID" ? -1 : 1;
      });
  }, [registrations, search]);

  const assign = async (registration: RegistrationLite) => {
    setBusyId(registration.id);
    try {
      const res = await fetchWithAuth(
        `/api/camp-sponsorships/${sponsorship.id}/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registrationId: registration.id }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast({
        title: "Camper sponsored",
        description: `${registration.firstName} ${registration.lastName} → ${sponsorship.sponsorName}`,
      });
      await onChanged();
    } catch (err) {
      toast({
        title: "Assignment failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign campers to {sponsorship.sponsorName}</DialogTitle>
          <DialogDescription>
            {remaining > 0 ? (
              <>
                <span className="font-medium text-clay-800">{remaining}</span> of{" "}
                {sponsorship.slotsPledged} slot
                {sponsorship.slotsPledged === 1 ? "" : "s"} still open ·{" "}
                {camp.currency} {sponsorship.amountPledged.toLocaleString()} pledged
              </>
            ) : (
              "All slots on this pledge are now allocated."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-clay-400" />
          <Input
            placeholder="Search campers by name, phone, church..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 rounded-xl pl-9"
          />
        </div>

        <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
          {candidates.length === 0 ? (
            <p className="py-8 text-center text-sm text-clay-500">
              {registrations.filter((r) => !r.sponsorshipId).length === 0
                ? "Every registered camper already has a sponsorship."
                : "No unsponsored campers match your search."}
            </p>
          ) : (
            candidates.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-clay-100 bg-cream/40 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-clay-800">
                    {r.firstName} {r.lastName}
                  </div>
                  <div className="truncate text-xs text-clay-500">
                    {r.phone}
                    {r.churchOrSchool ? ` · ${r.churchOrSchool}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <CamperPaymentBadge status={r.paymentStatus} />
                  <Button
                    size="sm"
                    className="rounded-lg"
                    disabled={remaining <= 0 || busyId !== null}
                    onClick={() => assign(r)}
                  >
                    {busyId === r.id ? "Assigning..." : "Assign"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SponsorshipDialog({
  row,
  registrations,
  camp,
  isSuperAdmin,
  onClose,
  onChanged,
  onSaved,
}: {
  row: SponsorshipRow;
  registrations: RegistrationLite[];
  camp: { currency: string; fee: number };
  isSuperAdmin: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [status, setStatus] = useState<CampSponsorshipPaymentStatus>(
    row.paymentStatus
  );
  const [received, setReceived] = useState<string>(
    row.amountReceived?.toString() ?? ""
  );
  const [slots, setSlots] = useState<string>(row.slotsPledged.toString());
  const [reference, setReference] = useState(row.paymentReference ?? "");
  const [notes, setNotes] = useState(row.paymentNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const assignedCampers = registrations.filter(
    (r) => r.sponsorshipId === row.id
  );

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/camp-sponsorships/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentStatus: status,
          amountReceived: received === "" ? null : Number(received),
          paymentReference: reference,
          paymentNotes: notes,
          slotsPledged: Number(slots),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast({ title: "Sponsorship updated" });
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

  const unassign = async (registration: RegistrationLite) => {
    setBusyId(registration.id);
    try {
      const res = await fetchWithAuth(
        `/api/camp-sponsorships/${row.id}/unassign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registrationId: registration.id }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast({
        title: "Slot released",
        description: `${registration.firstName} ${registration.lastName} removed from this sponsorship`,
      });
      await onChanged();
    } catch (err) {
      toast({
        title: "Failed to release slot",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/camp-sponsorships/${row.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed");
      }
      toast({ title: "Sponsorship deleted" });
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
          <DialogTitle>{row.sponsorName}</DialogTitle>
          <DialogDescription>
            Pledged {format(new Date(row.createdAt), "MMM d, yyyy")} · Ref{" "}
            {buildPaymentReference(row.id)}
            {row.organization ? ` · ${row.organization}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Info label="Phone" value={row.phone} />
            <Info label="Email" value={row.email ?? "—"} />
            <Info
              label="Pledge"
              value={
                row.pledgeType === "SLOTS"
                  ? `${row.slotsPledged} youth (${camp.currency} ${row.amountPledged.toLocaleString()})`
                  : `${camp.currency} ${row.amountPledged.toLocaleString()} (covers ${row.slotsPledged})`
              }
            />
            <Info
              label="Slots used"
              value={`${row.slotsAssigned} of ${row.slotsPledged}`}
            />
            <Info label="Sponsor notes" value={row.notes ?? "—"} full />
          </div>

          <div className="border-t border-clay-200 pt-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-clay-500">
              Sponsored campers ({assignedCampers.length})
            </h3>
            {assignedCampers.length === 0 ? (
              <p className="text-sm text-clay-500">
                No campers allocated to this pledge yet — use Assign on the
                sponsorships table.
              </p>
            ) : (
              <div className="space-y-2">
                {assignedCampers.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-clay-100 bg-cream/40 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-clay-800">
                        {r.firstName} {r.lastName}
                      </div>
                      <div className="truncate text-xs text-clay-500">
                        {r.phone}
                        {r.churchOrSchool ? ` · ${r.churchOrSchool}` : ""}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <CamperPaymentBadge status={r.paymentStatus} />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-clay-500 hover:text-red-600"
                        disabled={busyId !== null}
                        onClick={() => unassign(r)}
                        aria-label={`Remove ${r.firstName} ${r.lastName} from this sponsorship`}
                      >
                        {busyId === r.id ? (
                          "..."
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4 border-t border-clay-200 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-clay-500">
              Pledge & payment
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">Slots pledged</Label>
                <Input
                  type="number"
                  min={Math.max(1, row.slotsAssigned)}
                  value={slots}
                  onChange={(e) => setSlots(e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as CampSponsorshipPaymentStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNPAID">Unpaid</SelectItem>
                    <SelectItem value="PARTIAL">Partially paid</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">
                  Amount received ({camp.currency})
                </Label>
                <Input
                  type="number"
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
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
                  placeholder="Internal notes about this sponsorship"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {confirmDelete ? (
            <>
              <span className="mr-auto self-center text-sm text-red-600">
                Delete this pledge and release its campers?
              </span>
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(false)}
                disabled={saving}
              >
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

function Info({
  label,
  value,
  full,
}: {
  label: string;
  value: string;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="text-xs uppercase tracking-wider text-clay-500">{label}</div>
      <div className="mt-0.5 whitespace-pre-wrap break-words text-clay-800">
        {value}
      </div>
    </div>
  );
}
