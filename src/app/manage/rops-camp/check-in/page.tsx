"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import jsQR from "jsqr";
import { format } from "date-fns";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useToast } from "@/hooks/use-toast";
import { useCampLeadAccess } from "@/hooks/useCampLeadAccess";
import { PageLoader, LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyStateLux, luxSurface } from "@/components/shared/lux";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock,
  HeartHandshake,
  KeyRound,
  QrCode,
  RotateCcw,
  ScanLine,
  Search,
  Tent,
  Undo2,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CampPaymentStatus } from "@/types";

interface LookupRegistration {
  id: string;
  campId: string;
  firstName: string;
  lastName: string;
  gender: "MALE" | "FEMALE";
  phone: string;
  churchOrSchool: string;
  parentName: string | null;
  paymentStatus: CampPaymentStatus;
  paymentAmount: number | null;
  sponsorshipId: string | null;
  sponsorName: string | null;
  checkedIn: boolean;
  checkedInAt: string | null;
  checkedInByName: string | null;
  createdAt: string;
}

interface LookupCamp {
  id: string;
  name: string;
  fee: number;
  currency: string;
}

// Scan the camera feed at most every 250ms — plenty for a hand-held QR
// while keeping CPU cool on cheap phones.
const SCAN_INTERVAL_MS = 250;

export default function CheckInPage() {
  const { loading, canManage } = useCampLeadAccess();
  if (loading) return <PageLoader />;
  if (!canManage) {
    return (
      <EmptyStateLux
        icon={Tent}
        tone="clay"
        title="Access Denied"
        description="You don't have permission to check campers in."
        className="min-h-[60vh] justify-center"
      />
    );
  }
  return (
    <Suspense fallback={<PageLoader />}>
      <CheckInInner />
    </Suspense>
  );
}

