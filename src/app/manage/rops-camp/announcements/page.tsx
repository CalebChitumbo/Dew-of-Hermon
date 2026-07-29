"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CAMPS, DEFAULT_CAMP_ID } from "@/lib/camps";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useToast } from "@/hooks/use-toast";
import { useCampLeadAccess } from "@/hooks/useCampLeadAccess";
import { PageLoader, LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyStateLux, StatCardLux, luxSurface } from "@/components/shared/lux";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import {
  AlertTriangle,
  Copy,
  Eye,
  Mail,
  MailWarning,
  Megaphone,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Tent,
  Users,
} from "lucide-react";
import {
  BROADCAST_AUDIENCES,
  BROADCAST_TOKENS,
  BROADCAST_TOKEN_GROUPS,
  broadcastRecipient,
  buildBroadcastEmail,
  findUnknownBroadcastTokens,
  matchesBroadcastAudience,
  type BroadcastTokenGroup,
} from "@/lib/camp-broadcast-template";
import { cn } from "@/lib/utils";
import type { CampBroadcastAudience, CampBroadcastOutcome } from "@/types";

interface RegistrationRow {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  parentName: string | null;
  parentEmail: string | null;
  churchOrSchool: string;
  tshirtSize: string | null;
  dropoffLocation: "CHURCH" | "CAMPSITE" | null;
  dietaryPreference: string | null;
  paymentStatus: string;
  paymentAmount: number | null;
  sponsorshipId: string | null;
  checkInCode: string | null;
  checkedIn: boolean;
}

interface BroadcastRow {
  id: string;
  subject: string;
  body: string;
  audience: CampBroadcastAudience;
  ctaLabel: string | null;
  ctaUrl: string | null;
  replyTo: string | null;
  sentByName: string;
  sentAt: string;
  recipientCount: number;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
  outcomes: (CampBroadcastOutcome & { reason: string | null })[];
}

/** Loaded into an empty composer so the first announcement is a tweak, not a
 *  blank page — and so the placeholder syntax is obvious on sight. */
const STARTER_BODY = `Hi {{greetingName}},

Camp is almost here — only {{daysToCamp}} days to go until {{campName}} at {{campVenue}}.

A few things for {{firstName}}:

- Arrive at the drop-off point ({{dropoff}}) by 08:00 on {{campStartDate}}.
- Payment status: {{paymentStatus}} (reference {{paymentReference}}).
- Pack a Bible, notebook, warm clothes and toiletries.

Please reply to this email with anything we should know before camp — allergies, medication, or travel arrangements.

See you soon!
The ROPs Camp Team`;

export default function CampAnnouncementsPage() {
  const { loading, canManage } = useCampLeadAccess();
  if (loading) return <PageLoader />;
  if (!canManage) {
    return (
      <EmptyStateLux
        icon={Tent}
        tone="clay"
        title="Access Denied"
        description="You don't have permission to send ROPs Camp announcements."
        className="min-h-[60vh] justify-center"
      />
    );
  }
  return <CampAnnouncementsInner />;
}

