"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DEFAULT_CAMP_ID } from "@/lib/camps";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useToast } from "@/hooks/use-toast";
import { useCampLeadAccess } from "@/hooks/useCampLeadAccess";
import { PageLoader, LoadingSpinner } from "@/components/shared/LoadingSpinner";
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
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import {
  Search,
  Tent,
  Users,
  CheckCircle2,
  Clock,
  UserCheck,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** A camper as the status endpoint returns them — no contact or medical data. */
interface StatusCamper {
  id: string;
  firstName: string;
  lastName: string;
  churchOrSchool: string;
  gender: string | null;
  paymentStatus: string;
  checkedIn: boolean;
  createdAt: string | null;
}

interface CampStatus {
  camp: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    venue: string | null;
  };
  capacity: number;
  registered: number;
  spotsLeft: number;
  paid: number;
  unpaid: number;
  refunded: number;
  checkedIn: number;
  campers: StatusCamper[];
}

/**
 * Read-only view of how the ROPs Camp is filling up, open to every department
 * lead. Everything sensitive — medical notes, allergies, phone numbers, parent
 * and emergency contacts — is left on the server; managing registrations stays
 * on /manage/rops-camp with the camp team.
 */
export default function CampStatusPage() {
  const { loading, canViewStatus } = useCampLeadAccess();
  if (loading) return <PageLoader />;
  if (!canViewStatus) {
    return (
      <EmptyStateLux
        icon={Tent}
        tone="clay"
        title="Access Denied"
        description="You don't have permission to view the ROPs Camp registration status."
        className="min-h-[60vh] justify-center"
      />
    );
  }
  return <CampStatusInner />;
}

