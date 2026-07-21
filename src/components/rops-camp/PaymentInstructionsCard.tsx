"use client";

import {
  CAMP_PAYMENT_NUMBER,
  buildCampPaymentReference,
} from "@/lib/camps";

interface PaymentInstructionsCardProps {
  registrationId: string;
  amount: number;
  currency?: string;
  camperName: string;
}

const PAYMENT_NUMBER = CAMP_PAYMENT_NUMBER;

export function buildPaymentReference(registrationId: string): string {
  return buildCampPaymentReference(registrationId);
}

export function PaymentInstructionsCard({
  registrationId,
  amount,
  currency = "ZMW",
  camperName,
}: PaymentInstructionsCardProps) {
  const reference = buildPaymentReference(registrationId);

  return (
    <div className="text-left bg-rops-cream-2 border border-rops-line rounded-sm p-6">
      <div className="font-body text-[11px] uppercase tracking-[0.2em] text-rops-ember mb-3">
        Payment Instructions
      </div>
      <div className="grid sm:grid-cols-2 gap-y-3 gap-x-6 font-body text-sm">
        <Row k="Amount" v={`${currency} ${amount.toLocaleString()}`} />
        <Row k="Reference" v={reference} />
        <Row k="Method" v="Mobile Money" />
        <Row k="Send payment & POP to" v={PAYMENT_NUMBER} />
      </div>
      <div className="mt-5 pt-4 border-t border-rops-line font-body text-xs text-rops-taupe leading-relaxed">
        Send your mobile money payment{" "}
        <span className="font-semibold text-rops-ink">and</span> proof of
        payment (POP) to{" "}
        <span className="font-semibold text-rops-ink">{PAYMENT_NUMBER}</span>.
        Include the reference number above so we can match your transaction
        to {camperName}&rsquo;s registration.
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <div className="text-rops-taupe">{k}</div>
      <div className="text-rops-ink font-medium number-tag">{v}</div>
    </>
  );
}
