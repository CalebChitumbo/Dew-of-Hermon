"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  Flame,
  ShoppingBasket,
  CalendarClock,
  Wallet,
  CheckCircle2,
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

const STORAGE_KEY = "fundraising:sunday-braai:v1";

function defaultState(): Record<string, TaskState> {
  const map: Record<string, TaskState> = {};
  for (const t of SUNDAY_BRAAI_TASKS) {
    map[t.id] = { assignee: "", budget: "", notes: "", done: false };
  }
  return map;
}

export default function FundraisingPage() {
  const [taskState, setTaskState] = useState<Record<string, TaskState>>(
    defaultState
  );
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, TaskState>;
        setTaskState((prev) => {
          const merged = { ...prev };
          for (const id of Object.keys(parsed)) {
            if (merged[id]) merged[id] = { ...merged[id], ...parsed[id] };
          }
          return merged;
        });
      }
    } catch (err) {
      console.error("Failed to load fundraising plan:", err);
    }
    setHydrated(true);
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(taskState));
    } catch (err) {
      console.error("Failed to save fundraising plan:", err);
    }
  }, [taskState, hydrated]);

  const updateTask = (id: string, patch: Partial<TaskState>) => {
    setTaskState((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const prepTasks = SUNDAY_BRAAI_TASKS.filter((t) => t.phase === "preparations");
  const dayTasks = SUNDAY_BRAAI_TASKS.filter((t) => t.phase === "actualDay");

  const stats = useMemo(() => {
    const total = SUNDAY_BRAAI_TASKS.length;
    const done = SUNDAY_BRAAI_TASKS.filter(
      (t) => taskState[t.id]?.done
    ).length;
    const assigned = SUNDAY_BRAAI_TASKS.filter(
      (t) => taskState[t.id]?.assignee?.trim()
    ).length;
    const totalBudget = SUNDAY_BRAAI_TASKS.reduce((sum, t) => {
      const v = parseFloat(taskState[t.id]?.budget || "");
      return Number.isFinite(v) ? sum + v : sum;
    }, 0);
    return { total, done, assigned, totalBudget };
  }, [taskState]);

  const completionPercent =
    stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  const resetPlan = () => {
    if (
      typeof window !== "undefined" &&
      window.confirm(
        "Reset the Sunday Braai plan? This will clear all assignees, budgets, and notes."
      )
    ) {
      setTaskState(defaultState());
    }
  };

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
        <Badge variant="gold" className="self-start sm:self-auto">
          Planning Team
        </Badge>
      </div>

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
                  state={taskState[task.id]}
                  onChange={(patch) => updateTask(task.id, patch)}
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
                  state={taskState[task.id]}
                  onChange={(patch) => updateTask(task.id, patch)}
                  hideBudget
                />
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={resetPlan}>
              Reset Plan
            </Button>
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
  hideBudget?: boolean;
}

function TaskRow({ task, state, onChange, hideBudget }: TaskRowProps) {
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
          onCheckedChange={(checked) =>
            onChange({ done: checked === true })
          }
          className="mt-1"
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
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
