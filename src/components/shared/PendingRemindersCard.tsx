"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Mail, MailX } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { hasMinRole } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

interface RecipientPreview {
  id: string;
  name: string;
  itemCount: number;
  items: { label: string; link: string }[];
  hasEmail: boolean;
  onCooldown: boolean;
}

interface Preview {
  recipientCount: number;
  totalItems: number;
  recipients: RecipientPreview[];
}

/**
 * Admin/Chair tool: nudge leaders and managers who have something awaiting
 * their action. Each responsible person can be emailed a personalised digest
 * of exactly what's waiting on them (join requests for their department, food /
 * media / transport / approval requests tied to their role, etc.) — computed
 * with the same gating as the sidebar "pending" badges.
 *
 * Supports reminding everyone at once, or a single leader on their own. The
 * card only appears when there is actually something pending to nudge.
 */
export function PendingRemindersCard() {
  const { userData } = useAuth();
  const { toast } = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  // null = nothing sending; "all" = broadcast; otherwise a recipient id.
  const [sendingKey, setSendingKey] = useState<string | null>(null);

  const isAdmin = userData ? hasMinRole(userData.role, "ADMIN") : false;

  const loadPreview = useCallback(async () => {
    try {
      const res = await fetch("/api/pending-reminders", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as Preview;
      setPreview(data);
    } catch {
      /* network hiccup — leave the card as-is */
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadPreview();
  }, [isAdmin, loadPreview]);

  const sendReminder = useCallback(
    async (userId: string | null) => {
      setSendingKey(userId ?? "all");
      try {
        const res = await fetch("/api/pending-reminders", {
          method: "POST",
          headers: userId ? { "Content-Type": "application/json" } : undefined,
          body: userId ? JSON.stringify({ userId }) : undefined,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to send reminders");
        }

        if (data.sent > 0) {
          toast({
            title: "Reminder sent",
            description: userId
              ? `${data.recipients?.[0] || "The leader"} was reminded of what's waiting for them.`
              : `Nudged ${data.sent} leader${data.sent === 1 ? "" : "s"} about what's waiting for their attention.`,
            variant: "success",
          });
        } else if (data.skippedCooldown > 0) {
          toast({
            title: "Already reminded recently",
            description: userId
              ? "This leader was reminded in the last few hours. Try again later."
              : "Everyone with pending items was reminded in the last few hours. Try again later.",
          });
        } else if (data.noEmail > 0) {
          toast({
            title: "No email on file",
            description:
              "This leader has no email address on file, so no reminder could be sent.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "No reminders sent",
            description:
              data.message || "Nothing is currently waiting on any leader.",
          });
        }

        if (!userId && data.noEmail > 0) {
          toast({
            title: "Some leaders have no email",
            description: `${data.noEmail} leader${data.noEmail === 1 ? "" : "s"} could not be emailed — no address on file.`,
            variant: "destructive",
          });
        }

        // Refresh so counts and cooldown state reflect what was just sent.
        loadPreview();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        toast({ title: "Error", description: msg, variant: "destructive" });
      } finally {
        setSendingKey(null);
      }
    },
    [toast, loadPreview]
  );

  // Only admins see it, and only when something is actually pending.
  if (!isAdmin || !preview || preview.recipientCount === 0) return null;

  const { recipientCount, totalItems, recipients } = preview;
  const busy = sendingKey !== null;

  return (
    <Card className="border-clay-100/70 bg-cream/40">
      <CardContent className="pt-4 pb-4 space-y-3">
        {/* Header + remind-all */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
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
            onClick={() => sendReminder(null)}
            disabled={busy}
          >
            {sendingKey === "all" ? (
              <LoadingSpinner size="sm" />
            ) : (
              <BellRing className="h-4 w-4" />
            )}
            Remind all
          </Button>
        </div>

        {/* Per-leader rows */}
        <ul className="divide-y divide-clay-100/70 rounded-lg border border-clay-100/70 bg-white/60">
          {recipients.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-clay-800 truncate">
                  {r.name}
                  <span className="ml-2 text-xs font-normal text-clay-400">
                    {r.itemCount} item{r.itemCount === 1 ? "" : "s"}
                  </span>
                </p>
                <p className="text-xs text-clay-500 truncate">
                  {r.items.map((i) => i.label).join(" · ")}
                </p>
              </div>
              {r.hasEmail ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 flex-shrink-0"
                  onClick={() => sendReminder(r.id)}
                  disabled={busy || r.onCooldown}
                  title={
                    r.onCooldown
                      ? "Reminded in the last few hours — try again later"
                      : undefined
                  }
                >
                  {sendingKey === r.id ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Mail className="h-3.5 w-3.5" />
                  )}
                  {r.onCooldown ? "Reminded" : "Remind"}
                </Button>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 text-xs text-clay-400 flex-shrink-0"
                  title="No email address on file"
                >
                  <MailX className="h-3.5 w-3.5" />
                  No email
                </span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
