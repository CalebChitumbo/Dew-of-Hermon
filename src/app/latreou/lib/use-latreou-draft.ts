"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LatreouCycle, Song, SundayPlan } from "./types";
import { createEmptyCycle } from "./empty-cycle";

const STORAGE_KEY = "latreou:draft:v1";
const DEBOUNCE_MS = 500;

type DraftEnvelope = {
  savedAt: string;
  cycle: LatreouCycle;
};

// Drafts saved before the praise/worship rename used `session1`/`session2`.
// Carry those over so an in-progress draft doesn't lose its songs.
type LegacySundayPlan = Partial<SundayPlan> & {
  session1?: Song[];
  session2?: Song[];
};

function migrateSundayPlan(raw: LegacySundayPlan | undefined): SundayPlan {
  return {
    date: raw?.date ?? "",
    praise: raw?.praise ?? raw?.session1 ?? [],
    worship: raw?.worship ?? raw?.session2 ?? [],
    specialItem: raw?.specialItem ?? { title: "", responsible: "", link: "" },
  };
}

function readStoredDraft(): DraftEnvelope | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftEnvelope;
    if (!parsed?.cycle || parsed.cycle.version !== 1) return null;
    return {
      savedAt: parsed.savedAt,
      cycle: {
        ...parsed.cycle,
        firstSunday: migrateSundayPlan(parsed.cycle.firstSunday),
        secondSunday: migrateSundayPlan(parsed.cycle.secondSunday),
      },
    };
  } catch {
    return null;
  }
}

function writeStoredDraft(cycle: LatreouCycle): string | null {
  if (typeof window === "undefined") return null;
  try {
    const savedAt = new Date().toISOString();
    const envelope: DraftEnvelope = { savedAt, cycle };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    return savedAt;
  } catch {
    return null;
  }
}

function clearStoredDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export type UseLatreouDraft = {
  cycle: LatreouCycle;
  setCycle: (updater: LatreouCycle | ((prev: LatreouCycle) => LatreouCycle)) => void;
  patchCycle: (patch: Partial<LatreouCycle>) => void;
  hasStoredDraft: boolean;
  storedSavedAt: string | null;
  resumeDraft: () => void;
  startFresh: () => void;
  saveNow: () => string | null;
  reset: () => void;
  lastSavedAt: string | null;
  hasDecided: boolean;
};

export function useLatreouDraft(): UseLatreouDraft {
  const [cycle, setCycleState] = useState<LatreouCycle>(() => createEmptyCycle());
  const [stored, setStored] = useState<DraftEnvelope | null>(null);
  const [hasDecided, setHasDecided] = useState(true);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCycleRef = useRef<LatreouCycle | null>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    const existing = readStoredDraft();
    if (existing) {
      setStored(existing);
      setHasDecided(false);
    }
    hasMountedRef.current = true;
  }, []);

  const flushPending = useCallback((): string | null => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const target = pendingCycleRef.current;
    if (!target) return null;
    pendingCycleRef.current = null;
    const savedAt = writeStoredDraft(target);
    if (savedAt) setLastSavedAt(savedAt);
    return savedAt;
  }, []);

  const scheduleSave = useCallback(
    (next: LatreouCycle) => {
      pendingCycleRef.current = next;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        flushPending();
      }, DEBOUNCE_MS);
    },
    [flushPending]
  );

  const setCycle = useCallback(
    (updater: LatreouCycle | ((prev: LatreouCycle) => LatreouCycle)) => {
      setCycleState((prev) => {
        const next = typeof updater === "function" ? (updater as (p: LatreouCycle) => LatreouCycle)(prev) : updater;
        if (hasMountedRef.current) scheduleSave(next);
        return next;
      });
    },
    [scheduleSave]
  );

  const patchCycle = useCallback(
    (patch: Partial<LatreouCycle>) => {
      setCycle((prev) => ({ ...prev, ...patch }));
    },
    [setCycle]
  );

  const resumeDraft = useCallback(() => {
    if (stored) {
      setCycleState(stored.cycle);
      setLastSavedAt(stored.savedAt);
    }
    setHasDecided(true);
  }, [stored]);

  const startFresh = useCallback(() => {
    clearStoredDraft();
    setStored(null);
    setCycleState(createEmptyCycle());
    setLastSavedAt(null);
    setHasDecided(true);
  }, []);

  const saveNow = useCallback((): string | null => {
    const target = pendingCycleRef.current ?? cycle;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    pendingCycleRef.current = null;
    const savedAt = writeStoredDraft(target);
    if (savedAt) setLastSavedAt(savedAt);
    return savedAt;
  }, [cycle]);

  const reset = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    pendingCycleRef.current = null;
    clearStoredDraft();
    setStored(null);
    setCycleState(createEmptyCycle());
    setLastSavedAt(null);
    setHasDecided(true);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (pendingCycleRef.current) {
        writeStoredDraft(pendingCycleRef.current);
      }
    };
  }, []);

  // React cleanup doesn't run on a hard tab close, so also flush any edits
  // still inside the debounce window when the page is being hidden/unloaded.
  useEffect(() => {
    const flushOnExit = () => {
      if (pendingCycleRef.current) {
        writeStoredDraft(pendingCycleRef.current);
        pendingCycleRef.current = null;
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushOnExit();
    };
    window.addEventListener("beforeunload", flushOnExit);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", flushOnExit);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return {
    cycle,
    setCycle,
    patchCycle,
    hasStoredDraft: !!stored,
    storedSavedAt: stored?.savedAt ?? null,
    resumeDraft,
    startFresh,
    saveNow,
    reset,
    lastSavedAt,
    hasDecided,
  };
}
