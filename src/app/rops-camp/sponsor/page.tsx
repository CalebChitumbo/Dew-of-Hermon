"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CircleDollarSign,
  Flame,
  HeartHandshake,
  Users,
} from "lucide-react";
import { CAMPS, CAMP_CONTACTS } from "@/lib/camps";
import { buildPaymentReference } from "@/components/rops-camp/PaymentInstructionsCard";
import { RopsFontStyles } from "@/components/rops-camp/RopsFontStyles";

// ─── CONFIG ─────────────────────────────────────────────────────────
const camp = CAMPS[0];
const CAMP_FEE_ZMW = camp.fee;
const PAYMENT_NUMBER = "0975088939";

// ─── FORM TYPES ─────────────────────────────────────────────────────
type PledgeMode = "SLOTS" | "AMOUNT";

interface SponsorFormState {
  sponsorName: string;
  organization: string;
  phone: string;
  email: string;
  mode: PledgeMode;
  slots: string;
  amount: string;
  notes: string;
}

const INITIAL_FORM: SponsorFormState = {
  sponsorName: "",
  organization: "",
  phone: "",
  email: "",
  mode: "SLOTS",
  slots: "1",
  amount: "",
  notes: "",
};

interface SubmittedPledge {
  id: string;
  sponsorName: string;
  slotsPledged: number;
  amountPledged: number;
}

// ─── ROOT PAGE ──────────────────────────────────────────────────────
export default function SponsorPage() {
  return (
    <div className="font-body bg-rops-cream min-h-screen text-rops-ink">
      <RopsFontStyles />
      <Header />
      <PledgeSection />
      <Footer />
    </div>
  );
}

// ─── HEADER ─────────────────────────────────────────────────────────
function Header() {
  return (
    <header className="relative overflow-hidden bg-rops-cream rops-grain">
      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Flame
            size={20}
            className="text-rops-ember flame-flicker"
            strokeWidth={2}
            fill="currentColor"
          />
          <span className="font-display italic text-sm tracking-wide text-rops-ink">
            Dew of Hermon · Tabernacle of David
          </span>
        </div>
        <Link
          href="/rops-camp"
          className="font-body text-[11px] uppercase tracking-[0.18em] text-rops-taupe hover:text-rops-ink flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft size={12} /> Camp registration
        </Link>
      </div>

      <div className="relative max-w-3xl mx-auto px-6 md:px-10 pt-12 md:pt-20 pb-10 text-center">
        <div className="rise rise-1 flex items-center justify-center gap-3 mb-6">
          <div className="h-px w-10 bg-rops-ember" />
          <span className="font-body text-[11px] uppercase tracking-[0.22em] text-rops-ember">
            ROPs X · Sponsorship
          </span>
          <div className="h-px w-10 bg-rops-ember" />
        </div>
        <h1 className="rise rise-2 font-display text-rops-ink leading-[0.95] text-5xl md:text-6xl font-medium tracking-[-0.02em]">
          Send a youth
          <span className="italic text-rops-ember"> to camp.</span>
        </h1>
        <p className="rise rise-3 mt-6 font-body text-rops-ink-2 text-lg max-w-xl mx-auto leading-relaxed">
          Not every young person can cover the camp fee — and not everyone who
          wants to help is going to camp. Pledge a sponsorship below and we
          will match it to registered campers who need it.
        </p>
        <div className="rise rise-4 mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 font-body text-xs text-rops-taupe">
          <span className="inline-flex items-center gap-2">
            <CircleDollarSign size={14} className="text-rops-ember" />
            {camp.currency} {CAMP_FEE_ZMW.toLocaleString()} sends one youth
          </span>
          <span className="inline-flex items-center gap-2">
            <Users size={14} className="text-rops-ember" />
            Sponsor as many as you wish
          </span>
          <span className="inline-flex items-center gap-2">
            <HeartHandshake size={14} className="text-rops-ember" />
            We record and allocate every pledge
          </span>
        </div>
      </div>
    </header>
  );
}

