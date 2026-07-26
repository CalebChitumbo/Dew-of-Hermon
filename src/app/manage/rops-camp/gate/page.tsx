"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import jsQR from "jsqr";
import { format, parseISO } from "date-fns";
import {
  AlarmClock,
  ArrowLeft,
  Ban,
  Camera,
  CameraOff,
  CheckCircle2,
  DoorOpen,
  KeyRound,
  LogIn,
  QrCode,
  RotateCcw,
  ScanLine,
  Search,
  ShieldAlert,
  Ticket,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useToast } from "@/hooks/use-toast";
import { useCampPassAccess } from "@/hooks/useCampPassAccess";
import { cn } from "@/lib/utils";
import { PageLoader, LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyStateLux, luxSurface } from "@/components/shared/lux";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { CampPassStatus } from "@/types";

/**
 * The camp gate.
 *
 * A guard scans the QR on an approved exit pass. The screen says plainly
 * whether the pass is valid and what the scan will do, and one tap commits it:
 * first scan signs the camper out, second scan signs them back in, and any scan
 * after that is refused. The commit is atomic server-side, so a pass that has
 * been photographed, forwarded, or scanned twice cannot get anyone out again.
 */

interface GatePass {
  id: string;
  camperName: string;
  camperFirstName: string | null;
  camperPhone: string | null;
  reason: string;
  destination: string | null;
  escortName: string | null;
  escortPhone: string | null;
  expectedReturnAt: string | null;
  status: CampPassStatus;
  admissionsName: string | null;
  managerName: string | null;
  chairName: string | null;
  checkedOutAt: string | null;
  checkedOutByName: string | null;
  checkedInAt: string | null;
  returnedLate: boolean;
}

interface GateRegistration {
  firstName: string;
  lastName: string;
  gender: string | null;
  phone: string | null;
  churchOrSchool: string | null;
  parentName: string | null;
  parentAltPhone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  checkedIn: boolean;
}

interface Verdict {
  valid: boolean;
  nextAction: "CHECK_OUT" | "CHECK_IN" | null;
  headline: string;
  message: string;
}

interface LookupResult {
  pass: GatePass;
  registration: GateRegistration | null;
  camp: { id: string; name: string } | null;
  verdict: Verdict;
}

const SCAN_INTERVAL_MS = 250;

function fmt(iso: string | null, pattern = "EEE d MMM, HH:mm"): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return "—";
  }
}

export default function GatePage() {
  const { loading, canScanGate, canManageCamp } = useCampPassAccess();
  if (loading) return <PageLoader />;
  if (!canScanGate) {
    return (
      <EmptyStateLux
        icon={ShieldAlert}
        tone="clay"
        title="Access Denied"
        description="You don't have permission to scan camp passes at the gate."
        className="min-h-[60vh] justify-center"
      />
    );
  }
  return (
    <Suspense fallback={<PageLoader />}>
      <GateInner showQueueLink={canManageCamp} />
    </Suspense>
  );
}