function CheckInInner() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const urlCode = searchParams.get("code");

  const [manualCode, setManualCode] = useState("");
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    registration: LookupRegistration;
    camp: LookupCamp | null;
  } | null>(null);
  const [checkInBusy, setCheckInBusy] = useState(false);

  // Camera / scanner state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastScanRef = useRef(0);
  const lookingRef = useRef(false);
  // Remember the last payload that failed lookup so a QR held in front of
  // the camera doesn't hammer the API every scan tick.
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
          `/api/camp-registrations/lookup?code=${encodeURIComponent(rawCode)}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Lookup failed");
        lastFailedRef.current = null;
        setResult(json);
        stopCamera();
      } catch (err) {
        lastFailedRef.current = { data: rawCode, at: Date.now() };
        setLookupError(
          err instanceof Error ? err.message : "Lookup failed — try again"
        );
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
        if (qr?.data) {
          lookup(qr.data);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setCameraError(
        "Couldn't open the camera. Allow camera access, or type the code below."
      );
    }
  }, [lookup]);

  // Arriving via a scanned QR URL (?code=...) → look it up immediately.
  useEffect(() => {
    if (urlCode) lookup(urlCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCode]);

  useEffect(() => stopCamera, [stopCamera]);

  const toggleCheckIn = async (nextCheckedIn: boolean) => {
    if (!result) return;
    setCheckInBusy(true);
    try {
      const res = await fetchWithAuth(
        `/api/camp-registrations/${result.registration.id}/check-in`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkedIn: nextCheckedIn }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setResult({ ...result, registration: json.registration });
      toast({
        title: nextCheckedIn ? "Checked in ✓" : "Check-in undone",
        description: `${json.registration.firstName} ${json.registration.lastName}`,
      });
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setCheckInBusy(false);
    }
  };

  const reset = () => {
    setResult(null);
    setLookupError(null);
    setManualCode("");
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        icon={ScanLine}
        tone="gold"
        title="Camp check-in"
        description="Scan a camper's QR pass to see their payment status and check them in."
        actions={
          <Link href="/manage/rops-camp">
            <Button variant="outline" className="rounded-xl">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Registrations
            </Button>
          </Link>
        }
      />

      {result ? (
        <ResultCard
          registration={result.registration}
          camp={result.camp}
          busy={checkInBusy}
          onCheckIn={() => toggleCheckIn(true)}
          onUndo={() => toggleCheckIn(false)}
          onNext={reset}
        />
      ) : (
        <div className={cn(luxSurface, "p-5 sm:p-6 space-y-5")}>
          {/* Camera scanner */}
          <div className="relative overflow-hidden rounded-2xl bg-clay-900">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              playsInline
              muted
              className={cn(
                "aspect-square w-full object-cover",
                !cameraOn && "hidden"
              )}
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
                  Point the camera at the QR code from the camper&rsquo;s
                  registration email.
                </p>
                <Button variant="gold" className="rounded-xl" onClick={startCamera}>
                  <Camera className="mr-2 h-4 w-4" />
                  Start scanning
                </Button>
                {cameraError && (
                  <p className="text-xs text-amber-300">{cameraError}</p>
                )}
              </div>
            )}
            {looking && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <LoadingSpinner />
              </div>
            )}
          </div>

          {/* Manual entry */}
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
                Find
              </Button>
            </form>
            {lookupError && (
              <p className="mt-2 text-sm text-red-600">{lookupError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultCard({
  registration: reg,
  camp,
  busy,
  onCheckIn,
  onUndo,
  onNext,
}: {
  registration: LookupRegistration;
  camp: LookupCamp | null;
  busy: boolean;
  onCheckIn: () => void;
  onUndo: () => void;
  onNext: () => void;
}) {
  const paid = reg.paymentStatus === "PAID";
  const sponsored = !!reg.sponsorshipId;
  const covered = paid || sponsored;

  return (
    <div className={cn(luxSurface, "overflow-hidden")}>
      {/* Payment banner — the first thing the gate team needs to see */}
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-5 py-4 sm:px-6",
          covered ? "bg-green-600" : "bg-amber-500"
        )}
      >
        <div className="flex items-center gap-2.5 text-white">
          {covered ? (
            <CheckCircle2 className="h-6 w-6" />
          ) : (
            <Clock className="h-6 w-6" />
          )}
          <div>
            <div className="text-base font-bold leading-tight">
              {paid
                ? "Paid"
                : sponsored
                ? "Sponsored"
                : reg.paymentStatus === "REFUNDED"
                ? "Refunded"
                : "Not paid"}
            </div>
            <div className="text-xs text-white/85">
              {paid
                ? `${camp?.currency ?? "ZMW"} ${(reg.paymentAmount ?? camp?.fee ?? 0).toLocaleString()} received`
                : sponsored
                ? `Slot covered by ${reg.sponsorName ?? "a sponsor"}`
                : reg.paymentStatus === "REFUNDED"
                ? "Payment was refunded — confirm before admitting"
                : "Collect payment or confirm with the camp treasurer"}
            </div>
          </div>
        </div>
        {sponsored && paid && (
          <Badge className="shrink-0 bg-white/20 text-white hover:bg-white/20">
            <HeartHandshake className="mr-1 h-3 w-3" />
            Sponsored
          </Badge>
        )}
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div>
          <div className="text-xs uppercase tracking-wider text-clay-500">Camper</div>
          <div className="font-display text-2xl font-bold text-clay-800">
            {reg.firstName} {reg.lastName}
          </div>
          <div className="mt-1 text-sm text-clay-600">
            {reg.gender === "MALE" ? "Male" : "Female"} · {reg.phone}
            {reg.churchOrSchool ? ` · ${reg.churchOrSchool}` : ""}
          </div>
          {reg.parentName && (
            <div className="text-sm text-clay-500">
              Parent/guardian: {reg.parentName}
            </div>
          )}
          {camp && (
            <div className="mt-1 text-xs text-clay-500">{camp.name}</div>
          )}
        </div>

        {reg.checkedIn ? (
          <div className="flex items-start gap-2.5 rounded-2xl border border-green-200 bg-green-50 p-4">
            <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <div className="text-sm text-green-800">
              <span className="font-semibold">Already checked in</span>
              {reg.checkedInAt && (
                <> · {format(new Date(reg.checkedInAt), "MMM d, HH:mm")}</>
              )}
              {reg.checkedInByName && <> by {reg.checkedInByName}</>}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          {reg.checkedIn ? (
            <Button
              variant="outline"
              className="h-12 flex-1 rounded-xl"
              onClick={onUndo}
              disabled={busy}
            >
              <Undo2 className="mr-2 h-4 w-4" />
              {busy ? "Working..." : "Undo check-in"}
            </Button>
          ) : (
            <Button
              variant="gold"
              className="h-12 flex-1 rounded-xl text-base"
              onClick={onCheckIn}
              disabled={busy}
            >
              <UserCheck className="mr-2 h-5 w-5" />
              {busy ? "Checking in..." : "Check in to camp"}
            </Button>
          )}
          <Button
            variant="ghost"
            className="h-12 rounded-xl"
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