function CampStatusInner() {
  const { toast } = useToast();
  const { canManage } = useCampLeadAccess();
  const [status, setStatus] = useState<CampStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(
        `/api/camp-registrations/status?campId=${DEFAULT_CAMP_ID}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setStatus(json);
    } catch (err) {
      toast({
        title: "Failed to load camp status",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!status) return [];
    if (!q) return status.campers;
    return status.campers.filter((c) =>
      `${c.firstName} ${c.lastName} ${c.churchOrSchool}`.toLowerCase().includes(q)
    );
  }, [status, search]);

  const camp = status?.camp;

  return (
    <div className="space-y-7">
      <PageHeader
        icon={Tent}
        tone="gold"
        title={camp?.name ?? "ROPs Camp"}
        description={
          camp ? (
            <>
              {format(parseISO(camp.startDate), "MMMM d")}–
              {format(parseISO(camp.endDate), "d, yyyy")} · Registration status
            </>
          ) : (
            "Registration status"
          )
        }
        actions={
          <>
            {canManage && (
              <Link href="/manage/rops-camp">
                <Button variant="gold" className="rounded-xl">
                  <Users className="mr-2 h-4 w-4" />
                  Manage registrations
                </Button>
              </Link>
            )}
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

      {/* Scenic camp banner — matches the camp team's page */}
      <div className={cn("relative h-32 overflow-hidden sm:h-44", luxSurface)}>
        <div className="absolute inset-0 bg-gradient-to-br from-teal/25 via-[#E6EDE4] to-cream" />
        <DecorImage
          src="/images/dashboard/asset-camp-landscape-wide.png"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <span
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-cream via-cream/45 to-transparent"
        />
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-cream/60 to-transparent"
        />
        <div className="relative flex h-full flex-col justify-end p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-dark">
            Camp season
          </p>
          <p className="font-display text-2xl font-bold text-clay-700 drop-shadow-sm sm:text-3xl">
            {camp?.name ?? "ROPs Camp"}
          </p>
        </div>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-5">
        <StatCardLux
          icon={Users}
          tone="teal"
          label="Registered"
          value={status ? `${status.registered} / ${status.capacity}` : "—"}
          hint={
            status
              ? status.spotsLeft > 0
                ? `${status.spotsLeft} spot${status.spotsLeft === 1 ? "" : "s"} left`
                : "camp is full"
              : "loading"
          }
          accent="bg-teal"
          highlight={!!status && status.spotsLeft === 0}
          art={<Users className="h-24 w-24" strokeWidth={1} />}
        />
        <StatCardLux
          icon={CheckCircle2}
          tone="emerald"
          label="Paid"
          value={status?.paid ?? "—"}
          hint="payments received"
          accent="bg-green-500"
          art={<CheckCircle2 className="h-24 w-24" strokeWidth={1} />}
        />
        <StatCardLux
          icon={Clock}
          tone="amber"
          label="Unpaid"
          value={status?.unpaid ?? "—"}
          hint="awaiting payment"
          accent="bg-gold"
          art={<Clock className="h-24 w-24" strokeWidth={1} />}
        />
        <StatCardLux
          icon={UserCheck}
          tone="teal"
          label="In camp"
          value={status?.checkedIn ?? "—"}
          hint="checked in at the gate"
          accent="bg-teal"
          art={<UserCheck className="h-24 w-24" strokeWidth={1} />}
        />
        <StatCardLux
          icon={Tent}
          tone="gold"
          label="Spots left"
          value={status?.spotsLeft ?? "—"}
          hint={status ? `cap is ${status.capacity} campers` : "loading"}
          accent="bg-gold"
          art={<Tent className="h-24 w-24" strokeWidth={1} />}
        />
      </div>

      {/* Camper list */}
      <div className={cn(luxSurface)}>
        <div className="flex flex-col gap-3 border-b border-clay-100/80 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold/15 text-gold-dark">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-clay-700">
                Campers
              </h2>
              <p className="flex items-center gap-1.5 text-xs text-clay-500">
                <ShieldCheck className="h-3.5 w-3.5" />
                Names and payment status only — contact and medical details stay
                with the camp team
              </p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-clay-400" />
            <Input
              placeholder="Search name or church..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl pl-9 md:w-64"
            />
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
                status?.campers.length === 0 &&
                  "border-2 border-dashed border-clay-200/80 bg-cream/30"
              )}
            >
              <EmptyStateLux
                illustration={
                  status?.campers.length === 0 ? <TentScene /> : undefined
                }
                icon={status?.campers.length === 0 ? undefined : Search}
                tone="teal"
                title={
                  status?.campers.length === 0
                    ? "No registrations yet"
                    : "No matches"
                }
                description={
                  status?.campers.length === 0
                    ? "Campers will appear here once they sign up."
                    : "No campers match your search."
                }
              />
            </div>
          ) : (
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-clay-100 text-left text-xs uppercase tracking-wider text-clay-500">
                    <th className="px-2 py-3 font-medium">Camper</th>
                    <th className="px-2 py-3 font-medium">Church / School</th>
                    <th className="px-2 py-3 font-medium">Payment</th>
                    <th className="px-2 py-3 font-medium">Checked in</th>
                    <th className="px-2 py-3 font-medium">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-clay-100">
                  {filtered.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-cream/50">
                      <td className="px-2 py-3">
                        <div className="font-medium text-clay-800">
                          {c.firstName} {c.lastName}
                        </div>
                        {c.gender && (
                          <div className="text-xs text-clay-500">
                            {c.gender === "MALE" ? "Male" : "Female"}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-3 text-clay-700">
                        {c.churchOrSchool || "—"}
                      </td>
                      <td className="px-2 py-3">
                        <PaymentBadge status={c.paymentStatus} />
                      </td>
                      <td className="px-2 py-3 text-xs text-clay-700">
                        {c.checkedIn ? "In camp" : "—"}
                      </td>
                      <td className="px-2 py-3 text-xs text-clay-500">
                        {c.createdAt
                          ? format(new Date(c.createdAt), "MMM d, yyyy")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PaymentBadge({ status }: { status: string }) {
  if (status === "PAID")
    return (
      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Paid</Badge>
    );
  if (status === "REFUNDED")
    return (
      <Badge className="bg-clay-200 text-clay-700 hover:bg-clay-200">Refunded</Badge>
    );
  return (
    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Unpaid</Badge>
  );
}
