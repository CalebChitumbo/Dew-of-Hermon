"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { format, parseISO } from "date-fns";
import {
  AlarmClock,
  CheckCircle2,
  Clock,
  DoorOpen,
  QrCode,
  ShieldCheck,
  X,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

/**
 * The camper/guardian side of the exit-pass workflow.
 *
 * Shows where a request has reached in the chain (Admissions → Camp Manager →
 * Chairperson) and, once the Chairperson has approved, renders the QR gate pass
 * in-app so it can't be lost with the email. The same pass is scanned out and
 * back in; after the return scan it stops working.
 */

export interface MyPass {
  id: string;
  registrationId: string;
  camperName: string;
  camperFirstName: string | null;
  reason: string;
  destination: string | null;
  expectedReturnAt: string | null;
  status:
    | "PENDING_ADMISSIONS"
    | "PENDING_MANAGER"
    | "PENDING_CHAIR"
    | "APPROVED"
    | "OUT"
    | "RETURNED"
    | "REJECTED"
    | "CANCELLED";
  rejectedStage: "ADMISSIONS" | "MANAGER" | "CHAIR" | null;
  admissionsComments: string | null;
  managerComments: string | null;
  chairComments: string | null;
  passCode: string | null;
  checkedOutAt: string | null;
  checkedInAt: string | null;
  returnedLate: boolean;
  createdAt: string | null;
}

const STAGE_TEXT: Record<string, string> = {
  PENDING_ADMISSIONS: "With Admissions",
  PENDING_MANAGER: "With the Camp Manager",
  PENDING_CHAIR: "With the Chairperson",
};

const LIVE_STATUSES = [
  "PENDING_ADMISSIONS",
  "PENDING_MANAGER",
  "PENDING_CHAIR",
  "APPROVED",
  "OUT",
];

function formatCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, "$1-");
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "EEE d MMM, HH:mm");
  } catch {
    return "—";
  }
}

