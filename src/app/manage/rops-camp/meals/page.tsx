"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import jsQR from "jsqr";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CameraOff,
  Check,
  CheckCircle2,
  CloudOff,
  HeartHandshake,
  KeyRound,
  RefreshCw,
  Salad,
  Search,
  Undo2,
  UserRound,
  UtensilsCrossed,
  Wifi,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useToast } from "@/hooks/use-toast";
import { useCampMealAccess } from "@/hooks/useCampMealAccess";
import { PageLoader } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyStateLux, luxSurface } from "@/components/shared/lux";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DEFAULT_CAMP_ID } from "@/lib/camps";
import {
  buildMealScanId,
  formatMealCode,
  getCampSittings,
  looksLikeExitPassQr,
  normalizeMealCode,
  resolveCurrentSitting,
} from "@/lib/camp-meals";
import {
  enqueueScan,
  loadQueue,
  loadRoster,
  removeFromQueue,
  saveRoster,
  type CachedCamper,
  type QueuedMealScan,
} from "@/lib/camp-meal-queue";
import type { CampMealSitting } from "@/types";

// Scan the camera feed at most every 250ms — plenty for a hand-held badge
// while keeping CPU cool on cheap phones.
const SCAN_INTERVAL_MS = 250;
// How long a result stays on screen before the line moves on. The camera keeps
// running underneath, so servers never have to tap between campers.
const RESULT_TTL_MS = 3200;
// Ignore the same payload held in front of the lens for this long.
const REPEAT_GUARD_MS = 2500;
// Retry the queue on this cadence while anything is pending.
const FLUSH_INTERVAL_MS = 8000;

type ScanOutcome =
  | "SERVED"
  | "ALREADY_SERVED"
  | "NOT_FOUND"
  | "WRONG_QR"
  | "WRONG_CAMP";

interface ScanResult {
  outcome: ScanOutcome;
  camper: CachedCamper | null;
  message?: string;
  at: number;
}

export default function CampMealsPage() {
  const { loading, canView } = useCampMealAccess();
  if (loading) return <PageLoader />;
  if (!canView) {
    return (
      <EmptyStateLux
        icon={UtensilsCrossed}
        tone="clay"
        title="Access Denied"
        description="You don't have permission to serve camp meals."
        className="min-h-[60vh] justify-center"
      />
    );
  }
  return <MealsInner />;
}

