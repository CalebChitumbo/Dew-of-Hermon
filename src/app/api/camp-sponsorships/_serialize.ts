export function serializeSponsorship(
  id: string,
  data: FirebaseFirestore.DocumentData
) {
  return {
    id,
    campId: data.campId,
    sponsorName: data.sponsorName,
    organization: data.organization ?? null,
    phone: data.phone,
    email: data.email ?? null,
    pledgeType: data.pledgeType,
    slotsPledged: data.slotsPledged ?? 0,
    amountPledged: data.amountPledged ?? 0,
    slotsAssigned: data.slotsAssigned ?? 0,
    notes: data.notes ?? null,
    paymentStatus: data.paymentStatus ?? "UNPAID",
    amountReceived: data.amountReceived ?? null,
    paymentReference: data.paymentReference ?? null,
    paymentNotes: data.paymentNotes ?? null,
    paymentMarkedBy: data.paymentMarkedBy ?? null,
    paymentMarkedByName: data.paymentMarkedByName ?? null,
    paymentMarkedAt: data.paymentMarkedAt?.toDate?.()?.toISOString() ?? null,
    submittedByUid: data.submittedByUid ?? null,
    submittedByEmail: data.submittedByEmail ?? null,
    createdAt:
      data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    updatedAt:
      data.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
  };
}
