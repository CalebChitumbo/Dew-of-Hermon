"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  DollarSign,
  Eye,
  Phone,
  Plus,
  Receipt,
  Search,
  Trash2,
  User as UserIcon,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  CURRENCY_SYMBOL,
  FUNDRAISING_PICKUP_OPTIONS,
  getNextPrepStatus,
  getPaymentStatusLabel,
  getPickupTimeLabel,
  getPreparationStatusLabel,
  getPrevPrepStatus,
} from "@/lib/fundraising-menu";
import type {
  FundraisingMenuConfig,
  FundraisingMenuItem,
  FundraisingOrder,
  FundraisingPaymentMethod,
  FundraisingPaymentStatus,
  FundraisingPickupTimeOption,
  FundraisingPreparationStatus,
} from "@/types";

interface SerializedOrder
  extends Omit<
    FundraisingOrder,
    "createdAt" | "updatedAt" | "preparationUpdatedAt" | "paidAt" | "braaiEventDate"
  > {
  createdAt: string;
  updatedAt: string;
  preparationUpdatedAt: string;
  paidAt: string | null;
  braaiEventDate: string | null;
}

type Filter =
  | "all"
  | "unpaid"
  | "paid"
  | "pending"
  | "in_prep"
  | "ready"
  | "collected";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "in_prep", label: "In prep" },
  { value: "ready", label: "Ready" },
  { value: "collected", label: "Collected" },
];

interface Props {
  braaiId: string;
  braaiTitle: string;
}

