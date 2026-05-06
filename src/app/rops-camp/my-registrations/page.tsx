"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Flame,
  RefreshCw,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { CAMPS } from "@/lib/camps";
import { PaymentInstructionsCard } from "@/components/rops-camp/PaymentInstructionsCard";
import { RopsFontStyles } from "@/components/rops-camp/RopsFontStyles";

const camp = CAMPS[0];

interface MyRegistration {
  id: string;
  campId: string;
  firstName: string;
  lastName: string;
  parentEmail: string | null;
  paymentStatus: "UNPAID" | "PAID" | "REFUNDED";
  paymentAmount: number | null;
  paymentMarkedAt: string | null;
  createdAt: string;
}

export default function MyRegistrationsPage() {
  const { firebaseUser, userData, loading: authLoading } = useAuth();
  const router = useRouter();
  const [registrations, setRegistrations] = useState<MyRegistration[] | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/camp-registrations/mine");
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to load (${res.status})`);
      }
      const json = await res.json();
      setRegistrations(json.registrations as MyRegistration[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && firebaseUser) {
      load();
    }
  }, [authLoading, firebaseUser]);

  const greeting = userData?.name?.split(/\s+/)[0] || null;

  return (
    <div className="font-body bg-rops-cream min-h-screen text-rops-ink">
      <RopsFontStyles />

      <header className="bg-rops-cream rops-grain border-b border-rops-line">
        <div className="max-w-4xl mx-auto px-6 md:px-10 py-6 flex items-center justify-between">
          <Link
            href="/rops-camp"
            className="font-body text-[11px] uppercase tracking-[0.2em] text-rops-taupe hover:text-rops-ink flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft size={12} /> Back to camp page
          </Link>
          <div className="flex items-center gap-2.5">
            <Flame
              size={18}
              className="text-rops-ember flame-flicker"
              fill="currentColor"
            />
            <span className="font-display italic text-sm tracking-wide text-rops-ink">
              ROPs X · 2026
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 md:px-10 py-16 md:py-20">
        {authLoading ? (
          <CenteredMessage text="Checking sign-in…" />
        ) : !firebaseUser ? (
          <SignedOutPanel onSignIn={() => router.push(
            `/login?redirect=${encodeURIComponent("/rops-camp/my-registrations")}`
          )} />
        ) : (
          <>
            <div className="mb-10">
              <div className="font-body text-[11px] uppercase tracking-[0.22em] text-rops-ember mb-3">
                My Registrations
              </div>
              <h1 className="font-display text-rops-ink text-4xl md:text-5xl tracking-tight">
                {greeting ? (
                  <>
                    Welcome back,
                    <span className="italic"> {greeting}.</span>
                  </>
                ) : (
                  <>
                    Your <span className="italic">registrations.</span>
                  </>
                )}
              </h1>
              <p className="font-body text-rops-ink-2 mt-3 max-w-xl">
                Every camper you&rsquo;ve registered, with the same payment
                details we sent at submission.
              </p>
            </div>

            {loading && registrations === null ? (
              <CenteredMessage text="Loading your registrations…" />
            ) : error ? (
              <div className="bg-rops-ember/5 border border-rops-ember/30 rounded-sm p-6">
                <div className="font-body text-sm text-rops-ember mb-3">
                  {error}
                </div>
                <button
                  onClick={load}
                  className="inline-flex items-center gap-2 font-body text-[12px] uppercase tracking-[0.18em] text-rops-ink hover:text-rops-ember transition-colors"
                >
                  <RefreshCw size={14} /> Try again
                </button>
              </div>
            ) : registrations && registrations.length === 0 ? (
              <EmptyState />
            ) : registrations ? (
              <ul className="space-y-8">
                {registrations.map((r) => (
                  <li key={r.id}>
                    <RegistrationCard reg={r} />
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-12 pt-8 border-t border-rops-line flex flex-wrap items-center gap-4">
              <Link
                href="/rops-camp"
                className="inline-flex items-center gap-2 bg-rops-ink text-rops-cream py-3 px-6 rounded-full font-body text-[12px] uppercase tracking-[0.18em] hover:bg-rops-ember transition-colors"
              >
                Register another camper
                <ArrowRight size={14} />
              </Link>
              {registrations !== null && (
                <button
                  onClick={load}
                  disabled={loading}
                  className="inline-flex items-center gap-2 font-body text-[12px] uppercase tracking-[0.18em] text-rops-ink-2 hover:text-rops-ember disabled:opacity-50 transition-colors"
                >
                  <RefreshCw size={14} /> {loading ? "Refreshing…" : "Refresh"}
                </button>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function RegistrationCard({ reg }: { reg: MyRegistration }) {
  const fullName = `${reg.firstName} ${reg.lastName}`.trim();
  const submitted = (() => {
    try {
      return format(parseISO(reg.createdAt), "MMM d, yyyy");
    } catch {
      return null;
    }
  })();

  return (
    <article className="bg-rops-cream-2 border border-rops-line rounded-sm p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="font-body text-[10px] uppercase tracking-[0.2em] text-rops-taupe mb-1">
            Camper
          </div>
          <div className="font-display text-rops-ink text-2xl md:text-3xl tracking-tight">
            {fullName}
          </div>
          {submitted && (
            <div className="mt-1.5 font-body text-xs text-rops-taupe inline-flex items-center gap-1.5">
              <CalendarDays size={12} /> Submitted {submitted}
            </div>
          )}
        </div>
        <PaymentBadge status={reg.paymentStatus} />
      </div>

      {reg.paymentStatus === "PAID" ? (
        <div className="bg-rops-cream border border-rops-line rounded-sm p-5 font-body text-sm text-rops-ink-2 leading-relaxed">
          We&rsquo;ve received your payment for {reg.firstName}. See you in
          camp!
        </div>
      ) : (
        <PaymentInstructionsCard
          registrationId={reg.id}
          amount={reg.paymentAmount ?? camp.fee}
          currency={camp.currency}
          camperName={fullName}
        />
      )}
    </article>
  );
}

function PaymentBadge({ status }: { status: MyRegistration["paymentStatus"] }) {
  if (status === "PAID") {
    return (
      <span className="inline-flex items-center gap-1.5 bg-rops-forest text-rops-cream rounded-full px-3 py-1 font-body text-[11px] uppercase tracking-[0.18em]">
        <CheckCircle2 size={12} /> Paid
      </span>
    );
  }
  if (status === "REFUNDED") {
    return (
      <span className="inline-flex items-center gap-1.5 bg-rops-taupe text-rops-cream rounded-full px-3 py-1 font-body text-[11px] uppercase tracking-[0.18em]">
        Refunded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 bg-rops-ember text-rops-cream rounded-full px-3 py-1 font-body text-[11px] uppercase tracking-[0.18em]">
      <Clock size={12} /> Awaiting payment
    </span>
  );
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <div className="py-20 text-center font-body text-rops-taupe">{text}</div>
  );
}

function EmptyState() {
  return (
    <div className="bg-rops-cream-2 border border-rops-line rounded-sm p-10 text-center">
      <div className="font-display italic text-rops-ink text-2xl mb-2">
        Nothing here yet.
      </div>
      <p className="font-body text-rops-ink-2 mb-6">
        Once you submit a registration on the camp page, it will appear here
        with your payment details.
      </p>
      <Link
        href="/rops-camp"
        className="inline-flex items-center gap-2 bg-rops-ink text-rops-cream py-3 px-6 rounded-full font-body text-[12px] uppercase tracking-[0.18em] hover:bg-rops-ember transition-colors"
      >
        Go to camp page
        <ArrowRight size={14} />
      </Link>
    </div>
  );
}

function SignedOutPanel({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="max-w-lg mx-auto text-center py-16">
      <Flame
        size={28}
        className="text-rops-ember flame-flicker mx-auto mb-6"
        fill="currentColor"
      />
      <div className="font-body text-[11px] uppercase tracking-[0.22em] text-rops-ember mb-3">
        Sign in to view status
      </div>
      <h1 className="font-display text-rops-ink text-3xl md:text-4xl tracking-tight mb-4">
        Track your <span className="italic">registrations.</span>
      </h1>
      <p className="font-body text-rops-ink-2 mb-8 leading-relaxed">
        Sign in (or create an account using the same email you used at
        registration) to see everyone you&rsquo;ve registered and their
        payment details.
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <button
          onClick={onSignIn}
          className="inline-flex items-center gap-2 bg-rops-ink text-rops-cream py-3.5 px-7 rounded-full font-body text-[13px] uppercase tracking-[0.18em] hover:bg-rops-ember transition-colors"
        >
          Sign in
          <ArrowRight size={14} />
        </button>
        <Link
          href={`/register?next=${encodeURIComponent(
            "/rops-camp/my-registrations"
          )}`}
          className="font-body text-[12px] uppercase tracking-[0.18em] text-rops-ink-2 hover:text-rops-ember transition-colors"
        >
          Or create an account →
        </Link>
      </div>
    </div>
  );
}
