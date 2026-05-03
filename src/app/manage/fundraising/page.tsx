"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { canEditPage } from "@/lib/access-control";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Flame,
  ShoppingBasket,
  CalendarClock,
  Wallet,
  CheckCircle2,
  Cloud,
  CloudOff,
} from "lucide-react";

type Phase = "preparations" | "actualDay";

interface BraaiTask {
  id: string;
  title: string;
  phase: Phase;
  procurementByNkisu: boolean;
}

interface TaskState {
  assignee: string;
  budget: string;
  notes: string;
  done: boolean;
}

interface PlanDoc {
  tasks: Record<string, TaskState>;
  updatedAt: Date | null;
  updatedByName: string | null;
}

const PLAN_COLLECTION = "fundraisingPlans";
const PLAN_ID = "sunday-braai";
const SAVE_DEBOUNCE_MS = 600;

const SUNDAY_BRAAI_TASKS: BraaiTask[] = [
  // Preparations (procurement mainly done by Nkisu)
  {
    id: "prep-chicken",
    phase: "preparations",
    title: "Cutting and marinating chicken",
    procurementByNkisu: true,
  },
  {
    id: "prep-potatoes",
    phase: "preparations",
    title: "Peeling and cutting potatoes",
    procurementByNkisu: true,
  },
  {
    id: "prep-veg",
    phase: "preparations",
    title: "Cutting/grating cabbage, capsicums and carrots",
    procurementByNkisu: true,
  },
  {
    id: "prep-drinks",
    phase: "preparations",
    title: "Buying and refrigerating drinks",
    procurementByNkisu: true,
  },
  // Actual day
  {
    id: "day-fire",
    phase: "actualDay",
    title: "Starting fire",
    procurementByNkisu: false,
  },
  {
    id: "day-organize",
    phase: "actualDay",
    title: "Organize braai area",
    procurementByNkisu: false,
  },
  {
    id: "day-chips",
    phase: "actualDay",
    title: "Frying chips",
    procurementByNkisu: false,
  },
  {
    id: "day-braai",
    phase: "actualDay",
    title: "Braaiing",
    procurementByNkisu: false,
  },
  {
    id: "day-salads",
    phase: "actualDay",
    title: "Mixing salads",
    procurementByNkisu: false,
  },
  {
    id: "day-sales-orders",
    phase: "actualDay",
    title: "Sales — taking orders and ensuring availability",
    procurementByNkisu: false,
  },
  {
    id: "day-sales-serving",
    phase: "actualDay",
    title: "Sales — serving food",
    procurementByNkisu: false,
  },
  {
    id: "day-sales-money",
    phase: "actualDay",
    title: "Sales — receiving money (cash / mobile money)",
    procurementByNkisu: false,
  },
  {
    id: "day-cleanup",
    phase: "actualDay",
    title: "Packing and clean-up (includes washing dishes)",
    procurementByNkisu: false,
  },
];