export function BraaiOrdersList({ braaiId, braaiTitle }: Props) {
  const { firebaseUser, userData } = useAuth();
  const isSuperAdmin = userData?.role === "SUPER_ADMIN";
  const { toast } = useToast();

  const [orders, setOrders] = useState<SerializedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const [detailOrder, setDetailOrder] = useState<SerializedOrder | null>(null);
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<SerializedOrder | null>(null);
  const [deletingOrder, setDeletingOrder] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [menu, setMenu] = useState<FundraisingMenuConfig | null>(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);

  const [paymentDialog, setPaymentDialog] = useState<{
    order: SerializedOrder;
  } | null>(null);
  const [pendingPaymentMethod, setPendingPaymentMethod] =
    useState<FundraisingPaymentMethod>("cash");

  const load = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    setError(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch(
        `/api/fundraising/braai/events/${braaiId}/orders`,
        { headers: { Authorization: `Bearer ${idToken}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setOrders(data.orders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, braaiId]);

  useEffect(() => {
    if (!firebaseUser) return;
    load();
  }, [firebaseUser, load]);

  // Load menu lazily when the "Add on behalf" dialog opens
  const loadMenu = useCallback(async () => {
    setMenuLoading(true);
    setMenuError(null);
    try {
      const res = await fetch("/api/fundraising/public/menu");
      const data = await res.json();
      if (res.ok) {
        setMenu(data);
      } else {
        setMenuError(data?.error || "Failed to load the menu.");
      }
    } catch {
      setMenuError("Failed to load the menu.");
    } finally {
      setMenuLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!addOpen || menu) return;
    loadMenu();
  }, [addOpen, menu, loadMenu]);

  // Defer the search term so keystrokes stay responsive while the (possibly
  // long) order list re-filters at lower priority.
  const deferredSearch = useDeferredValue(search);

  const filtered = useMemo(() => {
    let list = orders;
    if (filter !== "all") {
      list = list.filter((o) => {
        switch (filter) {
          case "unpaid":
            return o.paymentStatus === "UNPAID";
          case "paid":
            return o.paymentStatus === "PAID";
          case "pending":
            return o.preparationStatus === "PENDING";
          case "in_prep":
            return o.preparationStatus === "IN_PREP";
          case "ready":
            return o.preparationStatus === "READY";
          case "collected":
            return o.preparationStatus === "COLLECTED";
        }
      });
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerPhone.toLowerCase().includes(q)
      );
    }
    return list;
  }, [orders, filter, search]);

  const counts = useMemo(() => {
    const c = {
      total: orders.length,
      paid: 0,
      unpaid: 0,
      pending: 0,
      inPrep: 0,
      ready: 0,
      collected: 0,
      revenue: 0,
      expected: 0,
    };
    orders.forEach((o) => {
      c.expected += o.total;
      if (o.paymentStatus === "PAID") {
        c.paid += 1;
        c.revenue += o.total;
      }
      if (o.paymentStatus === "UNPAID") c.unpaid += 1;
      if (o.preparationStatus === "PENDING") c.pending += 1;
      if (o.preparationStatus === "IN_PREP") c.inPrep += 1;
      if (o.preparationStatus === "READY") c.ready += 1;
      if (o.preparationStatus === "COLLECTED") c.collected += 1;
    });
    return c;
  }, [orders]);

  // ─── Patch helpers ──────────────────────────────────────────────
  const patchOrder = async (
    orderId: string,
    body: Record<string, unknown>,
    successMsg: string
  ) => {
    if (!firebaseUser) return;
    setSavingOrderId(orderId);
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch(
        `/api/fundraising/braai/events/${braaiId}/orders/${orderId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? data.order : o))
      );
      if (detailOrder?.id === orderId) setDetailOrder(data.order);
      toast({ title: successMsg, variant: "success" });
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSavingOrderId(null);
    }
  };

  const handleAdvancePrep = (order: SerializedOrder) => {
    const next = getNextPrepStatus(order.preparationStatus);
    if (!next) return;
    patchOrder(
      order.id,
      { preparationStatus: next },
      `Marked ${getPreparationStatusLabel(next).toLowerCase()}`
    );
  };

  const handleReversePrep = (order: SerializedOrder) => {
    const prev = getPrevPrepStatus(order.preparationStatus);
    if (!prev) return;
    patchOrder(
      order.id,
      { preparationStatus: prev },
      `Moved back to ${getPreparationStatusLabel(prev).toLowerCase()}`
    );
  };

  const handleTogglePayment = (order: SerializedOrder) => {
    if (order.paymentStatus === "PAID") {
      patchOrder(order.id, { paymentStatus: "UNPAID" }, "Marked unpaid");
      return;
    }
    // Going UNPAID → PAID: prompt for method (default to cash).
    setPendingPaymentMethod("cash");
    setPaymentDialog({ order });
  };

  const confirmPayment = () => {
    if (!paymentDialog) return;
    patchOrder(
      paymentDialog.order.id,
      { paymentStatus: "PAID", paymentMethod: pendingPaymentMethod },
      "Marked paid"
    );
    setPaymentDialog(null);
  };

  const handleArchive = (order: SerializedOrder) => {
    patchOrder(order.id, { isArchived: !order.isArchived }, "Updated");
  };

  const handleConfirmDelete = async () => {
    if (!firebaseUser || !deleteOrder) return;
    setDeletingOrder(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch(
        `/api/fundraising/braai/events/${braaiId}/orders/${deleteOrder.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${idToken}` },
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setOrders((prev) => prev.filter((o) => o.id !== deleteOrder.id));
      if (detailOrder?.id === deleteOrder.id) setDetailOrder(null);
      toast({
        title: "Order deleted",
        description: `${deleteOrder.orderNumber} has been removed.`,
      });
      setDeleteOrder(null);
    } catch (err) {
      toast({
        title: "Couldn't delete order",
        description: err instanceof Error ? err.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setDeletingOrder(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="py-6 flex items-center gap-3 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <div className="flex-1">{error}</div>
          <Button variant="outline" size="sm" onClick={load}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          icon={Users}
          label="Orders"
          value={counts.total}
          accent="bg-teal/10 text-teal"
        />
        <StatCard
          icon={CheckCircle2}
          label="Paid"
          value={counts.paid}
          accent="bg-green-100 text-green-700"
        />
        <StatCard
          icon={Clock}
          label="Unpaid"
          value={counts.unpaid}
          accent="bg-amber-100 text-amber-700"
        />
        <StatCard
          icon={DollarSign}
          label="Revenue"
          value={`${CURRENCY_SYMBOL}${counts.revenue.toLocaleString()}`}
          accent="bg-clay-100 text-clay-700"
        />
        <StatCard
          icon={Receipt}
          label="Expected"
          value={`${CURRENCY_SYMBOL}${counts.expected.toLocaleString()}`}
          accent="bg-blue-100 text-blue-700"
        />
      </div>

      {/* Header: counters + add */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-clay-500">
          <span className="font-medium text-clay-700">
            {counts.total} order{counts.total === 1 ? "" : "s"}
          </span>
          {counts.unpaid > 0 && (
            <Badge className="bg-red-100 text-red-700 border-red-200">
              {counts.unpaid} unpaid
            </Badge>
          )}
          {counts.ready > 0 && (
            <Badge className="bg-green-100 text-green-700 border-green-200">
              {counts.ready} ready
            </Badge>
          )}
          {counts.inPrep > 0 && (
            <Badge className="bg-gold/10 text-gold-dark border-gold/30">
              {counts.inPrep} in prep
            </Badge>
          )}
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2" variant="gold">
          <Plus className="h-4 w-4" />
          Add order on behalf
        </Button>
      </div>

      {/* Filter chips + search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                filter === f.value
                  ? "bg-clay-700 text-cream border-clay-700"
                  : "border-clay-200 text-clay-600 hover:bg-clay-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-clay-400" />
          <Input
            type="search"
            placeholder="Search by number, name or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-[240px]"
          />
        </div>
      </div>

      {/* Orders */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Receipt className="h-10 w-10 text-clay-300 mx-auto mb-3" />
            <h3 className="font-display text-clay-600">
              {orders.length === 0
                ? "No orders yet for this braai"
                : "No orders match this filter"}
            </h3>
            <p className="text-sm text-clay-400 mt-2">
              {orders.length === 0
                ? "Orders placed from the public ordering page will appear here."
                : "Adjust the filter or search to see other orders."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => (
            <OrderRow
              key={o.id}
              order={o}
              saving={savingOrderId === o.id}
              onAdvancePrep={() => handleAdvancePrep(o)}
              onReversePrep={() => handleReversePrep(o)}
              onTogglePayment={() => handleTogglePayment(o)}
              onView={() => setDetailOrder(o)}
            />
          ))}
        </div>
      )}

      {/* Detail modal */}
      <Dialog
        open={Boolean(detailOrder)}
        onOpenChange={(open) => !open && setDetailOrder(null)}
      >
        <DialogContent className="max-w-lg">
          {detailOrder && (
            <OrderDetail
              order={detailOrder}
              saving={savingOrderId === detailOrder.id}
              canDelete={isSuperAdmin}
              onAdvancePrep={() => handleAdvancePrep(detailOrder)}
              onReversePrep={() => handleReversePrep(detailOrder)}
              onTogglePayment={() => handleTogglePayment(detailOrder)}
              onArchive={() => handleArchive(detailOrder)}
              onDelete={() => setDeleteOrder(detailOrder)}
              onClose={() => setDetailOrder(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={Boolean(deleteOrder)}
        onOpenChange={(open) => !open && !deletingOrder && setDeleteOrder(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this order?</DialogTitle>
            <DialogDescription>
              {deleteOrder ? (
                <>
                  Permanently remove order <strong>{deleteOrder.orderNumber}</strong>{" "}
                  for {deleteOrder.customerName}. This cannot be undone.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOrder(null)}
              disabled={deletingOrder}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deletingOrder}
            >
              {deletingOrder ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment method dialog */}
      <Dialog
        open={Boolean(paymentDialog)}
        onOpenChange={(open) => !open && setPaymentDialog(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Payment method</DialogTitle>
            <DialogDescription>
              How did {paymentDialog?.order.customerName} pay?
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPendingPaymentMethod("cash")}
              className={`p-4 rounded-lg border text-left transition-colors ${
                pendingPaymentMethod === "cash"
                  ? "border-clay-700 bg-clay-50"
                  : "border-clay-200 hover:bg-clay-50"
              }`}
            >
              <p className="text-xl mb-1">💵</p>
              <p className="font-medium text-sm">Cash</p>
            </button>
            <button
              onClick={() => setPendingPaymentMethod("momo")}
              className={`p-4 rounded-lg border text-left transition-colors ${
                pendingPaymentMethod === "momo"
                  ? "border-clay-700 bg-clay-50"
                  : "border-clay-200 hover:bg-clay-50"
              }`}
            >
              <p className="text-xl mb-1">📱</p>
              <p className="font-medium text-sm">Mobile Money</p>
            </button>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPaymentDialog(null)}>
              Cancel
            </Button>
            <Button onClick={confirmPayment} variant="gold">
              Mark paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add on behalf */}
      <AddOrderDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        braaiId={braaiId}
        braaiTitle={braaiTitle}
        menu={menu}
        menuLoading={menuLoading}
        menuError={menuError}
        onRetryMenu={loadMenu}
        onCreated={(o) => {
          setOrders((prev) => [o, ...prev]);
          setAddOpen(false);
        }}
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  accent: string;
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
      </CardContent>
    </Card>
  );
}

function MenuItemThumb({ item }: { item: FundraisingMenuItem }) {
  const [failed, setFailed] = useState(false);
  if (item.imagePath && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.imagePath}
        alt={item.name}
        className="h-10 w-10 rounded-md object-cover bg-clay-100"
        onError={() => setFailed(true)}
        loading="lazy"
      />
    );
  }
  return (
    <div className="h-10 w-10 rounded-md bg-cream border border-clay-200 flex items-center justify-center text-xl" aria-hidden>
      {item.emoji}
    </div>
  );
}

function PaymentBadge({ status }: { status: FundraisingPaymentStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
        status === "PAID"
          ? "bg-green-100 text-green-700"
          : "bg-red-100 text-red-700"
      }`}
    >
      {status === "PAID" ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <AlertCircle className="h-3 w-3" />
      )}
      {getPaymentStatusLabel(status)}
    </span>
  );
}

function PrepBadge({
  status,
}: {
  status: FundraisingPreparationStatus;
}) {
  const styles: Record<FundraisingPreparationStatus, string> = {
    PENDING: "bg-clay-100 text-clay-600",
    IN_PREP: "bg-gold/15 text-gold-dark",
    READY: "bg-green-100 text-green-700",
    COLLECTED: "bg-clay-200 text-clay-500",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${styles[status]}`}
    >
      <Clock className="h-3 w-3" />
      {getPreparationStatusLabel(status)}
    </span>
  );
}

function OrderRow({
  order,
  saving,
  onAdvancePrep,
  onReversePrep,
  onTogglePayment,
  onView,
}: {
  order: SerializedOrder;
  saving: boolean;
  onAdvancePrep: () => void;
  onReversePrep: () => void;
  onTogglePayment: () => void;
  onView: () => void;
}) {
  const itemSummary = order.items
    .map((i) => `${i.qty}× ${i.name}`)
    .join(", ");
  const nextPrep = getNextPrepStatus(order.preparationStatus);
  const prevPrep = getPrevPrepStatus(order.preparationStatus);

  return (
    <Card className={order.isArchived ? "opacity-50" : ""}>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-clay-700 font-medium">
                {order.orderNumber}
              </span>
              <span className="text-clay-300">·</span>
              <span className="font-medium text-clay-700">
                {order.customerName}
              </span>
              {order.submittedBy === "member" && (
                <Badge className="bg-clay-100 text-clay-500 border-clay-200 text-[10px]">
                  Counter
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-clay-500">
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {order.customerPhone}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {getPickupTimeLabel(
                  order.pickupTime as FundraisingPickupTimeOption,
                  order.customPickupTime
                )}
              </span>
              <span className="text-clay-400 text-xs">
                {formatDistanceToNow(new Date(order.createdAt), {
                  addSuffix: true,
                })}
              </span>
            </div>
            <p className="mt-2 text-sm text-clay-600 truncate">{itemSummary}</p>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className="font-display text-lg text-clay-700">
              {CURRENCY_SYMBOL}
              {order.total}
            </span>
            <button
              type="button"
              onClick={onTogglePayment}
              disabled={saving}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-clay-300 rounded-full"
              title={
                order.paymentStatus === "PAID"
                  ? "Mark as unpaid"
                  : "Mark as paid"
              }
            >
              <PaymentBadge status={order.paymentStatus} />
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-clay-100">
          <PrepBadge status={order.preparationStatus} />
          {nextPrep && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={onAdvancePrep}
              disabled={saving}
            >
              Mark {getPreparationStatusLabel(nextPrep).toLowerCase()}
              <ChevronDown className="h-3 w-3 -rotate-90" />
            </Button>
          )}
          {prevPrep && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-clay-400 hover:text-clay-600"
              onClick={onReversePrep}
              disabled={saving}
            >
              Undo
            </Button>
          )}
          <div className="ml-auto">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1"
              onClick={onView}
            >
              <Eye className="h-3 w-3" />
              View
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OrderDetail({
  order,
  saving,
  canDelete,
  onAdvancePrep,
  onReversePrep,
  onTogglePayment,
  onArchive,
  onDelete,
  onClose,
}: {
  order: SerializedOrder;
  saving: boolean;
  canDelete: boolean;
  onAdvancePrep: () => void;
  onReversePrep: () => void;
  onTogglePayment: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const nextPrep = getNextPrepStatus(order.preparationStatus);
  const prevPrep = getPrevPrepStatus(order.preparationStatus);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 font-display">
          <Receipt className="h-5 w-5 text-gold-dark" />
          {order.orderNumber}
        </DialogTitle>
        <DialogDescription>
          Placed {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
          {order.submittedBy === "member" && " by a Fundraising member"}.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="rounded-lg border border-clay-200 bg-cream p-4">
          <div className="flex items-center gap-2 text-clay-700">
            <UserIcon className="h-4 w-4" />
            <p className="font-medium">{order.customerName}</p>
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-clay-500">
            <Phone className="h-3.5 w-3.5" />
            {order.customerPhone}
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-clay-500">
            <Clock className="h-3.5 w-3.5" />
            {getPickupTimeLabel(
              order.pickupTime as FundraisingPickupTimeOption,
              order.customPickupTime
            )}
          </div>
          {order.notes && (
            <p className="mt-2 text-sm text-clay-600 italic border-l-2 border-gold pl-3">
              {order.notes}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          {order.items.map((i) => (
            <div
              key={i.itemKey}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-clay-600">
                <span className="text-gold-dark font-medium mr-2">
                  {i.qty}×
                </span>
                {i.name}
              </span>
              <span className="text-clay-700">
                {CURRENCY_SYMBOL}
                {i.subtotal}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 border-t border-clay-100 font-display">
            <span>Total</span>
            <span className="text-lg">
              {CURRENCY_SYMBOL}
              {order.total}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-clay-200 p-3">
            <p className="text-xs text-clay-400 uppercase tracking-wider mb-1.5">
              Payment
            </p>
            <PaymentBadge status={order.paymentStatus} />
            {order.paymentStatus === "PAID" && order.paidByName && (
              <p className="text-xs text-clay-400 mt-2">
                {order.paymentMethod === "momo" ? "MoMo" : "Cash"} ·{" "}
                {order.paidByName}
              </p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="mt-2 w-full"
              onClick={onTogglePayment}
              disabled={saving}
            >
              {order.paymentStatus === "PAID"
                ? "Mark unpaid"
                : "Mark paid"}
            </Button>
          </div>
          <div className="rounded-lg border border-clay-200 p-3">
            <p className="text-xs text-clay-400 uppercase tracking-wider mb-1.5">
              Preparation
            </p>
            <PrepBadge status={order.preparationStatus} />
            {order.preparationUpdatedByName && (
              <p className="text-xs text-clay-400 mt-2 truncate">
                by {order.preparationUpdatedByName}
              </p>
            )}
            <div className="mt-2 flex gap-1">
              {nextPrep && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={onAdvancePrep}
                  disabled={saving}
                >
                  → {getPreparationStatusLabel(nextPrep)}
                </Button>
              )}
              {prevPrep && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onReversePrep}
                  disabled={saving}
                >
                  Undo
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-clay-400"
            onClick={onArchive}
          >
            {order.isArchived ? "Restore order" : "Archive order"}
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={onDelete}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Delete order
            </Button>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </>
  );
}

function AddOrderDialog({
  open,
  onOpenChange,
  braaiId,
  braaiTitle,
  menu,
  menuLoading,
  menuError,
  onRetryMenu,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  braaiId: string;
  braaiTitle: string;
  menu: FundraisingMenuConfig | null;
  menuLoading: boolean;
  menuError: string | null;
  onRetryMenu: () => void;
  onCreated: (order: SerializedOrder) => void;
}) {
  const { firebaseUser } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pickup, setPickup] = useState<FundraisingPickupTimeOption>("after_1st");
  const [customTime, setCustomTime] = useState("");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setPhone("");
      setPickup("after_1st");
      setCustomTime("");
      setNotes("");
      setCart({});
      setError(null);
    }
  }, [open]);

  const setQty = (key: string, delta: number) => {
    setCart((prev) => {
      const current = prev[key] || 0;
      const next = Math.max(0, Math.min(99, current + delta));
      const out = { ...prev };
      if (next === 0) delete out[key];
      else out[key] = next;
      return out;
    });
  };

  const items: FundraisingMenuItem[] = menu?.items || [];
  const cartLines = items
    .map((i) => ({ item: i, qty: cart[i.key] || 0 }))
    .filter((l) => l.qty > 0);
  const total = cartLines.reduce(
    (sum, l) => sum + l.qty * l.item.price,
    0
  );

  const handleSubmit = async () => {
    if (!firebaseUser) return;
    setError(null);
    if (!name.trim() || !phone.trim()) {
      setError("Name and phone are required.");
      return;
    }
    if (cartLines.length === 0) {
      setError("Add at least one item.");
      return;
    }
    if (pickup === "custom" && !customTime) {
      setError("Pick a specific collection time.");
      return;
    }
    setSubmitting(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch(
        `/api/fundraising/braai/events/${braaiId}/orders`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            customerName: name.trim(),
            customerPhone: phone.trim(),
            pickupTime: pickup,
            customPickupTime: pickup === "custom" ? customTime : null,
            notes: notes.trim() || null,
            items: cartLines.map((l) => ({
              itemKey: l.item.key,
              qty: l.qty,
            })),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      onCreated(data.order);
      toast({
        title: "Order added",
        description: `${data.order.orderNumber} for ${data.order.customerName}.`,
        variant: "success",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add order on behalf</DialogTitle>
          <DialogDescription>
            Enter an order someone gave you in person for {braaiTitle}.
          </DialogDescription>
        </DialogHeader>

        {menuLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : menuError && !menu ? (
          <div className="space-y-3 py-4 text-center">
            <p className="text-sm text-red-700">{menuError}</p>
            <Button type="button" variant="outline" size="sm" onClick={onRetryMenu}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 text-sm text-red-700 p-3">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label>Items</Label>
              <div className="space-y-2">
                {items.map((item) => {
                  const qty = cart[item.key] || 0;
                  return (
                    <div
                      key={item.key}
                      className="flex items-center gap-3 justify-between rounded-lg border border-clay-200 px-3 py-2"
                    >
                      <MenuItemThumb item={item} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-clay-700 truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-clay-400">
                          {CURRENCY_SYMBOL}
                          {item.price} each
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => setQty(item.key, -1)}
                          disabled={qty === 0}
                        >
                          −
                        </Button>
                        <span className="w-6 text-center font-display">
                          {qty}
                        </span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => setQty(item.key, 1)}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {cartLines.length > 0 && (
                <p className="text-right font-display text-clay-700">
                  Total: {CURRENCY_SYMBOL}
                  {total}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="add-name">Name</Label>
                <Input
                  id="add-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="add-phone">Phone</Label>
                <Input
                  id="add-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="add-pickup">Pickup</Label>
                <Select
                  value={pickup}
                  onValueChange={(v) =>
                    setPickup(v as FundraisingPickupTimeOption)
                  }
                >
                  <SelectTrigger id="add-pickup">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FUNDRAISING_PICKUP_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {pickup === "custom" && (
                <div className="space-y-1">
                  <Label htmlFor="add-time">Time</Label>
                  <Input
                    id="add-time"
                    type="time"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="add-notes">Notes</Label>
              <Textarea
                id="add-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Allergies, special requests..."
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="gold"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? <LoadingSpinner size="sm" /> : "Add order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

