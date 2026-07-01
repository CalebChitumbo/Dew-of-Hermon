"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { hasMinRole } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

interface Preview {
  recipientCount: number;
  totalItems: number;
}

/**
 * Admin/Chair tool: nudge every leader and manager who has something awaiting
 * their action. Each responsible person is emailed a personalised digest of
 * exactly what's waiting on them (join requests for their department, food /
 * media / transport / approval requests tied to their role, etc.) — computed
 * with the same gating as the sidebar "pending" badges.
 *
 * The card only appears when there is actually something pending to nudge.
 */
export function PendingRemindersCard() {
  const { userData } = useAuth();
  const { toast } = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [sending, setSending] = useState(false);

  const isAdmin = userData ? hasMinRole(userData.role, "ADMIN") : false;

  const loadPreview = useCallback(async () => {
    try {
      const res = await fetch("/api/pending-reminders", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as Preview;
      setPreview(data);
    } catch {
      /* network hiccup — leave the card hidden */
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadPreview();
  }, [isAdmin, loadPreview]);

  const handleRemind = useCallback(async () => {
    setSending(true);
    try {
      const res = await fetch("/api/pending-reminders", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send reminders");
      }

      if (data.sent > 0) {
        toast({
          title: "Reminders sent",
          description: `Nudged ${data.sent} leader${data.sent === 1 ? "" : "s"} about what's waiting for their attention.`,
          variant: "success",
        });
      } else if (data.skippedCooldown > 0) {
        toast({
          title: "Already reminded recently",
          description:
            "Everyone with pending items was reminded in the last few hours. Try again later.",
        });
      } else {
        toast({
          title: "No reminders sent",
          description:
            data.message || "Nothing is currently waiting on any leader.",
        });
      }

      if (data.noEmail > 0) {
        toast({
          title: "Some leaders have no email",
          description: `${data.noEmail} leader${data.noEmail === 1 ? "" : "s"} could not be emailed — no address on file.`,
          variant: "destructive",
        });
      }

      // Refresh the preview so the count reflects the new cooldown state.
      loadPreview();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }, [toast, loadPreview]);

  // Only admins see it, and only when something is actually pending.
  if (!isAdmin || !preview || preview.recipientCount === 0) return null;

  const { recipientCount, totalItems } = preview;

  return (
    <Card className="border-clay-100/70 bg-cream/40">
      <CardContent className="pt-4 pb-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <BellRing className="h-5 w-5 text-clay-500 flex-shrink-0" />
        <div className="flex-1 text-sm text-clay-700">
          <p className="font-semibold">
            {totalItems} item{totalItems === 1 ? "" : "s"} waiting on{" "}
            {recipientCount} leader{recipientCount === 1 ? "" : "s"}
          </p>
          <p className="text-clay-500">
            Send each manager and departmental lead a reminder of what&apos;s
            currently waiting for their attention.
          </p>
        </div>
        <Button
          variant="gold"
          className="gap-2 flex-shrink-0"
          onClick={handleRemind}
          disabled={sending}
        >
          {sending ? (
            <LoadingSpinner size="sm" />
          ) : (
            <BellRing className="h-4 w-4" />
          )}
          Remind leaders
        </Button>
      </CardContent>
    </Card>
  );
}
