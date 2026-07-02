"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  CURRENCY_SYMBOL,
  FUNDRAISING_PICKUP_OPTIONS,
} from "@/lib/fundraising-menu";
import type {
  FundraisingMenuConfig,
  FundraisingMenuItem,
  FundraisingPickupTimeOption,
} from "@/types";

interface PublicBraai {
  id: string;
  title: string;
  eventDate: string;
  venue: string | null;
}

interface ConfirmedOrder {
  id: string;
  orderNumber: string;
  total: number;
  currency: string;
  items: {
    itemKey: string;
    name: string;
    unitPrice: number;
    qty: number;
    subtotal: number;
  }[];
  customerName: string;
  customerPhone: string;
  pickupTime: FundraisingPickupTimeOption;
  customPickupTime: string | null;
  braaiEventTitle: string;
  braaiEventDate: string | null;
  momoNumber: string;
}

type DrawerView = "cart" | "checkout" | "receipt";

const ROMAN = ["I", "II", "III", "IV", "V"];

function formatCurrency(amount: number, symbol = CURRENCY_SYMBOL): string {
  return `${symbol}${amount}`;
}

export default function PottersShockersOrderPage() {
  const [menu, setMenu] = useState<FundraisingMenuConfig | null>(null);
  const [braais, setBraais] = useState<PublicBraai[]>([]);
  const [selectedBraaiId, setSelectedBraaiId] = useState<string>("");
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);

  const [cart, setCart] = useState<Record<string, number>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [view, setView] = useState<DrawerView>("cart");

  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custPickup, setCustPickup] =
    useState<FundraisingPickupTimeOption>("after_1st");
  const [custTime, setCustTime] = useState("");
  const [custNotes, setCustNotes] = useState("");

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(
    null
  );
  const [copied, setCopied] = useState(false);

  const drawerRef = useRef<HTMLDivElement | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending "Copied" reset on unmount.
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  // ─── Initial data ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [menuRes, braaisRes] = await Promise.all([
          fetch("/api/fundraising/public/menu"),
          fetch("/api/fundraising/public/braais"),
        ]);
        const menuData = await menuRes.json();
        const braaisData = await braaisRes.json();
        if (cancelled) return;
        if (!menuRes.ok) {
          throw new Error(menuData?.error || "Failed to load menu");
        }
        if (!braaisRes.ok) {
          throw new Error(braaisData?.error || "Failed to load braais");
        }
        setMenu(menuData);
        setBraais(braaisData.braais || []);
        if (braaisData.braais && braaisData.braais.length > 0) {
          setSelectedBraaiId(braaisData.braais[0].id);
        }
      } catch (err) {
        if (!cancelled) {
          setInitialError(
            err instanceof Error ? err.message : "Something went wrong"
          );
        }
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Cart helpers ───────────────────────────────────────────────
  const itemsArray = useMemo(() => menu?.items || [], [menu]);

  const cartLines = useMemo(() => {
    return itemsArray
      .filter((item) => (cart[item.key] || 0) > 0)
      .map((item) => ({
        item,
        qty: cart[item.key] || 0,
        subtotal: (cart[item.key] || 0) * item.price,
      }));
  }, [itemsArray, cart]);

  const totalCount = useMemo(
    () => cartLines.reduce((sum, l) => sum + l.qty, 0),
    [cartLines]
  );
  const totalAmount = useMemo(
    () => cartLines.reduce((sum, l) => sum + l.subtotal, 0),
    [cartLines]
  );

  const setQty = useCallback((key: string, delta: number) => {
    setCart((prev) => {
      const current = prev[key] || 0;
      const next = Math.max(0, Math.min(99, current + delta));
      const out = { ...prev };
      if (next === 0) delete out[key];
      else out[key] = next;
      return out;
    });
  }, []);

  // ─── Drawer ─────────────────────────────────────────────────────
  const openCart = () => {
    setView("cart");
    setDrawerOpen(true);
  };
  const closeDrawer = () => {
    setDrawerOpen(false);
  };

  // Reset to the cart view if the cart becomes empty.
  useEffect(() => {
    if (totalCount === 0 && view !== "receipt") {
      setView("cart");
    }
  }, [totalCount, view]);

  // ─── Submit ─────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitError(null);
    if (!selectedBraaiId) {
      setSubmitError("Pick which braai you're ordering from.");
      return;
    }
    if (!custName.trim() || !custPhone.trim()) {
      setSubmitError("Please enter your name and phone number.");
      return;
    }
    if (custPickup === "custom" && !custTime) {
      setSubmitError("Please pick a specific collection time.");
      return;
    }
    if (cartLines.length === 0) {
      setSubmitError("Your basket is empty.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/fundraising/public/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          braaiEventId: selectedBraaiId,
          customerName: custName.trim(),
          customerPhone: custPhone.trim(),
          pickupTime: custPickup,
          customPickupTime: custPickup === "custom" ? custTime : null,
          notes: custNotes.trim() || null,
          items: cartLines.map((l) => ({ itemKey: l.item.key, qty: l.qty })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Could not place your order.");
      }
      setConfirmedOrder(data.order as ConfirmedOrder);
      setView("receipt");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Could not place your order."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartNewOrder = () => {
    setCart({});
    setCustName("");
    setCustPhone("");
    setCustPickup("after_1st");
    setCustTime("");
    setCustNotes("");
    setConfirmedOrder(null);
    setView("cart");
    setDrawerOpen(false);
    setSubmitError(null);
  };

  const handleCopyMomo = async () => {
    if (!confirmedOrder) return;
    const raw = confirmedOrder.momoNumber.replace(/\s+/g, "");
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore — most browsers will allow it; fallback could be added if needed
    }
  };

  // Close drawer on Escape.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // While the drawer is open, lock background scroll and move focus into it
  // so keyboard/screen-reader users land in the dialog rather than the page
  // behind it.
  useEffect(() => {
    if (!drawerOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeButton =
      drawerRef.current?.querySelector<HTMLElement>(".po-cart-close");
    closeButton?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [drawerOpen]);

  // ─── Render ─────────────────────────────────────────────────────
  const selectedBraai = useMemo(
    () => braais.find((b) => b.id === selectedBraaiId) || null,
    [braais, selectedBraaiId]
  );

  const priceRange = useMemo(() => {
    if (itemsArray.length === 0) return null;
    const prices = itemsArray.map((i) => i.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? `${min}` : `${min}–${max}`;
  }, [itemsArray]);

  return (
    <>
      {/* Top bar */}
      <div className="po-topbar">
        <div className="po-container po-topbar-inner">
          <span>Dew of Hermon Youth Ministry</span>
          <span className="po-topbar-meta">Tabernacle of David · Lusaka</span>
        </div>
      </div>

      {/* Hero */}
      <header className="po-hero po-container">
        <div className="po-hero-mark">
          <span className="po-dot" />
          <span>Live now · Place your order</span>
        </div>
        <h1>
          Potter&apos;s <span className="po-accent">Shockers</span>
          <br />
          Fundraiser
        </h1>
        <p className="po-hero-sub">
          Hot food, prepared by the youth, sold every Sunday to support
          ministry. Pick your meal below and we&apos;ll have it ready for
          collection at church.
        </p>

        <div className="po-hero-stats">
          <div>
            <div className="po-stat-num">{itemsArray.length || "—"}</div>
            <div className="po-stat-label">Menu Items</div>
          </div>
          <div>
            <div className="po-stat-num">
              <span className="po-currency">{CURRENCY_SYMBOL}</span>
              {priceRange ?? "—"}
            </div>
            <div className="po-stat-label">Price Range</div>
          </div>
          <div>
            <div className="po-stat-num">2 ways</div>
            <div className="po-stat-label">To Pay</div>
          </div>
        </div>

        {/* Braai selector */}
        <div className="po-braai-select">
          <div className="po-braai-select-label">
            Ordering for which braai?
          </div>
          {loadingInitial ? (
            <p className="po-braai-empty">Loading upcoming braais…</p>
          ) : braais.length === 0 ? (
            <p className="po-braai-empty">
              No upcoming braais are open for orders right now. Check back soon.
            </p>
          ) : (
            <>
              <select
                value={selectedBraaiId}
                onChange={(e) => setSelectedBraaiId(e.target.value)}
              >
                {braais.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} ·{" "}
                    {format(parseISO(b.eventDate), "EEE, d MMM yyyy")}
                    {b.venue ? ` · ${b.venue}` : ""}
                  </option>
                ))}
              </select>
              {selectedBraai && (
                <p
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: "var(--brown)",
                    letterSpacing: "0.04em",
                  }}
                >
                  Your order will be ready for collection on{" "}
                  {format(parseISO(selectedBraai.eventDate), "EEEE, d MMMM")}.
                </p>
              )}
            </>
          )}
        </div>
      </header>

      {/* Menu */}
      <section className="po-menu-section po-container" id="menu">
        <div className="po-section-head">
          <div className="po-section-eyebrow">The Menu</div>
          <h2>
            Choose what&apos;s on your <em>table</em>
          </h2>
          <p className="po-menu-note">
            Every meal comes with complimentary <em>coleslaw</em> on the side.
          </p>
        </div>

        {initialError && (
          <div className="po-form-error" style={{ maxWidth: 560, margin: "0 auto 24px" }}>
            {initialError}
          </div>
        )}

        {loadingInitial ? (
          <div className="po-loading">Loading menu…</div>
        ) : (
          <div className="po-menu-grid">
            {itemsArray.map((item, i) => (
              <MenuCard
                key={item.key}
                item={item}
                index={i}
                qty={cart[item.key] || 0}
                onInc={() => setQty(item.key, 1)}
                onDec={() => setQty(item.key, -1)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Story */}
      <section className="po-story po-container">
        <div className="po-section-head">
          <div className="po-section-eyebrow">Why we do this</div>
          <h2>
            Hot food, <em>bigger purpose.</em>
          </h2>
        </div>
        <p>
          Every Kwacha raised goes back into the ministry — supporting outreach,
          camps, and the discipleship of the next generation of believers at
          Tabernacle of David.
        </p>
        <p>
          Thank you for joining us at the table.
        </p>
      </section>

      {/* Verse */}
      <section className="po-verse-block po-container">
        <p className="po-verse">
          “As the dew of Hermon, and as the dew that descended upon the
          mountains of Zion: for there the LORD commanded the blessing.”
          <span className="po-verse-ref">Psalm 133:3</span>
        </p>
        <p className="po-tagline">
          Every Kwacha <span className="po-sep">·</span> For the Kingdom{" "}
          <span className="po-sep">·</span> Thank You
        </p>
      </section>

      {/* Cart FAB */}
      <button
        className={`po-cart-fab ${totalCount === 0 ? "po-hidden" : ""}`}
        onClick={openCart}
        aria-label="View order"
      >
        <span className="po-cart-fab-count">{totalCount}</span>
        <span>View order · {formatCurrency(totalAmount)}</span>
      </button>

      {/* Overlay + drawer */}
      <div
        className={`po-cart-overlay ${drawerOpen ? "po-open" : ""}`}
        onClick={closeDrawer}
      />
      <aside
        className={`po-cart-drawer ${drawerOpen ? "po-open" : ""}`}
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Order basket"
        aria-hidden={!drawerOpen}
      >
        <div className="po-cart-head">
          <span>
            {view === "receipt"
              ? "Order Confirmed"
              : view === "checkout"
                ? "Your Details"
                : "Your Order"}
          </span>
          <button
            type="button"
            className="po-cart-close"
            onClick={closeDrawer}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {view === "cart" && (
          <CartView
            cartLines={cartLines}
            onInc={(key) => setQty(key, 1)}
            onDec={(key) => setQty(key, -1)}
            total={totalAmount}
            count={totalCount}
            onCheckout={() => {
              if (!selectedBraaiId) {
                setSubmitError("Pick which braai you're ordering from.");
                setView("checkout");
                return;
              }
              setSubmitError(null);
              setView("checkout");
            }}
          />
        )}

        {view === "checkout" && (
          <CheckoutView
            custName={custName}
            setCustName={setCustName}
            custPhone={custPhone}
            setCustPhone={setCustPhone}
            custPickup={custPickup}
            setCustPickup={setCustPickup}
            custTime={custTime}
            setCustTime={setCustTime}
            custNotes={custNotes}
            setCustNotes={setCustNotes}
            total={totalAmount}
            submitting={submitting}
            submitError={submitError}
            onBack={() => setView("cart")}
            onSubmit={handleSubmit}
          />
        )}

        {view === "receipt" && confirmedOrder && (
          <ReceiptView
            order={confirmedOrder}
            copied={copied}
            onCopyMomo={handleCopyMomo}
            onNewOrder={handleStartNewOrder}
          />
        )}
      </aside>
    </>
  );
}

function MenuCard({
  item,
  index,
  qty,
  onInc,
  onDec,
}: {
  item: FundraisingMenuItem;
  index: number;
  qty: number;
  onInc: () => void;
  onDec: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = item.imagePath && !imageFailed;
  return (
    <article className="po-item">
      <div className={`po-item-visual ${showImage ? "po-item-visual-image" : ""}`}>
        <span className="po-item-number">{ROMAN[index] || String(index + 1)}</span>
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imagePath}
            alt={item.name}
            className="po-item-photo"
            onError={() => setImageFailed(true)}
            loading="lazy"
          />
        ) : (
          <span className="po-item-emoji" aria-hidden>
            {item.emoji}
          </span>
        )}
      </div>
      <div className="po-item-content">
        <h3 className="po-item-name">{item.name}</h3>
        <p className="po-item-desc">{item.description}</p>
        <div className="po-item-price-row">
          <div className="po-item-price">
            <span className="po-unit">{CURRENCY_SYMBOL}</span>
            {item.price}
          </div>
          <div className="po-qty-control">
            <button
              type="button"
              className="po-qty-btn"
              onClick={onDec}
              disabled={qty === 0}
              aria-label={`Decrease ${item.name}`}
            >
              −
            </button>
            <span className="po-qty-display">{qty}</span>
            <button
              type="button"
              className="po-qty-btn"
              onClick={onInc}
              aria-label={`Increase ${item.name}`}
            >
              +
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function CartLineThumb({ item }: { item: FundraisingMenuItem }) {
  const [failed, setFailed] = useState(false);
  if (item.imagePath && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.imagePath}
        alt={item.name}
        className="po-cart-line-photo"
        onError={() => setFailed(true)}
        loading="lazy"
      />
    );
  }
  return (
    <div className="po-cart-line-visual" aria-hidden>
      {item.emoji}
    </div>
  );
}

function CartView({
  cartLines,
  onInc,
  onDec,
  total,
  count,
  onCheckout,
}: {
  cartLines: { item: FundraisingMenuItem; qty: number; subtotal: number }[];
  onInc: (key: string) => void;
  onDec: (key: string) => void;
  total: number;
  count: number;
  onCheckout: () => void;
}) {
  return (
    <>
      <div className="po-cart-body">
        {cartLines.length === 0 ? (
          <div className="po-cart-empty">
            <div className="po-cart-empty-emoji">🧺</div>
            <div>
              Your basket is empty.
              <br />
              Add something hot.
            </div>
          </div>
        ) : (
          cartLines.map((l) => (
            <div key={l.item.key} className="po-cart-line">
              <CartLineThumb item={l.item} />
              <div className="po-cart-line-info">
                <div className="po-cart-line-name">{l.item.name}</div>
                <div className="po-cart-line-unit">
                  {CURRENCY_SYMBOL}
                  {l.item.price} each
                </div>
              </div>
              <div className="po-cart-line-controls">
                <div className="po-cart-line-price">
                  {CURRENCY_SYMBOL} {l.subtotal}
                </div>
                <div className="po-cart-mini-qty">
                  <button
                    type="button"
                    onClick={() => onDec(l.item.key)}
                    aria-label="Decrease"
                  >
                    −
                  </button>
                  <span className="po-v">{l.qty}</span>
                  <button
                    type="button"
                    onClick={() => onInc(l.item.key)}
                    aria-label="Increase"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="po-cart-foot">
        <div className="po-cart-row">
          <span>Items</span>
          <span>{count}</span>
        </div>
        <div className="po-cart-row po-total">
          <span className="po-lbl">Total</span>
          <span className="po-val">
            {CURRENCY_SYMBOL} {total}
          </span>
        </div>
        <button
          type="button"
          className="po-checkout-btn"
          onClick={onCheckout}
          disabled={cartLines.length === 0}
        >
          Continue to details →
        </button>
      </div>
    </>
  );
}

function CheckoutView({
  custName,
  setCustName,
  custPhone,
  setCustPhone,
  custPickup,
  setCustPickup,
  custTime,
  setCustTime,
  custNotes,
  setCustNotes,
  total,
  submitting,
  submitError,
  onBack,
  onSubmit,
}: {
  custName: string;
  setCustName: (v: string) => void;
  custPhone: string;
  setCustPhone: (v: string) => void;
  custPickup: FundraisingPickupTimeOption;
  setCustPickup: (v: FundraisingPickupTimeOption) => void;
  custTime: string;
  setCustTime: (v: string) => void;
  custNotes: string;
  setCustNotes: (v: string) => void;
  total: number;
  submitting: boolean;
  submitError: string | null;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <div className="po-cart-body">
        <button type="button" className="po-back-btn" onClick={onBack}>
          ← Back to order
        </button>
        <p className="po-form-intro">
          A few details so we can find you at collection.
        </p>

        {submitError && <div className="po-form-error">{submitError}</div>}

        <div className="po-form-group">
          <label className="po-form-label" htmlFor="custName">
            Full Name
          </label>
          <input
            id="custName"
            className="po-form-input"
            type="text"
            placeholder="Your name"
            autoComplete="name"
            value={custName}
            onChange={(e) => setCustName(e.target.value)}
          />
        </div>

        <div className="po-form-group">
          <label className="po-form-label" htmlFor="custPhone">
            Phone Number
          </label>
          <input
            id="custPhone"
            className="po-form-input"
            type="tel"
            placeholder="+260 ..."
            autoComplete="tel"
            value={custPhone}
            onChange={(e) => setCustPhone(e.target.value)}
          />
        </div>

        <div className="po-form-group">
          <label className="po-form-label" htmlFor="custPickup">
            Pickup Time
          </label>
          <select
            id="custPickup"
            className="po-form-select"
            value={custPickup}
            onChange={(e) =>
              setCustPickup(e.target.value as FundraisingPickupTimeOption)
            }
          >
            {FUNDRAISING_PICKUP_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {custPickup === "custom" && (
          <div className="po-form-group">
            <label className="po-form-label" htmlFor="custTime">
              Specific Time
            </label>
            <input
              id="custTime"
              className="po-form-input"
              type="time"
              value={custTime}
              onChange={(e) => setCustTime(e.target.value)}
            />
          </div>
        )}

        <div className="po-form-group">
          <label className="po-form-label" htmlFor="custNotes">
            Notes{" "}
            <span
              style={{
                textTransform: "none",
                letterSpacing: 0,
                color: "var(--tan)",
                fontWeight: 400,
              }}
            >
              (optional)
            </span>
          </label>
          <textarea
            id="custNotes"
            className="po-form-textarea"
            placeholder="Allergies, special requests..."
            value={custNotes}
            onChange={(e) => setCustNotes(e.target.value)}
          />
        </div>
      </div>
      <div className="po-cart-foot">
        <div className="po-cart-row po-total">
          <span className="po-lbl">Total</span>
          <span className="po-val">
            {CURRENCY_SYMBOL} {total}
          </span>
        </div>
        <button
          type="button"
          className="po-checkout-btn"
          onClick={onSubmit}
          disabled={submitting}
        >
          {submitting ? "Placing order…" : "Place order"}
        </button>
      </div>
    </>
  );
}

function ReceiptView({
  order,
  copied,
  onCopyMomo,
  onNewOrder,
}: {
  order: ConfirmedOrder;
  copied: boolean;
  onCopyMomo: () => void;
  onNewOrder: () => void;
}) {
  const pickupLabel = (() => {
    switch (order.pickupTime) {
      case "after_1st":
        return "After 1st Service";
      case "after_2nd":
        return "After 2nd Service";
      case "lunch_hour":
        return "Lunch hour";
      case "custom":
        return order.customPickupTime
          ? `At ${order.customPickupTime}`
          : "Specific time";
    }
  })();

  return (
    <>
      <div className="po-cart-body">
        <div className="po-success-mark">
          <div className="po-success-check">✓</div>
          <div className="po-success-title">Order placed!</div>
          <div className="po-success-sub">Now complete payment below</div>
        </div>

        <div className="po-receipt">
          <div className="po-receipt-no">
            <div className="po-receipt-no-label">Order Number</div>
            <div className="po-receipt-no-val">{order.orderNumber}</div>
          </div>

          <div className="po-receipt-line" style={{ color: "var(--brown)" }}>
            <span>{order.braaiEventTitle}</span>
            <span>
              {order.braaiEventDate
                ? format(parseISO(order.braaiEventDate), "EEE, d MMM")
                : ""}
            </span>
          </div>
          <div className="po-receipt-line" style={{ color: "var(--brown)" }}>
            <span>Pickup</span>
            <span>{pickupLabel}</span>
          </div>

          <div style={{ marginTop: 10 }}>
            {order.items.map((i) => (
              <div className="po-receipt-line" key={i.itemKey}>
                <span>
                  <span className="po-qty">{i.qty}×</span>
                  {i.name}
                </span>
                <span>
                  {CURRENCY_SYMBOL} {i.subtotal}
                </span>
              </div>
            ))}
          </div>

          <div className="po-receipt-total">
            <span>Total</span>
            <span>
              {CURRENCY_SYMBOL} {order.total}
            </span>
          </div>

          <div className="po-receipt-customer">
            <div className="po-nm">{order.customerName}</div>
            <div>{order.customerPhone}</div>
          </div>
        </div>

        <div className="po-payment-block">
          <div className="po-payment-title">Pay with one of these</div>
          <p className="po-payment-sub">Choose what&apos;s easiest for you.</p>

          <div className="po-pay-card">
            <div className="po-pay-card-head">
              <div className="po-pay-card-icon" aria-hidden>
                📱
              </div>
              <div className="po-pay-card-method">Mobile Money</div>
            </div>
            <div className="po-pay-momo-row">
              <span className="po-pay-momo-number">{order.momoNumber}</span>
              <button
                type="button"
                className={`po-copy-btn ${copied ? "po-copied" : ""}`}
                onClick={onCopyMomo}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="po-pay-amount">
              Send{" "}
              <strong>
                {CURRENCY_SYMBOL} {order.total}
              </strong>{" "}
              to the number above.
            </p>
            <p className="po-ref-note">
              Use order number <strong>{order.orderNumber}</strong> as
              reference if possible.
            </p>
          </div>

          <div className="po-pay-card">
            <div className="po-pay-card-head">
              <div className="po-pay-card-icon" aria-hidden>
                💵
              </div>
              <div className="po-pay-card-method">Cash at Collection</div>
            </div>
            <p className="po-pay-amount">
              Pay{" "}
              <strong>
                {CURRENCY_SYMBOL} {order.total}
              </strong>{" "}
              when you pick up your order. Bring the exact amount if possible.
            </p>
          </div>
        </div>

        <p className="po-receipt-note">
          Keep this screen or take a screenshot — your order number is the
          easiest way for the team to find your meal at the counter.
        </p>
      </div>
      <div className="po-cart-foot">
        <button
          type="button"
          className="po-new-order-btn"
          onClick={onNewOrder}
        >
          Place Another Order
        </button>
      </div>
    </>
  );
}
