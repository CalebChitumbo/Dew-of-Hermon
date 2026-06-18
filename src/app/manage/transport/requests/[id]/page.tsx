"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Bus,
  Shield,
  Calendar,
  MapPin,
  AlertCircle,
} from "lucide-react";
import { useTransportAccess } from "@/hooks/useTransportAccess";
import { useToast } from "@/hooks/use-toast";
import type { TransportRequestStatus } from "@/types";
import { cn } from "@/lib/utils";

interface RequestDetail {
  id: string;
  eventId: string;
  eventTitle: string;
  eventStartDate: string | null;
  needsDescription: string;
  status: TransportRequestStatus;
  vehicleType: string | null;
  vehicleCount: number | null;
  estimatedCost: number | null;
  currency: string | null;
  pickupLocation: string | null;
  dropoffLocation: string | null;
  pickupTime: string | null;
  returnTime: string | null;
  coordinatorNotes: string | null;
  treasurerName: string | null;
  treasurerComments: string | null;
  routedByName: string | null;
  filledByName: string | null;
  filledAt: string | null;
  statusHistory: {
    status: TransportRequestStatus;
    changedBy: string;
    changedByName: string;
    changedAt: string | null;
    comments: string | null;
  }[];
}

interface EventSummary {
  id: string;
  title: string;
  venue: string;
  startDate: string | null;
  endDate: string | null;
  approvalStatus: string;
  description: string | null;
}

const STATUS_LABEL: Record<TransportRequestStatus, string> = {
  PENDING_DETAILS: "Awaiting Details",
  PENDING_TREASURER: "Awaiting Treasurer",
  APPROVED: "Approved",
  REJECTED_TREASURER: "Rejected by Treasurer",
  CANCELLED: "Cancelled",
};

