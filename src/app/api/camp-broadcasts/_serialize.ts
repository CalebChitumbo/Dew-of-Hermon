import type { CampBroadcastOutcome } from "@/types";

export function serializeBroadcast(
  id: string,
  data: FirebaseFirestore.DocumentData
) {
  return {
    id,
    campId: data.campId,
    subject: data.subject ?? "",
    body: data.body ?? "",
    audience: data.audience ?? "ALL",
    selectedIds: (data.selectedIds as string[] | undefined) ?? [],
    ctaLabel: data.ctaLabel ?? null,
    ctaUrl: data.ctaUrl ?? null,
    replyTo: data.replyTo ?? null,
    sentBy: data.sentBy ?? null,
    sentByName: data.sentByName ?? "Camp team",
    sentAt: data.sentAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    recipientCount: data.recipientCount ?? 0,
    sentCount: data.sentCount ?? 0,
    skippedCount: data.skippedCount ?? 0,
    failedCount: data.failedCount ?? 0,
    outcomes: ((data.outcomes as CampBroadcastOutcome[] | undefined) ?? []).map(
      (o) => ({
        registrationId: o.registrationId,
        name: o.name,
        to: o.to ?? null,
        status: o.status,
        reason: o.reason ?? null,
      })
    ),
  };
}