function MealsInner() {
  const { toast } = useToast();
  const campId = DEFAULT_CAMP_ID;
  const sittings = useMemo(() => getCampSittings(campId), [campId]);

  const [sitting, setSitting] = useState<CampMealSitting | null>(null);
  const [campers, setCampers] = useState<CachedCamper[]>([]);
  const [servedIds, setServedIds] = useState<Set<string>>(new Set());
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterStale, setRosterStale] = useState(false);
  /**
   * Which sitting the loaded `campers`/`servedIds` actually belong to. State
   * lands a render after `sitting` changes, so without this the cache-write
   * effect below would file the previous sitting's served list under the new
   * sitting's key — and offline, nothing would ever correct it.
   */
  const [rosterFor, setRosterFor] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueuedMealScan[]>([]);
  const [online, setOnline] = useState(true);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [search, setSearch] = useState("");
  const [showRegister, setShowRegister] = useState(false);

  // Camera plumbing
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastTickRef = useRef(0);
  const lastPayloadRef = useRef<{ data: string; at: number } | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Refs mirror state the scan/flush callbacks need, so neither has to be
  // rebuilt (and the camera loop restarted) on every scan.
  const queueRef = useRef<QueuedMealScan[]>([]);
  const servedRef = useRef<Set<string>>(new Set());
  const campersRef = useRef<CachedCamper[]>([]);
  const sittingRef = useRef<CampMealSitting | null>(null);
  const flushingRef = useRef(false);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    servedRef.current = servedIds;
  }, [servedIds]);
  useEffect(() => {
    campersRef.current = campers;
  }, [campers]);
  useEffect(() => {
    sittingRef.current = sitting;
  }, [sitting]);

  // ── Startup: pick the sitting for right now, restore any pending queue ──

  useEffect(() => {
    setSitting(resolveCurrentSitting(campId, new Date()));
    const restored = loadQueue();
    setQueue(restored);
    queueRef.current = restored;
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
  }, [campId]);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // ── Roster: fetch for the chosen sitting, fall back to the cache ──

  const loadRosterFor = useCallback(
    async (target: CampMealSitting) => {
      const cached = loadRoster(target.id);
      if (cached) {
        setCampers(cached.campers);
        setServedIds(new Set(cached.servedIds));
        setRosterStale(true);
      } else {
        setCampers([]);
        setServedIds(new Set());
      }
      setRosterFor(target.id);

      setRosterLoading(true);
      try {
        const res = await fetchWithAuth(
          `/api/camp-meals/roster?campId=${encodeURIComponent(
            target.campId
          )}&sittingId=${encodeURIComponent(target.id)}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load roster");

        const fresh: CachedCamper[] = json.campers ?? [];
        const served: string[] = (json.scans ?? []).map(
          (s: { registrationId: string }) => s.registrationId
        );
        // Anything still queued locally counts as served — it just hasn't
        // reached the server yet, and the line must not be told to serve
        // that camper a second time.
        const pendingHere = queueRef.current
          .filter((q) => q.sittingId === target.id)
          .map((q) => q.registrationId);

        const merged = new Set([...served, ...pendingHere]);
        setCampers(fresh);
        setServedIds(merged);
        setRosterStale(false);
        saveRoster({
          sittingId: target.id,
          campers: fresh,
          servedIds: Array.from(merged),
          cachedAt: new Date().toISOString(),
        });
      } catch {
        // Offline or the request failed — the cache above is what we serve
        // from. Only complain if there was no cache to fall back to.
        setRosterStale(true);
        if (!cached) {
          toast({
            title: "Couldn't load the roster",
            description:
              "Connect once to download the camper list, then you can scan offline.",
            variant: "destructive",
          });
        }
      } finally {
        setRosterLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    if (sitting) loadRosterFor(sitting);
  }, [sitting, loadRosterFor]);

  // Keep the cached served-list in step as scans land locally. Skipped until
  // the loaded roster is known to be this sitting's, so a sitting switch can't
  // write the previous sitting's list under the new key.
  useEffect(() => {
    if (!sitting || rosterFor !== sitting.id) return;
    saveRoster({
      sittingId: sitting.id,
      campers,
      servedIds: Array.from(servedIds),
      cachedAt: new Date().toISOString(),
    });
  }, [sitting, rosterFor, campers, servedIds]);

  // ── Queue flush ──

  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (queueRef.current.length === 0) return;

    flushingRef.current = true;
    try {
      // Snapshot: items added mid-flush are picked up on the next pass.
      for (const item of [...queueRef.current]) {
        try {
          const res = await fetchWithAuth("/api/camp-meals/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: item.code,
              sittingId: item.sittingId,
              servedAt: item.servedAt,
              queuedOffline: item.offline,
            }),
          });

          // 409 means the server already has this camper down for this
          // sitting — exactly the outcome we wanted, so the item is done.
          if (res.ok || res.status === 409) {
            queueRef.current = removeFromQueue(queueRef.current, item.key);
            setQueue(queueRef.current);
            continue;
          }

          if (res.status >= 400 && res.status < 500) {
            // Permanently unacceptable (bad code, wrong camp, lost access).
            // Retrying forever would wedge the queue, so drop it and say so.
            // The camper stays marked served on this device on purpose: they
            // are holding a plate either way, and un-marking them would put
            // them back in the queue to be served a second time. Refreshing
            // the roster reconciles the device with the server.
            const json = await res.json().catch(() => ({}));
            queueRef.current = removeFromQueue(queueRef.current, item.key);
            setQueue(queueRef.current);
            toast({
              title: `Couldn't record ${item.camperName}`,
              description: json.error || "That scan was rejected.",
              variant: "destructive",
            });
            continue;
          }
          // 5xx — server-side blip. Keep it and try again next pass.
        } catch {
          // Network died mid-flush. Stop here; the rest stay queued.
          break;
        }
      }
    } finally {
      flushingRef.current = false;
    }
  }, [toast]);

  useEffect(() => {
    if (online) flush();
  }, [online, queue.length, flush]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (queueRef.current.length > 0) flush();
    }, FLUSH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [flush]);

  // Warn before closing the tab with scans that never reached the server.
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (queueRef.current.length === 0) return;
      e.preventDefault();
      // Older browsers only show the prompt when returnValue is set.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  // ── Feedback: a serving line is looking at the queue, not the screen ──

  const feedback = useCallback((ok: boolean) => {
    try {
      navigator.vibrate?.(ok ? 60 : [70, 60, 70]);
    } catch {
      // vibration unsupported — the on-screen flash still lands
    }
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = ok ? 880 : 320;
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
      osc.onended = () => ctx.close().catch(() => {});
    } catch {
      // Audio blocked until the first gesture — not worth surfacing
    }
  }, []);

  // ── Serving ──

  const showResult = useCallback((next: Omit<ScanResult, "at">) => {
    setResult({ ...next, at: Date.now() });
  }, []);

  useEffect(() => {
    if (!result) return;
    const id = window.setTimeout(() => setResult(null), RESULT_TTL_MS);
    return () => window.clearTimeout(id);
  }, [result]);

  const serveCamper = useCallback(
    (camper: CachedCamper) => {
      const active = sittingRef.current;
      if (!active || !camper.checkInCode) return;

      if (servedRef.current.has(camper.id)) {
        feedback(false);
        showResult({ outcome: "ALREADY_SERVED", camper });
        return;
      }

      // Optimistic: the line gets its answer now, the write catches up.
      const nextServed = new Set(servedRef.current);
      nextServed.add(camper.id);
      servedRef.current = nextServed;
      setServedIds(nextServed);

      queueRef.current = enqueueScan(queueRef.current, {
        sittingId: active.id,
        registrationId: camper.id,
        code: camper.checkInCode,
        camperName: `${camper.firstName} ${camper.lastName}`.trim(),
        servedAt: new Date().toISOString(),
        offline: typeof navigator !== "undefined" && !navigator.onLine,
      });
      setQueue(queueRef.current);

      feedback(true);
      showResult({ outcome: "SERVED", camper });
      flush();
    },
    [feedback, showResult, flush]
  );

  /**
   * Resolve a scanned or typed payload. Everything is answered from the
   * cached roster first so the line never waits on the network; only a badge
   * the cache doesn't know about falls through to the server, which covers a
   * camper registered after the roster was downloaded.
   */
  const handlePayload = useCallback(
    async (payload: string) => {
      const active = sittingRef.current;
      if (!active) return;

      if (looksLikeExitPassQr(payload)) {
        feedback(false);
        showResult({
          outcome: "WRONG_QR",
          camper: null,
          message:
            "That's an exit pass, not a meal badge. Scan the camper's camp badge.",
        });
        return;
      }

      const code = normalizeMealCode(payload);
      if (!code) {
        feedback(false);
        showResult({
          outcome: "WRONG_QR",
          camper: null,
          message: "That QR code isn't a camper badge.",
        });
        return;
      }

      const local = campersRef.current.find((c) => c.checkInCode === code);
      if (local) {
        serveCamper(local);
        return;
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        feedback(false);
        showResult({
          outcome: "NOT_FOUND",
          camper: null,
          message:
            "Badge not on this device's roster. Reconnect and refresh the roster to pick up recent registrations.",
        });
        return;
      }

      // Unknown locally but we have signal — let the server decide.
      try {
        const res = await fetchWithAuth("/api/camp-meals/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, sittingId: active.id }),
        });
        const json = await res.json();

        if (res.ok) {
          const camper: CachedCamper = json.camper;
          setCampers((prev) =>
            prev.some((c) => c.id === camper.id) ? prev : [...prev, camper]
          );
          const nextServed = new Set(servedRef.current);
          nextServed.add(camper.id);
          servedRef.current = nextServed;
          setServedIds(nextServed);
          feedback(true);
          showResult({ outcome: "SERVED", camper });
          return;
        }

        if (res.status === 409) {
          const camper: CachedCamper | null = json.camper ?? null;
          if (camper) {
            const nextServed = new Set(servedRef.current);
            nextServed.add(camper.id);
            servedRef.current = nextServed;
            setServedIds(nextServed);
          }
          feedback(false);
          showResult({ outcome: "ALREADY_SERVED", camper });
          return;
        }

        feedback(false);
        showResult({
          outcome: res.status === 404 ? "NOT_FOUND" : "WRONG_CAMP",
          camper: null,
          message: json.error || "That badge couldn't be used here.",
        });
      } catch {
        feedback(false);
        showResult({
          outcome: "NOT_FOUND",
          camper: null,
          message: "Badge not recognised and the server is unreachable.",
        });
      }
    },
    [feedback, showResult, serveCamper]
  );

  // ── Camera ──

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

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
        if (time - lastTickRef.current < SCAN_INTERVAL_MS) return;
        lastTickRef.current = time;

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
        if (!qr?.data) return;

        // The same badge stays in frame for a second or two after it's read.
        const last = lastPayloadRef.current;
        if (last && last.data === qr.data && Date.now() - last.at < REPEAT_GUARD_MS) {
          return;
        }
        lastPayloadRef.current = { data: qr.data, at: Date.now() };
        handlePayload(qr.data);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setCameraError(
        "Couldn't open the camera. Allow camera access, or type the badge code below."
      );
    }
  }, [handlePayload]);

  useEffect(() => stopCamera, [stopCamera]);

  // ── Undo ──

  const undoScan = useCallback(
    async (camper: CachedCamper) => {
      const active = sittingRef.current;
      if (!active) return;

      const key = buildMealScanId(active.id, camper.id);
      queueRef.current = removeFromQueue(queueRef.current, key);
      setQueue(queueRef.current);

      const nextServed = new Set(servedRef.current);
      nextServed.delete(camper.id);
      servedRef.current = nextServed;
      setServedIds(nextServed);
      setResult(null);

      try {
        await fetchWithAuth("/api/camp-meals/undo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sittingId: active.id,
            registrationId: camper.id,
          }),
        });
        toast({
          title: "Scan undone",
          description: `${camper.firstName} ${camper.lastName} is back on the list.`,
        });
      } catch {
        toast({
          title: "Undo not synced",
          description:
            "Removed on this device, but the server couldn't be reached. Undo again once you're back online.",
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  // ── Derived ──

  const onSite = useMemo(
    () => campers.filter((c) => c.checkedIn && !c.onPass),
    [campers]
  );
  const servedCount = servedIds.size;
  // Counted over the on-site list rather than as a subtraction: a camper can
  // be served without having been gate-checked-in, and subtracting would then
  // under-report the queue still to come.
  const yetToEat = useMemo(
    () => onSite.filter((c) => !servedIds.has(c.id)),
    [onSite, servedIds]
  );

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return campers
      .filter((c) => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [campers, search]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        icon={UtensilsCrossed}
        tone="gold"
        title="Meal register"
        description="Scan each camper's badge at the serving line."
        actions={
          <Link href="/manage/rops-camp">
            <Button variant="outline" className="rounded-xl">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Camp
            </Button>
          </Link>
        }
      />

      {/* Sitting picker + connection state */}
      <div className={cn(luxSurface, "space-y-4 p-4 sm:p-5")}>
        <div>
          <label
            htmlFor="sitting"
            className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-clay-500"
          >
            <UtensilsCrossed className="h-3.5 w-3.5" />
            Serving now
          </label>
          <select
            id="sitting"
            value={sitting?.id ?? ""}
            onChange={(e) => {
              const next = sittings.find((s) => s.id === e.target.value);
              if (next) setSitting(next);
            }}
            className="h-11 w-full rounded-xl border border-clay-200 bg-white px-3 text-base text-clay-700"
          >
            {sittings.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} · {format(new Date(`${s.date}T12:00:00`), "d MMM")}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className={cn(
              "gap-1.5",
              online
                ? "bg-green-100 text-green-800 hover:bg-green-100"
                : "bg-amber-100 text-amber-900 hover:bg-amber-100"
            )}
          >
            {online ? <Wifi className="h-3 w-3" /> : <CloudOff className="h-3 w-3" />}
            {online ? "Online" : "Offline — scans are saved"}
          </Badge>

          {queue.length > 0 && (
            <Badge className="gap-1.5 bg-clay-100 text-clay-700 hover:bg-clay-100">
              <RefreshCw
                className={cn("h-3 w-3", online && "animate-spin")}
              />
              {queue.length} waiting to sync
            </Badge>
          )}

          {rosterStale && (
            <Badge className="gap-1.5 bg-amber-100 text-amber-900 hover:bg-amber-100">
              <AlertTriangle className="h-3 w-3" />
              Cached roster
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="ml-auto rounded-xl"
            disabled={rosterLoading || !sitting}
            onClick={() => sitting && loadRosterFor(sitting)}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", rosterLoading && "animate-spin")}
            />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Served" value={servedCount} tone="green" />
          <Stat label="Still to eat" value={yetToEat.length} tone="amber" />
          <Stat label="On site" value={onSite.length} tone="clay" />
        </div>
      </div>

      {/* Scanner */}
      <div className={cn(luxSurface, "space-y-5 p-4 sm:p-5")}>
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
              {result && (
                <ScanFlash result={result} onUndo={() => result.camper && undoScan(result.camper)} />
              )}
            </>
          ) : (
            <div className="flex aspect-square w-full flex-col items-center justify-center gap-4 p-6 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10 text-white">
                <UtensilsCrossed className="h-8 w-8" />
              </span>
              <p className="max-w-xs text-sm text-white/70">
                Point the camera at each camper&rsquo;s badge. The scanner keeps
                running — no tapping between campers.
              </p>
              <Button variant="gold" className="rounded-xl" onClick={startCamera}>
                <Camera className="mr-2 h-4 w-4" />
                Start serving
              </Button>
              {cameraError && (
                <p className="text-xs text-amber-300">{cameraError}</p>
              )}
            </div>
          )}
        </div>

        {/* The result also renders below the camera, so it survives the flash
            fading and stays readable on a small screen in daylight. */}
        {result && !cameraOn && (
          <ResultPanel
            result={result}
            onUndo={() => result.camper && undoScan(result.camper)}
          />
        )}

        {/* Fallback 1: type the code */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-clay-500">
            <KeyRound className="h-3.5 w-3.5" />
            Badge damaged? Type the code
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (manualCode.trim()) {
                handlePayload(manualCode);
                setManualCode("");
              }
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
            <Button type="submit" className="h-11 rounded-xl" disabled={!manualCode.trim()}>
              Serve
            </Button>
          </form>
        </div>

        {/* Fallback 2: find them by name */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-clay-500">
            <Search className="h-3.5 w-3.5" />
            Badge lost? Find by name
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Start typing a camper's name"
            className="h-11 rounded-xl"
          />
          {searchResults.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {searchResults.map((c) => {
                const done = servedIds.has(c.id);
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 rounded-xl border border-clay-100 bg-white p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-clay-700">
                        {c.firstName} {c.lastName}
                      </div>
                      <div className="truncate text-xs text-clay-500">
                        {c.churchOrSchool || "—"}
                        {c.checkInCode ? ` · ${formatMealCode(c.checkInCode)}` : ""}
                      </div>
                    </div>
                    {done ? (
                      // The dependable correction path: the scan flash is gone
                      // in a few seconds, but a mis-scan can always be undone
                      // by looking the camper up here.
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                          <Check className="mr-1 h-3 w-3" />
                          Served
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-xl px-2"
                          title={`Undo ${c.firstName}'s meal`}
                          onClick={() => undoScan(c)}
                        >
                          <Undo2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="gold"
                        className="rounded-xl"
                        onClick={() => {
                          serveCamper(c);
                          setSearch("");
                        }}
                      >
                        Serve
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Register */}
      <div className={cn(luxSurface, "p-4 sm:p-5")}>
        <button
          type="button"
          onClick={() => setShowRegister((v) => !v)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="font-display text-lg font-bold text-clay-700">
            Who hasn&rsquo;t eaten yet
          </span>
          <Badge className="bg-clay-100 text-clay-700 hover:bg-clay-100">
            {yetToEat.length}
          </Badge>
        </button>

        {showRegister && (
          <ul className="mt-4 space-y-1.5">
            {onSite
              .filter((c) => !servedIds.has(c.id))
              .map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 rounded-xl border border-clay-100 bg-white p-2.5"
                >
                  <UserRound className="h-4 w-4 shrink-0 text-clay-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-clay-700">
                      {c.firstName} {c.lastName}
                    </div>
                    <div className="truncate text-xs text-clay-500">
                      {c.churchOrSchool || "—"}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => serveCamper(c)}
                  >
                    Serve
                  </Button>
                </li>
              ))}
            {yetToEat.length === 0 && (
              <li className="rounded-xl border border-green-200 bg-green-50 p-4 text-center text-sm text-green-800">
                Everyone on site has been served.
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "amber" | "clay";
}) {
  const tones = {
    green: "bg-green-50 text-green-800 border-green-200",
    amber: "bg-amber-50 text-amber-900 border-amber-200",
    clay: "bg-cream border-clay-200 text-clay-700",
  };
  return (
    <div className={cn("rounded-xl border p-2.5", tones[tone])}>
      <div className="text-xl font-bold leading-none">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-wider opacity-80">
        {label}
      </div>
    </div>
  );
}

/** Food facts that must reach the person holding the serving spoon. */
function DietaryNotes({ camper }: { camper: CachedCamper }) {
  if (!camper.allergies && !camper.dietaryPreference) return null;
  return (
    <div className="space-y-1.5">
      {camper.allergies && (
        <div className="flex items-start gap-2 rounded-xl border-2 border-red-300 bg-red-50 p-2.5 text-left">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div className="text-sm text-red-900">
            <span className="font-bold uppercase tracking-wide">Allergy</span>
            <div className="font-medium">{camper.allergies}</div>
          </div>
        </div>
      )}
      {camper.dietaryPreference && (
        <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-2.5 text-left">
          <Salad className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <div className="text-sm text-sky-900">
            <span className="font-bold uppercase tracking-wide">Diet</span>
            <div className="font-medium">{camper.dietaryPreference}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Full-bleed result over the camera — readable at arm's length. */
function ScanFlash({
  result,
  onUndo,
}: {
  result: ScanResult;
  onUndo: () => void;
}) {
  const ok = result.outcome === "SERVED";
  const already = result.outcome === "ALREADY_SERVED";
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center",
        ok ? "bg-green-600/95" : already ? "bg-amber-500/95" : "bg-red-600/95"
      )}
    >
      <ResultBody result={result} onUndo={onUndo} inverted />
    </div>
  );
}

function ResultPanel({
  result,
  onUndo,
}: {
  result: ScanResult;
  onUndo: () => void;
}) {
  const ok = result.outcome === "SERVED";
  const already = result.outcome === "ALREADY_SERVED";
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl p-5 text-center",
        ok
          ? "bg-green-600"
          : already
          ? "bg-amber-500"
          : "bg-red-600"
      )}
    >
      <ResultBody result={result} onUndo={onUndo} inverted />
    </div>
  );
}

function ResultBody({
  result,
  onUndo,
  inverted,
}: {
  result: ScanResult;
  onUndo: () => void;
  inverted: boolean;
}) {
  const { outcome, camper, message } = result;
  const headline =
    outcome === "SERVED"
      ? "Serve"
      : outcome === "ALREADY_SERVED"
      ? "Already eaten"
      : outcome === "NOT_FOUND"
      ? "Badge not recognised"
      : outcome === "WRONG_CAMP"
      ? "Wrong camp"
      : "Not a meal badge";

  const unpaid =
    camper != null &&
    camper.paymentStatus !== "PAID" &&
    !camper.sponsorshipId;

  return (
    <div className={cn("w-full space-y-3", inverted && "text-white")}>
      <div className="flex items-center justify-center gap-2">
        {outcome === "SERVED" ? (
          <CheckCircle2 className="h-8 w-8" />
        ) : (
          <AlertTriangle className="h-8 w-8" />
        )}
        <span className="font-display text-2xl font-bold">{headline}</span>
      </div>

      {camper && (
        <div>
          <div className="font-display text-xl font-bold leading-tight">
            {camper.firstName} {camper.lastName}
          </div>
          {camper.churchOrSchool && (
            <div className="text-sm opacity-85">{camper.churchOrSchool}</div>
          )}
        </div>
      )}

      {message && <p className="text-sm opacity-90">{message}</p>}

      {camper && <DietaryNotes camper={camper} />}

      {unpaid && (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-black/25 px-3 py-2 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4" />
          Not paid — served anyway, flagged for the manager
        </div>
      )}

      {camper?.sponsorshipId && (
        <div className="flex items-center justify-center gap-1.5 text-xs opacity-85">
          <HeartHandshake className="h-3.5 w-3.5" />
          Sponsored by {camper.sponsorName ?? "a sponsor"}
        </div>
      )}

      {camper?.onPass && (
        <div className="text-xs font-semibold opacity-90">
          Signed out of camp on an exit pass
        </div>
      )}

      {outcome === "SERVED" && camper && (
        <Button
          size="sm"
          variant="secondary"
          className="rounded-xl"
          onClick={onUndo}
        >
          <Undo2 className="mr-2 h-4 w-4" />
          Undo — wrong camper
        </Button>
      )}
    </div>
  );
}
