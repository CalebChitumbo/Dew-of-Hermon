"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Flame } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { RopsFontStyles } from "@/components/rops-camp/RopsFontStyles";

const PENDING_CLAIM_KEY = "ropsPendingClaim";
const MY_REGISTRATIONS = "/rops-camp/my-registrations";

/**
 * Landing page for the "Track this registration" link in the confirmation
 * email. Stashes the claim token (same sessionStorage handshake the
 * post-submission confirmation screen uses — /my-registrations consumes it
 * and links the registration to the account), then routes the visitor to
 * sign-up or straight to their registrations if already signed in.
 */
function TrackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { firebaseUser, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    const rid = searchParams.get("rid");
    const token = searchParams.get("token");
    const email = searchParams.get("email") || "";

    if (rid && token) {
      try {
        window.sessionStorage.setItem(
          PENDING_CLAIM_KEY,
          JSON.stringify({ id: rid, claimToken: token })
        );
      } catch {
        // sessionStorage unavailable — my-registrations still matches by email
      }
    }

    if (firebaseUser) {
      router.replace(MY_REGISTRATIONS);
    } else {
      const params = new URLSearchParams({ next: MY_REGISTRATIONS });
      if (email) params.set("email", email);
      router.replace(`/register?${params.toString()}`);
    }
  }, [loading, firebaseUser, router, searchParams]);

  return (
    <div className="font-body bg-rops-cream min-h-screen text-rops-ink flex items-center justify-center">
      <RopsFontStyles />
      <div className="text-center px-6">
        <Flame
          size={28}
          className="text-rops-ember flame-flicker mx-auto mb-6"
          fill="currentColor"
        />
        <div className="font-body text-[11px] uppercase tracking-[0.22em] text-rops-ember mb-3">
          One moment
        </div>
        <h1 className="font-display text-rops-ink text-3xl tracking-tight">
          Opening your <span className="italic">registration…</span>
        </h1>
      </div>
    </div>
  );
}

export default function TrackRegistrationPage() {
  return (
    <Suspense fallback={null}>
      <TrackInner />
    </Suspense>
  );
}