function CampAnnouncementsInner() {
  const { toast } = useToast();
  const [campId, setCampId] = useState<string>(DEFAULT_CAMP_ID);
  const camp = useMemo(() => CAMPS.find((c) => c.id === campId)!, [campId]);

  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [history, setHistory] = useState<BroadcastRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(STARTER_BODY);
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [audience, setAudience] = useState<CampBroadcastAudience>("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pickerSearch, setPickerSearch] = useState("");

  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"email" | "text">("email");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{
    sent: number;
    skipped: number;
    failed: number;
    outcomes: CampBroadcastOutcome[];
  } | null>(null);

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [focusTarget, setFocusTarget] = useState<"subject" | "body">("body");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [regRes, histRes] = await Promise.all([
        fetchWithAuth(`/api/camp-registrations?campId=${campId}`),
        fetchWithAuth(`/api/camp-broadcasts?campId=${campId}`),
      ]);
      const regJson = await regRes.json();
      if (!regRes.ok) throw new Error(regJson.error || "Failed to load registrations");
      setRows(regJson.registrations);

      const histJson = await histRes.json();
      if (histRes.ok) setHistory(histJson.broadcasts);
    } catch (err) {
      toast({
        title: "Failed to load campers",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [campId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  /** How many campers each audience would reach, for the labels on the picker. */
  const audienceCounts = useMemo(() => {
    const counts: Partial<Record<CampBroadcastAudience, number>> = {};
    for (const option of BROADCAST_AUDIENCES) {
      counts[option.value] =
        option.value === "SELECTED"
          ? selectedIds.size
          : rows.filter((r) => matchesBroadcastAudience(r, option.value)).length;
    }
    return counts;
  }, [rows, selectedIds]);

  const audienceRows = useMemo(() => {
    if (audience === "SELECTED") return rows.filter((r) => selectedIds.has(r.id));
    return rows.filter((r) => matchesBroadcastAudience(r, audience));
  }, [rows, audience, selectedIds]);

  const recipients = useMemo(
    () => audienceRows.filter((r) => broadcastRecipient(r)),
    [audienceRows]
  );
  const noEmailCount = audienceRows.length - recipients.length;

  // Keep the preview pinned to a camper who is actually in the audience.
  useEffect(() => {
    if (recipients.length === 0) {
      setPreviewId(null);
      return;
    }
    setPreviewId((current) =>
      current && recipients.some((r) => r.id === current) ? current : recipients[0].id
    );
  }, [recipients]);

  const unknownTokens = useMemo(
    () =>
      Array.from(
        new Set([
          ...findUnknownBroadcastTokens(subject),
          ...findUnknownBroadcastTokens(body),
        ])
      ),
    [subject, body]
  );

  const previewRow = useMemo(
    () => recipients.find((r) => r.id === previewId) ?? null,
    [recipients, previewId]
  );

  /** The exact email the mail server will send, rendered with the shared
   *  template engine rather than an approximation of it. */
  const preview = useMemo(() => {
    if (!previewRow) return null;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    try {
      return buildBroadcastEmail(
        {
          registrationId: previewRow.id,
          camper: previewRow,
          camp,
          recipient: broadcastRecipient(previewRow),
          trackUrl: `${origin}/rops-camp/track`,
        },
        { subject, body, ctaLabel, ctaUrl, replyTo }
      );
    } catch {
      return null;
    }
  }, [previewRow, camp, subject, body, ctaLabel, ctaUrl, replyTo]);

  const insertToken = (token: string) => {
    const snippet = `{{${token}}}`;
    if (focusTarget === "subject") {
      const el = subjectRef.current;
      const start = el?.selectionStart ?? subject.length;
      const end = el?.selectionEnd ?? subject.length;
      const next = subject.slice(0, start) + snippet + subject.slice(end);
      setSubject(next);
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(start + snippet.length, start + snippet.length);
      });
      return;
    }
    const el = bodyRef.current;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    const next = body.slice(0, start) + snippet + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canSend =
    !!subject.trim() &&
    !!body.trim() &&
    unknownTokens.length === 0 &&
    recipients.length > 0 &&
    !sending;

  const send = async () => {
    setSending(true);
    try {
      const res = await fetchWithAuth("/api/camp-broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campId,
          subject,
          body,
          audience,
          registrationIds: Array.from(selectedIds),
          ctaLabel: ctaLabel.trim() || null,
          ctaUrl: ctaUrl.trim() || null,
          replyTo: replyTo.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to send");

      setLastResult({
        sent: json.sent,
        skipped: json.skipped,
        failed: json.failed,
        outcomes: json.outcomes ?? [],
      });
      setConfirmOpen(false);
      toast({
        title: `Announcement sent to ${json.sent} camper${json.sent === 1 ? "" : "s"}`,
        description:
          json.failed > 0 || json.skipped > 0
            ? `${json.skipped} skipped (no email), ${json.failed} failed.`
            : "Every camper in the audience got their own personalized copy.",
        variant: json.failed > 0 ? "destructive" : undefined,
      });
      await load();
    } catch (err) {
      toast({
        title: "Send failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const reuse = (broadcast: BroadcastRow) => {
    setSubject(broadcast.subject);
    setBody(broadcast.body);
    setCtaLabel(broadcast.ctaLabel ?? "");
    setCtaUrl(broadcast.ctaUrl ?? "");
    setReplyTo(broadcast.replyTo ?? "");
    setAudience(broadcast.audience === "SELECTED" ? "ALL" : broadcast.audience);
    setLastResult(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast({
      title: "Loaded into the composer",
      description: "Edit it and send again — nothing goes out until you press send.",
    });
  };

  const pickerRows = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.firstName} ${r.lastName} ${r.phone} ${r.email ?? ""} ${r.parentEmail ?? ""} ${r.churchOrSchool}`
        .toLowerCase()
        .includes(q)
    );
  }, [rows, pickerSearch]);

  return (
    <div className="space-y-7">
      <PageHeader
        icon={Megaphone}
        tone="gold"
        backHref="/manage/rops-camp"
        title="Camp announcements"
        description="Type one message with placeholders — every camper gets their own copy, addressed to them by name."
        actions={
          <>
            {CAMPS.length > 1 && (
              <Select value={campId} onValueChange={setCampId}>
                <SelectTrigger className="w-[220px] rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPS.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" className="rounded-xl" onClick={load} disabled={loading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCardLux
          icon={Users}
          tone="teal"
          label="In this audience"
          value={audienceRows.length}
          hint="campers selected"
          accent="bg-teal"
          art={<Users className="h-24 w-24" strokeWidth={1} />}
        />
        <StatCardLux
          icon={Mail}
          tone="emerald"
          label="Reachable"
          value={recipients.length}
          hint="have an email address"
          accent="bg-green-500"
          art={<Mail className="h-24 w-24" strokeWidth={1} />}
        />
        <StatCardLux
          icon={MailWarning}
          tone="amber"
          label="No email"
          value={noEmailCount}
          hint="will be skipped"
          accent="bg-gold"
          highlight={noEmailCount > 0}
          art={<MailWarning className="h-24 w-24" strokeWidth={1} />}
        />
        <StatCardLux
          icon={Megaphone}
          tone="clay"
          label="Sent so far"
          value={history.length}
          hint="announcements this camp"
          accent="bg-clay-400"
          art={<Megaphone className="h-24 w-24" strokeWidth={1} />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* ─── Composer + preview ─── */}
        <div className="space-y-6">
          <div className={cn(luxSurface, "p-5 sm:p-6")}>
            <div className="mb-5 flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold/15 text-gold-dark">
                <Megaphone className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold text-clay-700">
                  Write the announcement
                </h2>
                <p className="text-xs text-clay-500">
                  Anything in {"{{"}braces{"}}"} is filled in per camper.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="subject">Subject line</Label>
                <Input
                  id="subject"
                  ref={subjectRef}
                  value={subject}
                  onFocus={() => setFocusTarget("subject")}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. {{firstName}}, here's what to pack for camp"
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="body">Message</Label>
                <Textarea
                  id="body"
                  ref={bodyRef}
                  value={body}
                  onFocus={() => setFocusTarget("body")}
                  onChange={(e) => setBody(e.target.value)}
                  rows={16}
                  className="rounded-xl font-sans leading-relaxed"
                  placeholder="Hi {{greetingName}}, ..."
                />
                <p className="text-xs text-clay-500">
                  Leave a blank line between paragraphs. Lines starting with
                  &ldquo;-&rdquo; become bullet points, and any link you paste becomes
                  clickable.
                </p>
              </div>

              {/* Placeholder palette */}
              <div className="rounded-2xl border border-clay-100 bg-cream/40 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-gold-dark" />
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay-600">
                    Insert a placeholder
                  </p>
                  <span className="text-xs text-clay-400">
                    · goes into the {focusTarget === "subject" ? "subject" : "message"}
                  </span>
                </div>
                <div className="space-y-3">
                  {BROADCAST_TOKEN_GROUPS.map((group) => (
                    <TokenGroup key={group} group={group} onInsert={insertToken} />
                  ))}
                </div>
              </div>

              {unknownTokens.length > 0 && (
                <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">
                      Unknown placeholder{unknownTokens.length === 1 ? "" : "s"}:{" "}
                      {unknownTokens.map((t) => `{{${t}}}`).join(", ")}
                    </p>
                    <p className="text-xs">
                      Campers would see the braces exactly as typed, so sending is
                      blocked until this is fixed. Use a chip above to insert a valid one.
                    </p>
                  </div>
                </div>
              )}

              {/* Optional extras */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ctaLabel">Button label (optional)</Label>
                  <Input
                    id="ctaLabel"
                    value={ctaLabel}
                    onChange={(e) => setCtaLabel(e.target.value)}
                    placeholder="e.g. Fill in the medical form"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ctaUrl">Button link (optional)</Label>
                  <Input
                    id="ctaUrl"
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    placeholder="https://forms.gle/..."
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="replyTo">Send replies to (optional)</Label>
                <Input
                  id="replyTo"
                  type="email"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                  placeholder="ropscamp@example.com"
                  className="h-11 rounded-xl"
                />
                <p className="text-xs text-clay-500">
                  When you&rsquo;re asking campers for information, put an inbox here —
                  their replies land there instead of the ministry&rsquo;s sending address.
                </p>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className={cn(luxSurface, "overflow-hidden")}>
            <div className="flex flex-col gap-3 border-b border-clay-100/80 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal/15 text-teal-dark">
                  <Eye className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-semibold text-clay-700">
                    Preview
                  </h2>
                  <p className="text-xs text-clay-500">
                    Exactly what this camper will receive.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={previewId ?? ""}
                  onValueChange={(v) => setPreviewId(v)}
                  disabled={recipients.length === 0}
                >
                  <SelectTrigger className="h-10 w-[220px] rounded-xl">
                    <SelectValue placeholder="No camper to preview" />
                  </SelectTrigger>
                  <SelectContent>
                    {recipients.slice(0, 100).map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.firstName} {r.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex rounded-xl border border-clay-200 p-0.5">
                  {(["email", "text"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPreviewMode(mode)}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                        previewMode === mode
                          ? "bg-clay-800 text-cream"
                          : "text-clay-500 hover:text-clay-700"
                      )}
                    >
                      {mode === "email" ? "Email" : "Plain text"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5">
              {loading ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner />
                </div>
              ) : !preview || !previewRow ? (
                <EmptyStateLux
                  icon={MailWarning}
                  tone="amber"
                  title="Nobody to preview"
                  description="No camper in this audience has an email address yet."
                />
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl bg-cream/60 px-4 py-3 text-sm">
                    <div className="text-clay-500">
                      To:{" "}
                      <span className="font-medium text-clay-800">
                        {broadcastRecipient(previewRow)}
                      </span>
                      {previewRow.parentEmail && (
                        <span className="text-xs text-clay-400">
                          {" "}
                          · parent/guardian address
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-clay-500">
                      Subject:{" "}
                      <span className="font-medium text-clay-800">
                        {preview.subject || "(no subject)"}
                      </span>
                    </div>
                  </div>
                  {previewMode === "email" ? (
                    <iframe
                      title="Announcement preview"
                      srcDoc={preview.html}
                      sandbox=""
                      className="h-[620px] w-full rounded-2xl border border-clay-100 bg-white"
                    />
                  ) : (
                    <pre className="max-h-[620px] overflow-auto whitespace-pre-wrap rounded-2xl border border-clay-100 bg-white p-5 text-sm leading-relaxed text-clay-700">
                      {preview.text}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Result of the last send */}
          {lastResult && (
            <div className={cn(luxSurface, "p-5 sm:p-6")}>
              <h2 className="font-display text-lg font-semibold text-clay-700">
                Last send
              </h2>
              <p className="mt-1 text-sm text-clay-500">
                {lastResult.sent} sent · {lastResult.skipped} skipped ·{" "}
                {lastResult.failed} failed
              </p>
              {(lastResult.failed > 0 || lastResult.skipped > 0) && (
                <ul className="mt-3 space-y-1.5 text-sm">
                  {lastResult.outcomes
                    .filter((o) => o.status !== "sent")
                    .map((o) => (
                      <li key={o.registrationId} className="flex items-start gap-2">
                        <Badge
                          className={cn(
                            "shrink-0",
                            o.status === "failed"
                              ? "bg-red-100 text-red-700 hover:bg-red-100"
                              : "bg-amber-100 text-amber-700 hover:bg-amber-100"
                          )}
                        >
                          {o.status}
                        </Badge>
                        <span className="text-clay-700">
                          {o.name}
                          {o.reason ? (
                            <span className="text-clay-500"> — {o.reason}</span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* ─── Audience + send ─── */}
        <div className="space-y-6">
          <div className={cn(luxSurface, "p-5 sm:p-6 xl:sticky xl:top-6")}>
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal/15 text-teal-dark">
                <Users className="h-5 w-5" />
              </span>
              <h2 className="font-display text-lg font-semibold text-clay-700">
                Who gets it
              </h2>
            </div>

            <div className="space-y-2">
              {BROADCAST_AUDIENCES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setAudience(option.value)}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left text-sm transition-colors",
                    audience === option.value
                      ? "border-gold bg-gold/10"
                      : "border-clay-200 hover:bg-cream/60"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-clay-800">{option.label}</span>
                    <span className="text-xs font-semibold text-clay-500">
                      {audienceCounts[option.value] ?? 0}
                    </span>
                  </div>
                  <div className="text-xs text-clay-500">{option.description}</div>
                </button>
              ))}
            </div>

            {audience === "SELECTED" && (
              <div className="mt-4 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-clay-400" />
                  <Input
                    placeholder="Search campers..."
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    className="h-10 rounded-xl pl-9"
                  />
                </div>
                <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-clay-100 p-2">
                  {pickerRows.length === 0 ? (
                    <p className="p-3 text-center text-xs text-clay-500">
                      No campers match.
                    </p>
                  ) : (
                    pickerRows.map((r) => {
                      const to = broadcastRecipient(r);
                      return (
                        <label
                          key={r.id}
                          className="flex cursor-pointer items-start gap-2.5 rounded-lg p-2 text-sm hover:bg-cream/60"
                        >
                          <Checkbox
                            checked={selectedIds.has(r.id)}
                            onCheckedChange={() => toggleSelected(r.id)}
                            className="mt-0.5"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-clay-800">
                              {r.firstName} {r.lastName}
                            </span>
                            <span className="block truncate text-xs text-clay-500">
                              {to ?? "No email address"}
                            </span>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <div className="mt-5 rounded-xl bg-cream/60 p-4 text-sm">
              <p className="text-clay-700">
                <span className="font-semibold text-clay-800">{recipients.length}</span>{" "}
                camper{recipients.length === 1 ? "" : "s"} will receive this.
              </p>
              {noEmailCount > 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  {noEmailCount} in this audience{" "}
                  {noEmailCount === 1 ? "has" : "have"} no email address and will be
                  skipped.
                </p>
              )}
              <p className="mt-1 text-xs text-clay-500">
                Where a parent or guardian address is on file, their copy goes there.
              </p>
            </div>

            <Button
              variant="gold"
              className="mt-4 w-full rounded-xl"
              disabled={!canSend}
              onClick={() => setConfirmOpen(true)}
            >
              <Send className="mr-2 h-4 w-4" />
              Send to {recipients.length} camper{recipients.length === 1 ? "" : "s"}
            </Button>
          </div>

          {/* History */}
          <div className={cn(luxSurface, "p-5 sm:p-6")}>
            <h2 className="mb-4 font-display text-lg font-semibold text-clay-700">
              Sent announcements
            </h2>
            {history.length === 0 ? (
              <p className="text-sm text-clay-500">
                Nothing sent yet. Anything you send is kept here, so you can reuse it
                as the starting point for the next one.
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-xl border border-clay-100 p-3 text-sm"
                  >
                    <div className="font-medium text-clay-800">{b.subject}</div>
                    <div className="mt-1 text-xs text-clay-500">
                      {format(new Date(b.sentAt), "d MMM yyyy, HH:mm")} ·{" "}
                      {b.sentByName}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                        {b.sentCount} sent
                      </Badge>
                      {b.skippedCount > 0 && (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                          {b.skippedCount} skipped
                        </Badge>
                      )}
                      {b.failedCount > 0 && (
                        <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                          {b.failedCount} failed
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2.5 rounded-lg"
                      onClick={() => reuse(b)}
                    >
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      Reuse
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(open) => !sending && setConfirmOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send this announcement?</DialogTitle>
            <DialogDescription>
              {recipients.length} camper{recipients.length === 1 ? "" : "s"} will each
              get their own copy of &ldquo;{subject}&rdquo;, with their name and details
              filled in. Emails can&rsquo;t be recalled once sent.
            </DialogDescription>
          </DialogHeader>
          {noEmailCount > 0 && (
            <p className="text-sm text-amber-700">
              {noEmailCount} camper{noEmailCount === 1 ? "" : "s"} in this audience{" "}
              {noEmailCount === 1 ? "has" : "have"} no email address and will be skipped.
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button onClick={send} disabled={sending}>
              {sending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send now
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TokenGroup({
  group,
  onInsert,
}: {
  group: BroadcastTokenGroup;
  onInsert: (token: string) => void;
}) {
  const tokens = BROADCAST_TOKENS.filter((t) => t.group === group);
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-clay-400">
        {group}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {tokens.map((t) => (
          <button
            key={t.token}
            type="button"
            title={t.hint}
            onClick={() => onInsert(t.token)}
            className="rounded-full border border-clay-200 bg-white px-2.5 py-1 font-mono text-[11px] text-clay-700 transition-colors hover:border-gold hover:bg-gold/10"
          >
            {`{{${t.token}}}`}
          </button>
        ))}
      </div>
    </div>
  );
}