const STATUS_COLOR: Record<TransportRequestStatus, string> = {
  PENDING_DETAILS: "bg-amber-50 text-amber-700 border-amber-200",
  PENDING_TREASURER: "bg-blue-50 text-blue-700 border-blue-200",
  APPROVED: "bg-green-50 text-green-700 border-green-200",
  REJECTED_TREASURER: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-clay-50 text-clay-500 border-clay-200",
};

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TransportRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { loading: accessLoading, canManageTransport } = useTransportAccess();
  const { toast } = useToast();

  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [vehicleType, setVehicleType] = useState("");
  const [vehicleCount, setVehicleCount] = useState("1");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [currency, setCurrency] = useState("ZMW");
  const [pickupLocation, setPickupLocation] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [coordinatorNotes, setCoordinatorNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const id = params?.id;

  const loadRequest = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/transport-requests/${id}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load request");
      }
      const data = await res.json();
      const req: RequestDetail = data.request;
      setRequest(req);
      setEvent(data.event);
      setVehicleType(req.vehicleType ?? "");
      setVehicleCount(req.vehicleCount ? String(req.vehicleCount) : "1");
      setEstimatedCost(req.estimatedCost !== null ? String(req.estimatedCost) : "");
      setCurrency(req.currency ?? "ZMW");
      setPickupLocation(req.pickupLocation ?? "");
      setDropoffLocation(req.dropoffLocation ?? "");
      setPickupTime(toLocalInputValue(req.pickupTime));
      setReturnTime(toLocalInputValue(req.returnTime));
      setCoordinatorNotes(req.coordinatorNotes ?? "");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to load request";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    if (canManageTransport) loadRequest();
  }, [canManageTransport, loadRequest]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!request) return;
    if (!vehicleType.trim()) {
      toast({
        title: "Vehicle type required",
        description: "Specify the vehicle type (e.g. Hiace, Coaster).",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/transport-requests/${request.id}/submit-details`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vehicleType: vehicleType.trim(),
            vehicleCount: Number(vehicleCount),
            estimatedCost: Number(estimatedCost),
            currency: currency.trim(),
            pickupLocation: pickupLocation.trim() || null,
            dropoffLocation: dropoffLocation.trim() || null,
            pickupTime: pickupTime ? new Date(pickupTime).toISOString() : null,
            returnTime: returnTime ? new Date(returnTime).toISOString() : null,
            coordinatorNotes: coordinatorNotes.trim() || null,
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit details");
      }
      toast({
        title: "Sent to Treasurer",
        description: "The treasurer has been notified to confirm funds.",
        variant: "success",
      });
      await loadRequest();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to submit details";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (accessLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!canManageTransport) {
    return (
      <EmptyState
        icon={Shield}
        title="Access Denied"
        description="Only the Transport & Logistics lead can manage transport requests."
        tone="clay"
      />
    );
  }

  if (!request) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Transport request not found"
        tone="clay"
        action={
          <Button
            variant="outline"
            onClick={() => router.push("/manage/transport/requests")}
          >
            Back to Requests
          </Button>
        }
      />
    );
  }

  const isEditable = request.status === "PENDING_DETAILS";

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/manage/transport/requests"
        icon={Bus}
        tone="teal"
        title={request.eventTitle}
        description={`Transport Request · routed by ${request.routedByName ?? "Events Coordinator"}`}
        actions={
          <Badge
            variant="outline"
            className={cn("text-sm", STATUS_COLOR[request.status])}
          >
            {STATUS_LABEL[request.status]}
          </Badge>
        }
      />

      {/* Event context */}
      {event && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Event Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-clay-600">
            {event.startDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-clay-400" />
                {format(parseISO(event.startDate), "EEE, d MMM yyyy 'at' h:mm a")}
              </div>
            )}
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-clay-400" />
              {event.venue}
            </div>
            {event.description && (
              <p className="bg-cream/60 rounded-md px-3 py-2">{event.description}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Initiator's transport needs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Requested Needs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-clay-700 whitespace-pre-wrap">
            {request.needsDescription}
          </p>
        </CardContent>
      </Card>

      {/* Treasurer feedback banner */}
      {request.status === "PENDING_DETAILS" && request.treasurerComments && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="py-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-700 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">
                Treasurer requested changes:
              </p>
              <p className="text-clay-700 mt-1">{request.treasurerComments}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Costing form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isEditable ? "Cost and Schedule" : "Submitted Plan"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="vehicleType" className="text-sm">
                  Vehicle type *
                </Label>
                <Input
                  id="vehicleType"
                  placeholder="e.g. Hiace, Coaster"
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  disabled={!isEditable}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vehicleCount" className="text-sm">
                  Vehicle count *
                </Label>
                <Input
                  id="vehicleCount"
                  type="number"
                  min={1}
                  value={vehicleCount}
                  onChange={(e) => setVehicleCount(e.target.value)}
                  disabled={!isEditable}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="estimatedCost" className="text-sm">
                  Estimated cost *
                </Label>
                <Input
                  id="estimatedCost"
                  type="number"
                  min={0}
                  step="0.01"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                  disabled={!isEditable}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="currency" className="text-sm">
                  Currency *
                </Label>
                <Input
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  disabled={!isEditable}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pickupLocation" className="text-sm">
                  Pickup location
                </Label>
                <Input
                  id="pickupLocation"
                  placeholder="e.g. UNZA Main Gate"
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  disabled={!isEditable}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dropoffLocation" className="text-sm">
                  Drop-off location
                </Label>
                <Input
                  id="dropoffLocation"
                  placeholder="e.g. Church venue"
                  value={dropoffLocation}
                  onChange={(e) => setDropoffLocation(e.target.value)}
                  disabled={!isEditable}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pickupTime" className="text-sm">
                  Departure time
                </Label>
                <Input
                  id="pickupTime"
                  type="datetime-local"
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  disabled={!isEditable}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="returnTime" className="text-sm">
                  Return time
                </Label>
                <Input
                  id="returnTime"
                  type="datetime-local"
                  value={returnTime}
                  onChange={(e) => setReturnTime(e.target.value)}
                  disabled={!isEditable}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="coordinatorNotes" className="text-sm">
                Notes for the treasurer
              </Label>
              <Textarea
                id="coordinatorNotes"
                rows={3}
                value={coordinatorNotes}
                onChange={(e) => setCoordinatorNotes(e.target.value)}
                disabled={!isEditable}
              />
            </div>

            {isEditable && (
              <Button
                type="submit"
                disabled={submitting}
                variant="gold"
              >
                {submitting && <LoadingSpinner size="sm" className="mr-2" />}
                Send to Treasurer
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Status history */}
      {request.statusHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">History</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {request.statusHistory.map((entry, idx) => (
                <li key={idx} className="text-sm text-clay-600">
                  <span className="font-medium text-clay-700">
                    {STATUS_LABEL[entry.status]}
                  </span>{" "}
                  by {entry.changedByName}
                  {entry.changedAt && (
                    <span className="text-clay-400">
                      {" "}
                      · {format(parseISO(entry.changedAt), "d MMM yyyy h:mm a")}
                    </span>
                  )}
                  {entry.comments && (
                    <p className="text-xs text-clay-500 mt-0.5 ml-1">— {entry.comments}</p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
