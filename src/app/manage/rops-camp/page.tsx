"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CAMPS, DEFAULT_CAMP_ID } from "@/lib/camps";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCampLeadAccess } from "@/hooks/useCampLeadAccess";
import { PageLoader } from "@/components/shared/LoadingSpinner";
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
  Trash2,
  RefreshCw,
} from "lucide-react";
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
  createdAt: string;
}

export default function RopsCampAdminPage() {
  const { loading, canManage } = useCampLeadAccess();
  if (loading) return <PageLoader />;
  if (!canManage) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-display text-clay-700">Access Denied</h2>
          <p className="mt-2 text-clay-500">
            You don&apos;t have permission to view ROPs Camp registrations.
          </p>
        </div>
      </div>
    );
  }
  return <RopsCampAdminInner />;
}

function RopsCampAdminInner() {
  const { toast } = useToast();
  const [campId, setCampId] = useState<string>(DEFAULT_CAMP_ID);
  const camp = useMemo(() => CAMPS.find((c) => c.id === campId)!, [campId]);

  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CampPaymentStatus>("all");
  const [editing, setEditing] = useState<RegistrationRow | null>(null);

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
      if (statusFilter !== "all" && r.paymentStatus !== statusFilter) return false;
      if (!q) return true;
      const hay = `${r.firstName} ${r.lastName} ${r.phone} ${r.email ?? ""} ${r.churchOrSchool} ${r.parentName ?? ""} ${r.parentEmail ?? ""}`.toLowerCase();
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-clay-500 text-sm mb-1">
            <Tent className="h-4 w-4" />
            <span>ROPs Camp</span>
          </div>
          <h1 className="font-display text-3xl text-clay-800">{camp.name}</h1>
          <p className="text-clay-600 text-sm">
            {format(parseISO(camp.startDate), "MMMM d")}–
            {format(parseISO(camp.endDate), "d, yyyy")} · Registrations & payments
          </p>
        </div>
        <div className="flex items-center gap-2">
          {CAMPS.length > 1 && (
            <Select value={campId} onValueChange={setCampId}>
              <SelectTrigger className="w-[220px]">
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
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={Users}
          label="Registered"
          value={stats.total}
          accent="bg-teal/10 text-teal"
        />
        <StatCard
          icon={CheckCircle2}
          label="Paid"
          value={stats.paid}
          accent="bg-green-100 text-green-700"
        />
        <StatCard
          icon={Clock}
          label="Unpaid"
          value={stats.unpaid}
          accent="bg-amber-100 text-amber-700"
        />
        <StatCard
          icon={DollarSign}
          label="Revenue"
          value={`${camp.currency} ${stats.revenue.toLocaleString()}`}
          accent="bg-clay-100 text-clay-700"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle>Registrations</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-clay-400" />
                <Input
                  placeholder="Search name, phone, church..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-[260px]"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="UNPAID">Unpaid</SelectItem>
                  <SelectItem value="REFUNDED">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-clay-500">
              {rows.length === 0
                ? "No registrations yet."
                : "No registrations match your filters."}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-clay-500 border-b border-clay-200">
                    <th className="px-2 py-3 font-medium">Camper</th>
                    <th className="px-2 py-3 font-medium">Contact</th>
                    <th className="px-2 py-3 font-medium">Parent / guardian</th>
                    <th className="px-2 py-3 font-medium">Drop-off</th>
                    <th className="px-2 py-3 font-medium">Status</th>
                    <th className="px-2 py-3 font-medium">Registered</th>
                    <th className="px-2 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-clay-100">
                  {filtered.map((row) => (
                    <tr key={row.id} className="hover:bg-clay-50/50">
                      <td className="px-2 py-3">
                        <div className="font-medium text-clay-800">
                          {row.firstName} {row.lastName}
                        </div>
                        <div className="text-xs text-clay-500">
                          {row.gender === "MALE" ? "Male" : "Female"} · DOB{" "}
                          {row.dateOfBirth}
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <div className="text-clay-700">{row.phone}</div>
                        {row.email && (
                          <div className="text-xs text-clay-500">{row.email}</div>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <div className="text-clay-700">{row.parentName ?? "—"}</div>
                        <div className="text-xs text-clay-500">
                          {row.parentRelationship ?? "Guardian"}
                          {row.parentAltPhone ? ` · ${row.parentAltPhone}` : ""}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-clay-700 text-xs">
                        {row.dropoffLocation === "CHURCH"
                          ? "Church"
                          : row.dropoffLocation === "CAMPSITE"
                          ? "Camp site"
                          : "—"}
                      </td>
                      <td className="px-2 py-3">
                        <PaymentBadge status={row.paymentStatus} />
                        {row.paymentMarkedAt && row.paymentStatus !== "UNPAID" && (
                          <div className="text-[11px] text-clay-500 mt-1">
                            by {row.paymentMarkedByName ?? "admin"} ·{" "}
                            {format(new Date(row.paymentMarkedAt), "MMM d")}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-3 text-clay-600 text-xs">
                        {format(new Date(row.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant={row.paymentStatus === "PAID" ? "outline" : "default"}
                            onClick={() => quickToggle(row)}
                          >
                            {row.paymentStatus === "PAID" ? "Mark unpaid" : "Mark paid"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>
                            Details
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  extra,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  accent: string;
  extra?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-clay-500">{label}</div>
            <div className="font-display text-2xl text-clay-800 mt-1">{value}</div>
          </div>
          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${accent}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {extra}
      </CardContent>
    </Card>
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

        <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-5">
          <Section title="Camper">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Info label="Date of birth" value={row.dateOfBirth} />
              <Info
                label="Gender"
                value={row.gender === "MALE" ? "Male" : "Female"}
              />
              <Info label="T-shirt size" value={row.tshirtSize || "—"} />
              <Info
                label="Dietary"
                value={row.dietaryPreference ?? "No restrictions"}
              />
            </div>
          </Section>

          <Section title="Parent / guardian">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Info label="Name" value={row.parentName ?? "—"} />
              <Info
                label="Relationship"
                value={row.parentRelationship ?? "—"}
              />
              <Info label="Primary phone" value={row.phone} />
              <Info
                label="Alternative phone"
                value={row.parentAltPhone ?? "—"}
              />
              <Info label="Email" value={row.parentEmail ?? row.email ?? "—"} full />
              <Info label="Home address" value={row.address ?? "—"} full />
            </div>
          </Section>

          <Section title="Emergency contact">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Info label="Name" value={row.emergencyContactName} />
              <Info
                label="Relationship"
                value={row.emergencyContactRelationship ?? "—"}
              />
              <Info
                label="Phone"
                value={row.emergencyContactPhone}
                full
              />
            </div>
          </Section>

          <Section title="Health">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Info label="Allergies" value={row.allergies ?? "None reported"} />
              <Info
                label="Medications"
                value={row.medications ?? "None reported"}
              />
              <Info
                label="Medical notes"
                value={row.medicalNotes ?? "None reported"}
                full
              />
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
              <Info
                label="Consent given"
                value={row.consentGiven ? "Yes" : "No"}
              />
              <Info label="Notes" value={row.notes ?? "—"} full />
            </div>
          </Section>
        </div>

        <div className="border-t border-clay-200 pt-4 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-clay-500">
            Payment
          </h3>
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
              <span className="text-sm text-red-600 mr-auto self-center">
                Delete this registration?
              </span>
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
                  <Trash2 className="h-4 w-4 mr-1" />
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
      <div className="text-clay-800 mt-0.5 whitespace-pre-wrap break-words">
        {value}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-clay-200 pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-clay-500 mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}