function defaultTaskMap(): Record<string, TaskState> {
  const map: Record<string, TaskState> = {};
  for (const t of SUNDAY_BRAAI_TASKS) {
    map[t.id] = { assignee: "", budget: "", notes: "", done: false };
  }
  return map;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function FundraisingPage() {
  const { firebaseUser, userData } = useAuth();
  const { pagePermissions, loading: acLoading } = useAccessControl();
  const { toast } = useToast();

  const [tasks, setTasks] = useState<Record<string, TaskState>>(defaultTaskMap);
  const [meta, setMeta] = useState<{
    updatedAt: Date | null;
    updatedByName: string | null;
  }>({ updatedAt: null, updatedByName: null });
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks the latest local edits so the debounced save flushes the freshest
  // values rather than a stale snapshot captured at the time of the keystroke.
  const pendingTasksRef = useRef<Record<string, TaskState>>(tasks);
  // Ignore the snapshot triggered by our own write so it doesn't blow away
  // text the user has typed since.
  const localEditAtRef = useRef<number>(0);

  const canEdit = useMemo(() => {
    if (!userData) return false;
    return canEditPage("fundraising", userData.role, pagePermissions);
  }, [userData, pagePermissions]);

  // Subscribe to the shared plan document
  useEffect(() => {
    if (!firebaseUser) return;
    const ref = doc(db, PLAN_COLLECTION, PLAN_ID);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        // Skip remote echoes of our own pending edits to avoid clobbering
        // characters the user has typed in the last few hundred ms.
        if (Date.now() - localEditAtRef.current < SAVE_DEBOUNCE_MS * 2) {
          if (!loaded) setLoaded(true);
          return;
        }

        if (!snap.exists()) {
          // No plan yet — surface the defaults so the team can start editing.
          const fresh = defaultTaskMap();
          setTasks(fresh);
          pendingTasksRef.current = fresh;
          setMeta({ updatedAt: null, updatedByName: null });
        } else {
          const data = snap.data() as Partial<PlanDoc> & {
            updatedAt?: Timestamp | null;
          };
          const merged = defaultTaskMap();
          const remoteTasks = data.tasks ?? {};
          for (const id of Object.keys(merged)) {
            if (remoteTasks[id]) {
              merged[id] = { ...merged[id], ...remoteTasks[id] };
            }
          }
          setTasks(merged);
          pendingTasksRef.current = merged;
          setMeta({
            updatedAt: data.updatedAt?.toDate?.() ?? null,
            updatedByName: data.updatedByName ?? null,
          });
        }
        setLoaded(true);
      },
      (err) => {
        console.error("Failed to load fundraising plan:", err);
        toast({
          title: "Couldn't load plan",
          description: err.message,
          variant: "destructive",
        });
        setLoaded(true);
      }
    );

    return () => unsub();
    // toast/loaded intentionally excluded — stable refs / one-shot guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser]);

  const flushSave = useCallback(async () => {
    if (!firebaseUser || !userData) return;
    setSaveStatus("saving");
    try {
      await setDoc(
        doc(db, PLAN_COLLECTION, PLAN_ID),
        {
          tasks: pendingTasksRef.current,
          updatedAt: serverTimestamp(),
          updatedById: firebaseUser.uid,
          updatedByName: userData.name,
        },
        { merge: true }
      );
      setSaveStatus("saved");
    } catch (err) {
      console.error("Failed to save fundraising plan:", err);
      setSaveStatus("error");
      toast({
        title: "Couldn't save changes",
        description:
          err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  }, [firebaseUser, userData, toast]);

  const scheduleSave = useCallback(() => {
    localEditAtRef.current = Date.now();
    setSaveStatus("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      flushSave();
    }, SAVE_DEBOUNCE_MS);
  }, [flushSave]);

  // Flush pending saves on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        flushSave();
      }
    };
  }, [flushSave]);

  const updateTask = useCallback(
    (id: string, patch: Partial<TaskState>) => {
      if (!canEdit) return;
      setTasks((prev) => {
        const next = { ...prev, [id]: { ...prev[id], ...patch } };
        pendingTasksRef.current = next;
        return next;
      });
      scheduleSave();
    },
    [canEdit, scheduleSave]
  );

  const resetPlan = async () => {
    if (!canEdit || !firebaseUser || !userData) return;
    if (
      !window.confirm(
        "Reset the Sunday Braai plan? This will clear all assignees, budgets, and notes for everyone."
      )
    ) {
      return;
    }
    const fresh = defaultTaskMap();
    pendingTasksRef.current = fresh;
    setTasks(fresh);
    localEditAtRef.current = Date.now();
    setSaveStatus("saving");
    try {
      await setDoc(doc(db, PLAN_COLLECTION, PLAN_ID), {
        tasks: fresh,
        updatedAt: serverTimestamp(),
        updatedById: firebaseUser.uid,
        updatedByName: userData.name,
      });
      setSaveStatus("saved");
    } catch (err) {
      console.error("Failed to reset plan:", err);
      setSaveStatus("error");
      toast({
        title: "Couldn't reset plan",
        description:
          err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const prepTasks = SUNDAY_BRAAI_TASKS.filter((t) => t.phase === "preparations");
  const dayTasks = SUNDAY_BRAAI_TASKS.filter((t) => t.phase === "actualDay");

  const stats = useMemo(() => {
    const total = SUNDAY_BRAAI_TASKS.length;
    const done = SUNDAY_BRAAI_TASKS.filter((t) => tasks[t.id]?.done).length;
    const assigned = SUNDAY_BRAAI_TASKS.filter(
      (t) => tasks[t.id]?.assignee?.trim()
    ).length;
    const totalBudget = SUNDAY_BRAAI_TASKS.reduce((sum, t) => {
      const v = parseFloat(tasks[t.id]?.budget || "");
      return Number.isFinite(v) ? sum + v : sum;
    }, 0);
    return { total, done, assigned, totalBudget };
  }, [tasks]);

  const completionPercent =
    stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  if (!loaded || acLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-700">
            Fundraising
          </h1>
          <p className="text-clay-500 mt-1">
            Planning hub for the fundraising team — assign responsibilities,
            track budgets, and coordinate the day.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <SaveStatusPill status={saveStatus} canEdit={canEdit} />
          <Badge variant="gold">Planning Team</Badge>
        </div>
      </div>

      {!canEdit && (
        <Card className="border-clay-200 bg-clay-50">
          <CardContent className="p-4 text-sm text-clay-600">
            You have view-only access to this plan. Contact a planning team
            lead if you need to make changes.
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="braai" className="space-y-4">
        <TabsList>
          <TabsTrigger value="braai">
            <Flame className="mr-1 h-4 w-4" />
            Sunday Braai
          </TabsTrigger>
        </TabsList>

        <TabsContent value="braai" className="space-y-6">
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/20">
                    <CheckCircle2 className="h-5 w-5 text-gold-dark" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-clay-700">
                      {stats.done}/{stats.total}
                    </p>
                    <p className="text-xs text-clay-500">Tasks Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-clay-100">
                    <CalendarClock className="h-5 w-5 text-clay-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-clay-700">
                      {stats.assigned}/{stats.total}
                    </p>
                    <p className="text-xs text-clay-500">Tasks Assigned</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                    <Wallet className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-clay-700">
                      {stats.totalBudget.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    <p className="text-xs text-clay-500">Total Allocated</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <p className="text-xs text-clay-500">Plan Readiness</p>
                  <Progress value={completionPercent} className="h-2" />
                  <p className="text-sm font-medium text-clay-700">
                    {completionPercent}% complete
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Procurement note */}
          <Card className="border-gold/30 bg-gold/5">
            <CardContent className="p-4 text-sm text-clay-600">
              <strong className="text-clay-700">Procurement:</strong>{" "}
              mainly done by <strong>Nkisu</strong>. Persons responsible for
              specific preparation tasks will be allocated a set amount to
              purchase what they need — record the allocation in the budget
              field for each task.
            </CardContent>
          </Card>

          {/* Preparations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBasket className="h-5 w-5 text-gold-dark" />
                Preparations
              </CardTitle>
              <CardDescription>
                Tasks to complete before the braai day.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {prepTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  state={tasks[task.id]}
                  onChange={(patch) => updateTask(task.id, patch)}
                  disabled={!canEdit}
                />
              ))}
            </CardContent>
          </Card>

          {/* Actual day */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-gold-dark" />
                Actual Day
              </CardTitle>
              <CardDescription>
                Roles and responsibilities for Sunday.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dayTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  state={tasks[task.id]}
                  onChange={(patch) => updateTask(task.id, patch)}
                  disabled={!canEdit}
                  hideBudget
                />
              ))}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-clay-400">
              {meta.updatedAt
                ? `Last updated ${format(meta.updatedAt, "MMM d, yyyy 'at' HH:mm")}${
                    meta.updatedByName ? ` by ${meta.updatedByName}` : ""
                  }`
                : "No changes saved yet."}
            </p>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={resetPlan}>
                Reset Plan
              </Button>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface TaskRowProps {
  task: BraaiTask;
  state: TaskState | undefined;
  onChange: (patch: Partial<TaskState>) => void;
  disabled?: boolean;
  hideBudget?: boolean;
}

function TaskRow({ task, state, onChange, disabled, hideBudget }: TaskRowProps) {
  const value = state ?? { assignee: "", budget: "", notes: "", done: false };

  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        value.done
          ? "border-green-200 bg-green-50/40"
          : "border-clay-200 bg-cream"
      }`}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={value.done}
          onCheckedChange={(checked) => onChange({ done: checked === true })}
          className="mt-1"
          disabled={disabled}
          aria-label={`Mark ${task.title} complete`}
        />
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={`font-medium text-clay-700 ${
                value.done ? "line-through text-clay-400" : ""
              }`}
            >
              {task.title}
            </p>
            {task.procurementByNkisu && (
              <Badge variant="secondary" className="text-[10px]">
                Procurement: Nkisu
              </Badge>
            )}
          </div>
          <div
            className={`grid gap-3 ${
              hideBudget ? "sm:grid-cols-2" : "sm:grid-cols-3"
            }`}
          >
            <div className="space-y-1">
              <Label
                htmlFor={`${task.id}-assignee`}
                className="text-xs text-clay-500"
              >
                Assigned to
              </Label>
              <Input
                id={`${task.id}-assignee`}
                value={value.assignee}
                onChange={(e) => onChange({ assignee: e.target.value })}
                placeholder="Name"
                disabled={disabled}
              />
            </div>
            {!hideBudget && (
              <div className="space-y-1">
                <Label
                  htmlFor={`${task.id}-budget`}
                  className="text-xs text-clay-500"
                >
                  Allocated amount
                </Label>
                <Input
                  id={`${task.id}-budget`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={value.budget}
                  onChange={(e) => onChange({ budget: e.target.value })}
                  placeholder="0.00"
                  disabled={disabled}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label
                htmlFor={`${task.id}-notes`}
                className="text-xs text-clay-500"
              >
                Notes
              </Label>
              <Input
                id={`${task.id}-notes`}
                value={value.notes}
                onChange={(e) => onChange({ notes: e.target.value })}
                placeholder="Optional"
                disabled={disabled}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveStatusPill({
  status,
  canEdit,
}: {
  status: SaveStatus;
  canEdit: boolean;
}) {
  if (!canEdit) return null;
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-clay-500">
        <LoadingSpinner size="sm" />
        Saving…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-700">
        <Cloud className="h-3 w-3" />
        Saved
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-600">
        <CloudOff className="h-3 w-3" />
        Save failed
      </span>
    );
  }
  return null;
}
