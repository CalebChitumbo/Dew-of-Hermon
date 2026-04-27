"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { onSnapshot } from "firebase/firestore";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  Lightbulb,
  Music,
  RotateCcw,
  Save,
  ShieldAlert,
} from "lucide-react";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import type { Department } from "@/types";

import { ProgressBar } from "./components/ProgressBar";
import { ResumeDraftDialog } from "./components/ResumeDraftDialog";
import { SongSuggestionsTab } from "./components/SongSuggestionsTab";
import { StepCycleOverview } from "./components/StepCycleOverview";
import { StepFirstSunday } from "./components/StepFirstSunday";
import { StepSecondSunday } from "./components/StepSecondSunday";
import { StepUniforms } from "./components/StepUniforms";
import { StepRehearsals } from "./components/StepRehearsals";
import { StepScripturePrayer } from "./components/StepScripturePrayer";
import { StepSignOff } from "./components/StepSignOff";
import { useLatreouDraft } from "./lib/use-latreou-draft";
import { STEP_LABELS, TOTAL_STEPS } from "./lib/types";

const WORSHIP_DEPT_NAME = "Worship & Music";

function formatSavedAt(iso: string | null): string {
  if (!iso) return "Not saved yet";
  try {
    return `Saved ${format(parseISO(iso), "HH:mm:ss")}`;
  } catch {
    return "Saved";
  }
}

export default function LatreouPage() {
  const { userData } = useAuth();
  const { loading: acLoading } = useAccessControl();
  const { checkFeatureAccess } = usePermissions();
  const { toast } = useToast();

  const [worshipDeptId, setWorshipDeptId] = useState<string | null>(null);
  const [deptLoading, setDeptLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const {
    cycle,
    patchCycle,
    hasStoredDraft,
    storedSavedAt,
    resumeDraft,
    startFresh,
    saveNow,
    reset,
    lastSavedAt,
    hasDecided,
  } = useLatreouDraft();

  useEffect(() => {
    const unsub = onSnapshot(
      safeCollection("departments"),
      (snapshot) => {
        const depts = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Department[];
        const worship = depts.find((d) => d.name === WORSHIP_DEPT_NAME);
        setWorshipDeptId(worship?.id ?? null);
        setDeptLoading(false);
      },
      (err) => {
        console.error("Failed to load departments for Latreou gate", err);
        setDeptLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const hasAccess = useMemo(() => {
    if (!userData) return false;
    if (userData.role === "SUPER_ADMIN" || userData.role === "ADMIN") return true;
    if (!worshipDeptId) return false;
    return checkFeatureAccess(
      "latreou_access",
      userData.departmentIds,
      userData.leadsDepartmentIds,
      { [WORSHIP_DEPT_NAME]: worshipDeptId }
    );
  }, [userData, worshipDeptId, checkFeatureAccess]);

  const isLead = useMemo(() => {
    if (!userData) return false;
    if (userData.role === "SUPER_ADMIN" || userData.role === "ADMIN") return true;
    if (!worshipDeptId) return false;
    return userData.leadsDepartmentIds?.includes(worshipDeptId) ?? false;
  }, [userData, worshipDeptId]);

  if (!userData || acLoading || deptLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <Card className="mx-auto mt-12 max-w-xl">
        <CardHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-clay-100">
            <ShieldAlert className="h-6 w-6 text-clay-700" />
          </div>
          <CardTitle>Access restricted</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-clay-500">
            Latreou is the worship cycle planner — it&apos;s only available to
            members of the {WORSHIP_DEPT_NAME} department. If you should have
            access, ask an admin to add you to the department.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleSaveDraft = () => {
    const savedAt = saveNow();
    if (savedAt) {
      toast({
        title: "Draft saved",
        description: "Your cycle is saved on this browser.",
      });
    } else {
      toast({
        title: "Couldn't save draft",
        description:
          "Your browser may be blocking storage (private mode or quota).",
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    reset();
    setStep(0);
    setResetConfirmOpen(false);
    toast({
      title: "Form reset",
      description: "All fields have been cleared.",
    });
  };

  const goPrev = () => setStep((s) => Math.max(0, s - 1));
  const goNext = () => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));

  const renderStep = () => {
    switch (step) {
      case 0:
        return <StepCycleOverview cycle={cycle} onPatch={patchCycle} />;
      case 1:
        return (
          <StepFirstSunday
            cycle={cycle}
            onPatch={patchCycle}
            canPickSuggestions={isLead}
          />
        );
      case 2:
        return (
          <StepSecondSunday
            cycle={cycle}
            onPatch={patchCycle}
            canPickSuggestions={isLead}
          />
        );
      case 3:
        return <StepUniforms cycle={cycle} onPatch={patchCycle} />;
      case 4:
        return <StepRehearsals cycle={cycle} onPatch={patchCycle} />;
      case 5:
        return <StepScripturePrayer cycle={cycle} onPatch={patchCycle} />;
      case 6:
        return <StepSignOff cycle={cycle} />;
      default:
        return null;
    }
  };

  const docPrep = (
    <div className="space-y-6">
      <ResumeDraftDialog
        open={hasStoredDraft && !hasDecided}
        savedAt={storedSavedAt}
        onResume={resumeDraft}
        onStartFresh={startFresh}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-clay-500">
          Walk through every section to assemble the cycle document.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-clay-500">
            {formatSavedAt(lastSavedAt)}
          </span>
          <Button variant="outline" size="sm" onClick={handleSaveDraft}>
            <Save className="mr-1 h-4 w-4" />
            Save draft
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setResetConfirmOpen(true)}
            className="text-clay-500 hover:text-red-600"
          >
            <RotateCcw className="mr-1 h-4 w-4" />
            Reset form
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-clay-200 bg-white p-4 md:p-6">
        <ProgressBar currentStep={step} onSelect={setStep} />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-clay-500">
          Step {step + 1} of {TOTAL_STEPS}
        </p>
        <h2 className="font-display text-2xl text-clay-700 sm:hidden">
          {STEP_LABELS[step]}
        </h2>
      </div>

      <div>{renderStep()}</div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="outline"
          onClick={goPrev}
          disabled={step === 0}
          className="w-full sm:w-auto"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Previous
        </Button>
        <Button
          onClick={goNext}
          disabled={step === TOTAL_STEPS - 1}
          className="w-full sm:w-auto"
        >
          Next
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset the entire form?</DialogTitle>
            <DialogDescription>
              This clears every step and removes the saved draft on this
              browser. You can&apos;t undo this.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReset}>
              Reset everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gold/15 text-gold-dark">
            <Music className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-3xl text-clay-700">Latreou</h1>
            <p className="text-sm text-clay-500">
              Suggest songs for the team and{isLead ? " " : " — leads "}
              {isLead
                ? "prepare the two-Sunday worship cycle document."
                : "prepare the cycle document."}
            </p>
          </div>
        </div>
      </header>

      {isLead ? (
        <Tabs defaultValue="suggestions">
          <TabsList>
            <TabsTrigger value="suggestions">
              <Lightbulb className="mr-1 h-4 w-4" />
              Song suggestions
            </TabsTrigger>
            <TabsTrigger value="document">
              <ClipboardList className="mr-1 h-4 w-4" />
              Document preparation
            </TabsTrigger>
          </TabsList>
          <TabsContent value="suggestions" className="mt-6">
            <SongSuggestionsTab isLead={isLead} />
          </TabsContent>
          <TabsContent value="document" className="mt-6">
            {docPrep}
          </TabsContent>
        </Tabs>
      ) : (
        <SongSuggestionsTab isLead={isLead} />
      )}
    </div>
  );
}