function GateInner({ showQueueLink }: { showQueueLink: boolean }) {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const urlPass = searchParams.get("pass");

  const [manualCode, setManualCode] = useState("");
  // The exact payload that resolved — camera scans never touch the input box,
  // so the commit needs its own record of what was scanned.
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [committing, setCommitting] = useState(false);
  const [done, setDone] = useState<{
    action: "CHECK_OUT" | "CHECK_IN";
    camperName: string;
    late: boolean;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastScanRef = useRef(0);
  const lookingRef = useRef(false);
  // Remember the last payload that failed so a QR held in front of the camera
  // doesn't hammer the API every scan tick.
  const lastFailedRef = useRef<{ data: string; at: number } | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  const lookup = useCallback(
    async (rawCode: string) => {
      if (lookingRef.current) return;
      const failed = lastFailedRef.current;
      if (failed && failed.data === rawCode && Date.now() - failed.at < 4000) {
        return;
      }
      lookingRef.current = true;
      setLooking(true);
      setLookupError(null);
      try {
        const res = await fetchWithAuth(
          `/api/camp-passes/lookup?code=${encodeURIComponent(rawCode)}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Lookup failed");
        lastFailedRef.current = null;
        setResult(json as LookupResult);
        setActiveCode(rawCode);
        setDone(null);
        stopCamera();
      } catch (err) {
        lastFailedRef.current = { data: rawCode, at: Date.now() };
        setLookupError(err instanceof Error ? err.message : "Lookup failed — try again");
      } finally {
        lookingRef.current = false;
        setLooking(false);
      }
    },
    [stopCamera]
  );

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();
      setCameraOn(true);

      const tick = (time: number) => {
        rafRef.current = requestAnimationFrame(tick);
        if (time - lastScanRef.current < SCAN_INTERVAL_MS) return;
        lastScanRef.current = time;

        const canvas = canvasRef.current;
        if (!canvas || !video.videoWidth) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qr = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });
        if (qr?.data) lookup(qr.data);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setCameraError(
        "Couldn't open the camera. Allow camera access, or type the pass code below."
      );
    }
  }, [lookup]);

  // Arriving from a scanned QR (?pass=...) → resolve it immediately.
  useEffect(() => {
    if (urlPass) lookup(urlPass);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlPass]);

  useEffect(() => stopCamera, [stopCamera]);

  const commit = async () => {
    if (!result?.verdict.nextAction || !activeCode) return;
    setCommitting(true);
    try {
      const res = await fetchWithAuth("/api/camp-passes/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: activeCode,
          expect: result.verdict.nextAction,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Scan failed");
      setDone({
        action: json.action,
        camperName: result.pass.camperName,
        late: !!json.late,
      });
      setResult(null);
    } catch (err) {
      toast({
        title: "Scan refused",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
      // Re-resolve so the screen shows the pass's real state.
      lastFailedRef.current = null;
      lookup(activeCode);
    } finally {
      setCommitting(false);
    }
  };

  const reset = () => {
    setResult(null);
    setDone(null);
    setLookupError(null);
    setManualCode("");
    setActiveCode(null);
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        icon={ScanLine}
        tone="gold"
        title="Camp gate"
        description="Scan an approved exit pass to sign a camper out of camp, and again to sign them back in."
        actions={
          showQueueLink ? (
            <Link href="/manage/rops-camp/passes">
              <Button variant="outline" className="rounded-xl">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Pass queue
              </Button>
            </Link>
          ) : undefined
        }
      />

      {done ? (
        <DoneCard done={done} onNext={reset} />
      ) : result ? (
        <VerdictCard
          result={result}
          busy={committing}
          onCommit={commit}
          onNext={reset}
        />
      ) : (
        <div className={cn(luxSurface, "space-y-5 p-5 sm:p-6")}>
          <div className="relative overflow-hidden rounded-2xl bg-clay-900">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              playsInline
              muted
              className={cn("aspect-square w-full object-cover", !cameraOn && "hidden")}
            />
            <canvas ref={canvasRef} className="hidden" />
            {cameraOn ? (
              <>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-3/5 w-3/5 rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute bottom-3 right-3 rounded-xl"
                  onClick={stopCamera}
                >
                  <CameraOff className="mr-2 h-4 w-4" />
                  Stop
                </Button>
              </>
            ) : (
              <div className="flex aspect-square w-full flex-col items-center justify-center gap-4 p-6 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10 text-white">
                  <QrCode className="h-8 w-8" />
                </span>
                <p className="max-w-xs text-sm text-white/70">
                  Point the camera at the QR code on the camper&rsquo;s exit pass.
                </p>
                <Button variant="gold" className="rounded-xl" onClick={startCamera}>
                  <Camera className="mr-2 h-4 w-4" />
                  Start scanning
                </Button>
                {cameraError && <p className="text-xs text-amber-300">{cameraError}</p>}
              </div>
            )}
            {looking && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <LoadingSpinner />
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-clay-500">
              <KeyRound className="h-3.5 w-3.5" />
              Or enter the pass code
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (manualCode.trim()) lookup(manualCode);
              }}
            >
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="e.g. ABCD-EFGH-JKMN"
                className="h-11 rounded-xl font-mono uppercase tracking-widest"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
              />
              <Button
                type="submit"
                className="h-11 rounded-xl"
                disabled={looking || !manualCode.trim()}
              >
                <Search className="mr-2 h-4 w-4" />
                Check
              </Button>
            </form>
            {lookupError && <p className="mt-2 text-sm text-red-600">{lookupError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function VerdictCard({
  result,
  busy,
  onCommit,
  onNext,
}: {
  result: LookupResult;
  busy: boolean;
  onCommit: () => void;
  onNext: () => void;
}) {
  const { pass, registration, verdict } = result;
  const valid = verdict.valid;
  const overdue =
    pass.status === "OUT" &&
    !!pass.expectedReturnAt &&
    parseISO(pass.expectedReturnAt).getTime() < Date.now();

  return (
    <div className={cn(luxSurface, "overflow-hidden")}>
      {/* The one thing the guard must read. */}
      <div
        className={cn(
          "flex items-center gap-3 px-5 py-5 sm:px-6",
          valid ? "bg-green-600" : "bg-red-600"
        )}
      >
        {valid ? (
          <CheckCircle2 className="h-8 w-8 shrink-0 text-white" />
        ) : (
          <Ban className="h-8 w-8 shrink-0 text-white" />
        )}
        <div className="text-white">
          <div className="font-display text-xl font-bold leading-tight">
            {verdict.headline}
          </div>
          <div className="mt-0.5 text-sm text-white/90">{verdict.message}</div>
        </div>
      </div>

      {overdue && (
        <div className="flex items-center gap-2 bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white sm:px-6">
          <AlarmClock className="h-4 w-4" />
          Late back — was expected {fmt(pass.expectedReturnAt)}
        </div>
      )}

      {registration && !registration.checkedIn && (
        <div className="flex items-center gap-2 bg-amber-50 px-5 py-2.5 text-sm text-amber-800 sm:px-6">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          This camper is not marked as checked in to camp — confirm with the camp
          team before letting them through.
        </div>
      )}

      <div className="space-y-5 p-5 sm:p-6">
        <div>
          <div className="text-xs uppercase tracking-wider text-clay-500">Camper</div>
          <div className="font-display text-2xl font-bold text-clay-800">
            {pass.camperName}
          </div>
          <div className="mt-1 text-sm text-clay-600">
            {registration?.gender === "MALE"
              ? "Male"
              : registration?.gender === "FEMALE"
                ? "Female"
                : ""}
            {registration?.phone ? ` · ${registration.phone}` : ""}
            {registration?.churchOrSchool ? ` · ${registration.churchOrSchool}` : ""}
          </div>
        </div>

        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          <Detail label="Reason" value={pass.reason} />
          <Detail label="Expected back" value={fmt(pass.expectedReturnAt)} />
          {pass.destination && <Detail label="Destination" value={pass.destination} />}
          {pass.escortName && (
            <Detail
              label="Collected by"
              value={`${pass.escortName}${pass.escortPhone ? ` · ${pass.escortPhone}` : ""}`}
            />
          )}
          {registration?.parentName && (
            <Detail
              label="Guardian"
              value={`${registration.parentName}${
                registration.parentAltPhone ? ` · ${registration.parentAltPhone}` : ""
              }`}
            />
          )}
          {pass.checkedOutAt && (
            <Detail
              label="Signed out"
              value={`${fmt(pass.checkedOutAt, "d MMM, HH:mm")}${
                pass.checkedOutByName ? ` by ${pass.checkedOutByName}` : ""
              }`}
            />
          )}
        </dl>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-cream/70 p-4 text-xs text-clay-600">
          <Badge className="border-0 bg-emerald-50 text-emerald-600">
            Admissions: {pass.admissionsName ?? "—"}
          </Badge>
          <Badge className="border-0 bg-emerald-50 text-emerald-600">
            Camp Manager: {pass.managerName ?? "—"}
          </Badge>
          <Badge className="border-0 bg-emerald-50 text-emerald-600">
            Chairperson: {pass.chairName ?? "—"}
          </Badge>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {valid && verdict.nextAction && (
            <Button
              variant="gold"
              className="h-14 flex-1 rounded-xl text-base"
              onClick={onCommit}
              disabled={busy}
            >
              {verdict.nextAction === "CHECK_OUT" ? (
                <>
                  <DoorOpen className="mr-2 h-5 w-5" />
                  {busy ? "Working…" : "Sign out of camp"}
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-5 w-5" />
                  {busy ? "Working…" : "Sign back into camp"}
                </>
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            className="h-14 rounded-xl"
            onClick={onNext}
            disabled={busy}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Scan next
          </Button>
        </div>
      </div>
    </div>
  );
}

function DoneCard({
  done,
  onNext,
}: {
  done: { action: "CHECK_OUT" | "CHECK_IN"; camperName: string; late: boolean };
  onNext: () => void;
}) {
  const out = done.action === "CHECK_OUT";
  return (
    <div className={cn(luxSurface, "overflow-hidden")}>
      <div
        className={cn(
          "px-5 py-8 text-center sm:px-6",
          out ? "bg-clay-800" : done.late ? "bg-amber-500" : "bg-green-600"
        )}
      >
        <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white/15 text-white">
          {out ? <DoorOpen className="h-8 w-8" /> : <LogIn className="h-8 w-8" />}
        </span>
        <div className="font-display text-2xl font-bold text-white">
          {out ? "Signed out of camp" : "Back in camp"}
        </div>
        <div className="mt-1 text-sm text-white/90">{done.camperName}</div>
        {!out && done.late && (
          <div className="mt-2 text-sm font-semibold text-white">
            Returned later than expected — the camp team has been notified.
          </div>
        )}
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        <p className="flex items-start gap-2 text-sm text-clay-600">
          <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-clay-400" />
          {out
            ? "The same pass must be scanned again when this camper returns. It won't work for anyone else, and it can't be used to leave a second time."
            : "This pass is now spent — it will not scan again. Leaving camp again needs a fresh approval from Admissions, the Camp Manager, and the Chairperson."}
        </p>
        <Button variant="gold" className="h-12 w-full rounded-xl" onClick={onNext}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Scan next pass
        </Button>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-clay-500">{label}</dt>
      <dd className="text-clay-700">{value}</dd>
    </div>
  );
}