/** Two hours from now, in the datetime-local input format. */
function defaultReturnValue(): string {
  const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function ExitPassPanel({
  registrationId,
  camperFirstName,
  passes,
  onChanged,
}: {
  registrationId: string;
  camperFirstName: string;
  passes: MyPass[];
  onChanged: () => void;
}) {
  const [formOpen, setFormOpen] = useState(false);

  const live = passes.find((p) => LIVE_STATUSES.includes(p.status)) ?? null;
  const lastClosed = passes.find(
    (p) => p.status === "REJECTED" || p.status === "RETURNED" || p.status === "CANCELLED"
  );

  return (
    <div className="mt-6 border-t border-rops-line pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="font-body text-[10px] uppercase tracking-[0.2em] text-rops-taupe mb-1">
            Leaving camp
          </div>
          <p className="font-body text-sm text-rops-ink-2 max-w-md leading-relaxed">
            Need to step out of camp? Admissions, the Camp Manager, and the
            Chairperson all sign off, then we email a gate pass.
          </p>
        </div>
        {!live && !formOpen && (
          <button
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-2 bg-rops-ink text-rops-cream py-2.5 px-5 rounded-full font-body text-[11px] uppercase tracking-[0.18em] hover:bg-rops-ember transition-colors"
          >
            <DoorOpen size={13} /> Request to leave camp
          </button>
        )}
      </div>

      {formOpen && !live && (
        <RequestForm
          registrationId={registrationId}
          onClose={() => setFormOpen(false)}
          onCreated={() => {
            setFormOpen(false);
            onChanged();
          }}
        />
      )}

      {live && (
        <LivePass pass={live} camperFirstName={camperFirstName} onChanged={onChanged} />
      )}

      {!live && lastClosed && (
        <div className="bg-rops-cream border border-rops-line rounded-sm p-4 font-body text-xs text-rops-ink-2 leading-relaxed">
          {lastClosed.status === "REJECTED" ? (
            <>
              Your last request ({lastClosed.reason}) was declined
              {lastClosed.rejectedStage
                ? ` at the ${
                    lastClosed.rejectedStage === "ADMISSIONS"
                      ? "Admissions"
                      : lastClosed.rejectedStage === "MANAGER"
                        ? "Camp Manager"
                        : "Chairperson"
                  } stage`
                : ""}
              .
              {lastClosed.chairComments ||
              lastClosed.managerComments ||
              lastClosed.admissionsComments
                ? ` Note: ${
                    lastClosed.chairComments ??
                    lastClosed.managerComments ??
                    lastClosed.admissionsComments
                  }`
                : ""}
            </>
          ) : lastClosed.status === "RETURNED" ? (
            <>
              {camperFirstName} was signed back into camp on{" "}
              {fmt(lastClosed.checkedInAt)}. That pass is now used up — a new trip
              out needs a fresh approval.
            </>
          ) : (
            <>Your last exit pass was cancelled.</>
          )}
        </div>
      )}
    </div>
  );
}

function LivePass({
  pass,
  camperFirstName,
  onChanged,
}: {
  pass: MyPass;
  camperFirstName: string;
  onChanged: () => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!pass.passCode) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    const gateUrl = `${window.location.origin}/manage/rops-camp/gate?pass=${pass.passCode}`;
    QRCode.toDataURL(gateUrl, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#16110D", light: "#FFFFFF" },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        // QR render failed — the printed code below still works at the gate
      });
    return () => {
      cancelled = true;
    };
  }, [pass.passCode]);

  const cancel = async () => {
    setCancelling(true);
    try {
      await fetchWithAuth(`/api/camp-passes/${pass.id}/decision`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CANCEL" }),
      });
      onChanged();
    } finally {
      setCancelling(false);
    }
  };

  const pending = STAGE_TEXT[pass.status];
  const out = pass.status === "OUT";
  const overdue =
    out && !!pass.expectedReturnAt && parseISO(pass.expectedReturnAt).getTime() < Date.now();

  // Still in the approval chain — no QR exists yet, by design.
  if (pending) {
    return (
      <div className="bg-rops-cream-2 border border-rops-line rounded-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} className="text-rops-ember" />
          <span className="font-body text-[11px] uppercase tracking-[0.18em] text-rops-ember">
            {pending}
          </span>
        </div>
        <p className="font-body text-sm text-rops-ink-2 leading-relaxed">
          Your request for {camperFirstName} to leave camp ({pass.reason}) is in
          approval. You&rsquo;ll get the gate pass by email as soon as the
          Chairperson approves — nothing can be scanned at the gate before then.
        </p>
        <div className="mt-3 font-body text-xs text-rops-taupe">
          Expected back: {fmt(pass.expectedReturnAt)}
        </div>
        <button
          onClick={cancel}
          disabled={cancelling}
          className="mt-4 inline-flex items-center gap-1.5 font-body text-[11px] uppercase tracking-[0.16em] text-rops-taupe hover:text-rops-ember disabled:opacity-50 transition-colors"
        >
          <X size={12} /> {cancelling ? "Cancelling…" : "Cancel request"}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-rops-ink rounded-sm p-6 text-center">
      <div className="flex items-center justify-center gap-2 mb-4">
        <QrCode size={14} className="text-rops-ember" />
        <span className="font-body text-[10px] uppercase tracking-[0.2em] text-rops-ember">
          Exit pass · show at the gate
        </span>
      </div>

      {out ? (
        <div
          className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-body text-[11px] uppercase tracking-[0.18em] mb-4 ${
            overdue
              ? "bg-rops-ember text-rops-cream"
              : "bg-rops-cream/15 text-rops-cream"
          }`}
        >
          {overdue ? <AlarmClock size={13} /> : <DoorOpen size={13} />}
          {overdue ? "Out of camp · overdue" : "Currently out of camp"}
        </div>
      ) : (
        <div className="inline-flex items-center gap-2 bg-rops-forest text-rops-cream rounded-full px-4 py-1.5 font-body text-[11px] uppercase tracking-[0.18em] mb-4">
          <ShieldCheck size={13} /> Approved by the Chairperson
        </div>
      )}

      {qrDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qrDataUrl}
          alt={`Exit pass QR code for ${pass.camperName}`}
          className="mx-auto w-44 h-44 rounded-sm bg-white p-2"
        />
      ) : (
        <div className="mx-auto w-44 h-44 rounded-sm bg-rops-ink-2 animate-pulse" />
      )}

      {pass.passCode && (
        <div className="mt-4 font-body text-rops-cream tracking-[0.15em] text-base number-tag">
          {formatCode(pass.passCode)}
        </div>
      )}

      <p className="mt-3 font-body text-[11px] text-rops-taupe leading-relaxed">
        {out ? (
          <>
            Scan this same pass at the gate when {camperFirstName} returns.
            <br />
            Expected back: {fmt(pass.expectedReturnAt)}
          </>
        ) : (
          <>
            The guard scans this once on the way out and once on the way back in.
            <br />
            After the return scan it expires — copies won&rsquo;t work.
          </>
        )}
      </p>

      {!out && (
        <button
          onClick={cancel}
          disabled={cancelling}
          className="mt-4 inline-flex items-center gap-1.5 font-body text-[11px] uppercase tracking-[0.16em] text-rops-taupe hover:text-rops-ember disabled:opacity-50 transition-colors"
        >
          <X size={12} /> {cancelling ? "Cancelling…" : "Cancel this pass"}
        </button>
      )}
    </div>
  );
}

function RequestForm({
  registrationId,
  onClose,
  onCreated,
}: {
  registrationId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [reason, setReason] = useState("");
  const [destination, setDestination] = useState("");
  const [escortName, setEscortName] = useState("");
  const [escortPhone, setEscortPhone] = useState("");
  const [expectedReturn, setExpectedReturn] = useState(defaultReturnValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setError("Please give a reason for leaving camp.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/camp-passes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationId,
          reason: reason.trim(),
          destination: destination.trim() || null,
          escortName: escortName.trim() || null,
          escortPhone: escortPhone.trim() || null,
          expectedReturnAt: new Date(expectedReturn).toISOString(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't send the request");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the request");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full bg-rops-cream border border-rops-line rounded-sm px-3 py-2.5 font-body text-sm text-rops-ink placeholder:text-rops-taupe focus:outline-none focus:border-rops-ember transition-colors";
  const labelClass =
    "block font-body text-[10px] uppercase tracking-[0.18em] text-rops-taupe mb-1.5";

  return (
    <form
      onSubmit={submit}
      className="bg-rops-cream-2 border border-rops-line rounded-sm p-5 space-y-4"
    >
      <div>
        <label className={labelClass} htmlFor="exit-reason">
          Reason for leaving camp
        </label>
        <textarea
          id="exit-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="e.g. Hospital appointment with my guardian"
          className={inputClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="exit-return">
            Expected back at camp
          </label>
          <input
            id="exit-return"
            type="datetime-local"
            value={expectedReturn}
            onChange={(e) => setExpectedReturn(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="exit-destination">
            Destination (optional)
          </label>
          <input
            id="exit-destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="exit-escort">
            Collected by (optional)
          </label>
          <input
            id="exit-escort"
            value={escortName}
            onChange={(e) => setEscortName(e.target.value)}
            placeholder="Guardian or escort"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="exit-escort-phone">
            Escort phone (optional)
          </label>
          <input
            id="exit-escort-phone"
            value={escortPhone}
            onChange={(e) => setEscortPhone(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {error && <p className="font-body text-xs text-rops-ember">{error}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 bg-rops-ink text-rops-cream py-2.5 px-5 rounded-full font-body text-[11px] uppercase tracking-[0.18em] hover:bg-rops-ember disabled:opacity-50 transition-colors"
        >
          <CheckCircle2 size={13} /> {saving ? "Sending…" : "Send request"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="font-body text-[11px] uppercase tracking-[0.16em] text-rops-taupe hover:text-rops-ember transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