// ─── PLEDGE FORM ────────────────────────────────────────────────────
function PledgeSection() {
  const [form, setForm] = useState<SponsorFormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<
    Partial<Record<keyof SponsorFormState, string>>
  >({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<SubmittedPledge | null>(null);

  const set =
    <K extends keyof SponsorFormState>(key: K) =>
    (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      const value = e.target.value;
      setForm((f) => ({ ...f, [key]: value as SponsorFormState[K] }));
      if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
    };

  const slotsNumber = Math.max(0, Math.floor(Number(form.slots) || 0));
  const amountNumber = Math.max(0, Number(form.amount) || 0);
  const coveredYouth =
    form.mode === "SLOTS"
      ? slotsNumber
      : Math.floor(amountNumber / CAMP_FEE_ZMW);
  const pledgeValue =
    form.mode === "SLOTS" ? slotsNumber * CAMP_FEE_ZMW : amountNumber;

  const validate = () => {
    const err: Partial<Record<keyof SponsorFormState, string>> = {};
    if (!form.sponsorName.trim()) err.sponsorName = "Your name is required";
    if (!form.phone.trim()) err.phone = "Phone number is required";
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email))
      err.email = "Enter a valid email";
    if (form.mode === "SLOTS") {
      if (!Number.isInteger(Number(form.slots)) || Number(form.slots) < 1)
        err.slots = "Enter how many youth (at least 1)";
    } else {
      if (!amountNumber) err.amount = "Enter your pledge amount";
      else if (amountNumber < CAMP_FEE_ZMW)
        err.amount = `Minimum is ${camp.currency} ${CAMP_FEE_ZMW.toLocaleString()} — one youth's fee`;
    }
    return err;
  };

  const handleSubmit = async () => {
    setServerError(null);
    const err = validate();
    setErrors(err);
    if (Object.keys(err).length > 0) {
      const firstKey = Object.keys(err)[0];
      const el = document.querySelector(`[data-field="${firstKey}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/camp-sponsorships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campId: camp.id,
          sponsorName: form.sponsorName,
          organization: form.organization || undefined,
          phone: form.phone,
          email: form.email || undefined,
          pledgeType: form.mode,
          slotsPledged: form.mode === "SLOTS" ? Number(form.slots) : undefined,
          amountPledged:
            form.mode === "AMOUNT" ? Number(form.amount) : undefined,
          notes: form.notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setServerError(
          json.error || "We couldn't save your pledge. Please try again."
        );
        return;
      }
      setSubmitted({
        id: json.sponsorship.id,
        sponsorName: form.sponsorName,
        slotsPledged: json.sponsorship.slotsPledged,
        amountPledged: json.sponsorship.amountPledged,
      });
    } catch {
      setServerError(
        "Network error — please check your connection and try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <PledgeConfirmation
        pledge={submitted}
        onAnother={() => {
          setSubmitted(null);
          setForm(INITIAL_FORM);
          setErrors({});
          setServerError(null);
        }}
      />
    );
  }

  return (
    <section className="bg-rops-cream pb-20 px-6 md:px-10">
      <div className="max-w-3xl mx-auto">
        {/* SECTION 1 — THE PLEDGE */}
        <div className="mb-12">
          <SectionHeader
            number="01"
            title="Your pledge"
            sub="Sponsor a number of youth, or pledge an amount and we'll work out how many it covers."
          />

          <div className="grid sm:grid-cols-2 gap-3 mb-8">
            {(
              [
                {
                  mode: "SLOTS" as PledgeMode,
                  title: "Sponsor youth",
                  detail: `I'll cover the full fee for a number of young people — ${camp.currency} ${CAMP_FEE_ZMW.toLocaleString()} each.`,
                },
                {
                  mode: "AMOUNT" as PledgeMode,
                  title: "Pledge an amount",
                  detail:
                    "I'll give a figure and let the camp team apply it where it's needed most.",
                },
              ]
            ).map((opt) => {
              const selected = form.mode === opt.mode;
              return (
                <button
                  key={opt.mode}
                  type="button"
                  onClick={() => {
                    setForm((f) => ({ ...f, mode: opt.mode }));
                    setErrors((er) => ({
                      ...er,
                      slots: undefined,
                      amount: undefined,
                    }));
                  }}
                  className={
                    "text-left p-5 rounded-sm border-[1.5px] transition-all " +
                    (selected
                      ? "border-rops-ember bg-rops-cream-2 ember-glow"
                      : "border-rops-line hover:border-rops-ink bg-transparent")
                  }
                >
                  <div className="font-display text-rops-ink text-lg tracking-tight">
                    {opt.title}
                  </div>
                  <div className="font-body text-[13px] text-rops-ink-2 mt-1 leading-relaxed">
                    {opt.detail}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
            {form.mode === "SLOTS" ? (
              <div data-field="slots">
                <Field
                  label="Number of youth"
                  required
                  error={errors.slots}
                  help={`${camp.currency} ${CAMP_FEE_ZMW.toLocaleString()} per youth`}
                >
                  <TextInput
                    type="number"
                    min={1}
                    step={1}
                    value={form.slots}
                    onChange={set("slots")}
                    placeholder="e.g. 2"
                  />
                </Field>
              </div>
            ) : (
              <div data-field="amount">
                <Field
                  label={`Pledge amount (${camp.currency})`}
                  required
                  error={errors.amount}
                  help={`min ${camp.currency} ${CAMP_FEE_ZMW.toLocaleString()}`}
                >
                  <TextInput
                    type="number"
                    min={CAMP_FEE_ZMW}
                    value={form.amount}
                    onChange={set("amount")}
                    placeholder={`e.g. ${(CAMP_FEE_ZMW * 3).toLocaleString()}`}
                  />
                </Field>
              </div>
            )}

            <div className="flex items-end">
              <div className="w-full bg-rops-cream-2 border border-rops-line rounded-sm px-4 py-3 font-body text-sm text-rops-ink-2">
                {coveredYouth > 0 ? (
                  <>
                    Your pledge covers{" "}
                    <span className="font-semibold text-rops-ink">
                      {coveredYouth} youth
                    </span>{" "}
                    ·{" "}
                    <span className="font-semibold text-rops-ink number-tag">
                      {camp.currency} {pledgeValue.toLocaleString()}
                    </span>
                  </>
                ) : (
                  <span className="text-rops-taupe">
                    Your pledge summary will appear here.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2 — CONTACT */}
        <div className="mb-12">
          <SectionHeader
            number="02"
            title="Your details"
            sub="So we can record the pledge in your name and reach you about payment."
          />
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
            <div data-field="sponsorName">
              <Field label="Full name" required error={errors.sponsorName}>
                <TextInput
                  value={form.sponsorName}
                  onChange={set("sponsorName")}
                  placeholder="e.g. Mwamba Phiri"
                />
              </Field>
            </div>
            <div data-field="organization">
              <Field label="Organisation / church" help="optional">
                <TextInput
                  value={form.organization}
                  onChange={set("organization")}
                  placeholder="e.g. Tabernacle of David"
                />
              </Field>
            </div>
            <div data-field="phone">
              <Field label="Phone" required error={errors.phone}>
                <TextInput
                  type="tel"
                  value={form.phone}
                  onChange={set("phone")}
                  placeholder="e.g. 0977 000 000"
                />
              </Field>
            </div>
            <div data-field="email">
              <Field label="Email" help="optional" error={errors.email}>
                <TextInput
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="you@example.com"
                />
              </Field>
            </div>
            <div data-field="notes" className="md:col-span-2">
              <Field label="Anything we should know?" help="optional">
                <TextAreaInput
                  value={form.notes}
                  onChange={set("notes")}
                  placeholder="e.g. I'd like to sponsor youth from a particular church, or I'll pay in two parts."
                />
              </Field>
            </div>
          </div>
        </div>

        {serverError && (
          <div className="mb-6 flex items-start gap-2 font-body text-[13px] text-rops-ember bg-rops-cream-2 border border-rops-ember/30 rounded-sm p-4">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="group w-full inline-flex items-center justify-center gap-3 bg-rops-ink text-rops-cream py-4 px-7 rounded-full font-body text-[13px] uppercase tracking-[0.18em] hover:bg-rops-ember disabled:opacity-50 transition-colors ember-glow"
        >
          {submitting ? "Recording your pledge…" : "Pledge sponsorship"}
          {!submitting && (
            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-1"
            />
          )}
        </button>
        <p className="mt-4 text-center font-body text-xs text-rops-taupe leading-relaxed">
          Submitting records your pledge with the camp team. Payment follows by
          mobile money — instructions appear on the next screen.
        </p>
      </div>
    </section>
  );
}

// ─── CONFIRMATION ──────────────────────────────────────────────────
function PledgeConfirmation({
  pledge,
  onAnother,
}: {
  pledge: SubmittedPledge;
  onAnother: () => void;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const reference = buildPaymentReference(pledge.id);
  const firstName =
    pledge.sponsorName.split(/\s+/)[0] || pledge.sponsorName;

  useEffect(() => {
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <section
      ref={sectionRef}
      className="bg-rops-cream py-24 px-6 md:px-10 rops-grain min-h-[80vh] flex items-center"
    >
      <div className="max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-rops-forest mb-8 rise rise-1">
          <Check size={36} className="text-rops-cream" strokeWidth={2.5} />
        </div>
        <div className="rise rise-2 font-body text-[11px] uppercase tracking-[0.22em] text-rops-ember mb-3">
          Pledge Recorded
        </div>
        <h2 className="rise rise-2 font-display text-rops-ink text-5xl tracking-tight mb-4">
          Thank you,<span className="italic"> {firstName}.</span>
        </h2>
        <p className="rise rise-3 font-body text-rops-ink-2 mt-6 text-lg leading-relaxed">
          Your pledge opens{" "}
          <span className="font-semibold">
            {pledge.slotsPledged} sponsorship slot
            {pledge.slotsPledged === 1 ? "" : "s"}
          </span>{" "}
          worth{" "}
          <span className="font-semibold number-tag">
            {camp.currency} {pledge.amountPledged.toLocaleString()}
          </span>
          . The camp team will allocate registered campers to your slots and
          can share who your sponsorship carried to camp.
        </p>

        <div className="rise rise-4 mt-10 text-left bg-rops-cream-2 border border-rops-line rounded-sm p-6">
          <div className="font-body text-[11px] uppercase tracking-[0.2em] text-rops-ember mb-3">
            Payment Instructions
          </div>
          <div className="grid sm:grid-cols-2 gap-y-3 gap-x-6 font-body text-sm">
            <div className="text-rops-taupe">Amount</div>
            <div className="text-rops-ink font-medium number-tag">
              {camp.currency} {pledge.amountPledged.toLocaleString()}
            </div>
            <div className="text-rops-taupe">Reference</div>
            <div className="text-rops-ink font-medium number-tag">
              {reference}
            </div>
            <div className="text-rops-taupe">Method</div>
            <div className="text-rops-ink font-medium number-tag">
              Mobile Money
            </div>
            <div className="text-rops-taupe">Send payment &amp; POP to</div>
            <div className="text-rops-ink font-medium number-tag">
              {PAYMENT_NUMBER}
            </div>
          </div>
          <div className="mt-5 pt-4 border-t border-rops-line font-body text-xs text-rops-taupe leading-relaxed">
            Send your mobile money payment{" "}
            <span className="font-semibold text-rops-ink">and</span> proof of
            payment (POP) to{" "}
            <span className="font-semibold text-rops-ink">
              {PAYMENT_NUMBER}
            </span>
            . Include the reference number above so we can match your payment
            to your sponsorship pledge. You can also pay in parts — just use
            the same reference each time.
          </div>
        </div>

        <div className="rise rise-5 mt-10 flex flex-col items-center gap-4">
          <Link
            href="/rops-camp"
            className="inline-flex items-center gap-2 bg-rops-ink text-rops-cream py-3.5 px-7 rounded-full font-body text-[13px] uppercase tracking-[0.18em] hover:bg-rops-ember transition-colors"
          >
            Back to camp page
            <ArrowRight size={14} />
          </Link>
          <button
            onClick={onAnother}
            className="inline-flex items-center gap-2 font-body text-[13px] uppercase tracking-[0.18em] text-rops-ink hover:text-rops-ember transition-colors"
          >
            <ArrowLeft size={14} /> Record another pledge
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── FOOTER ────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-rops-ink text-rops-cream px-6 md:px-10 py-10">
      <div className="max-w-3xl mx-auto flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <Flame
            size={16}
            className="text-rops-ember flame-flicker"
            fill="currentColor"
          />
          <span className="font-display italic text-sm">ROPs X · 2026</span>
        </div>
        <div>
          <div className="font-body text-[10px] uppercase tracking-[0.2em] text-rops-ember mb-3">
            Questions?
          </div>
          <ul className="font-body text-[13px] space-y-2">
            {CAMP_CONTACTS.map((c) => (
              <li key={c.phone}>
                <span className="text-rops-cream">{c.name}</span>
                <span className="text-rops-taupe">
                  {" "}
                  · {c.role} · <span className="number-tag">{c.phone}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

// ─── REUSABLE PIECES ───────────────────────────────────────────────
function Field({
  label,
  required,
  children,
  help,
  error,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  help?: string;
  error?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="font-body text-[10px] uppercase tracking-[0.18em] text-rops-ink-2">
          {label}
          {required && <span className="text-rops-ember ml-0.5">*</span>}
        </span>
        {help && (
          <span className="font-body text-[10px] text-rops-taupe italic">
            {help}
          </span>
        )}
      </div>
      {children}
      {error && (
        <div className="flex items-center gap-1 mt-1 font-body text-[10px] text-rops-ember">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}
    </label>
  );
}

const inputBase =
  "w-full bg-transparent border-b border-[1.5px] border-rops-line py-2.5 px-0 font-body text-[15px] text-rops-ink placeholder:text-rops-taupe/60 focus:outline-none focus:border-rops-ember transition-colors";

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

function TextAreaInput(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return (
    <textarea
      {...props}
      rows={props.rows ?? 3}
      className={
        "w-full bg-transparent border border-rops-line rounded-sm py-3 px-3 font-body text-[15px] text-rops-ink placeholder:text-rops-taupe/60 focus:outline-none focus:border-rops-ember transition-colors resize-none " +
        (props.className ?? "")
      }
    />
  );
}

function SectionHeader({
  number,
  title,
  sub,
}: {
  number: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="flex items-end gap-4 mb-6 pb-3 border-b border-rops-line">
      <span className="font-display italic text-rops-ember text-3xl leading-none number-tag">
        {number}
      </span>
      <div className="flex-1">
        <h3 className="font-display text-rops-ink text-xl tracking-tight">
          {title}
        </h3>
        {sub && (
          <p className="font-body text-xs text-rops-taupe mt-0.5">{sub}</p>
        )}
      </div>
    </div>
  );
}
