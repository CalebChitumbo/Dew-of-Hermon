/** A meal scan, flattened for the wire. */
export function serializeMealScan(
  id: string,
  data: FirebaseFirestore.DocumentData
) {
  return {
    id,
    campId: data.campId,
    sittingId: data.sittingId,
    date: data.date,
    slot: data.slot,
    registrationId: data.registrationId,
    camperName: data.camperName ?? "",
    camperGender: data.camperGender ?? null,
    dietaryPreference: data.dietaryPreference ?? null,
    allergies: data.allergies ?? null,
    servedAt: data.servedAt?.toDate?.()?.toISOString() ?? null,
    servedBy: data.servedBy ?? null,
    servedByName: data.servedByName ?? "",
    paymentFlagged: data.paymentFlagged ?? false,
    queuedOffline: data.queuedOffline ?? false,
  };
}

/**
 * The slice of a registration the serving line needs: who they are, whether
 * anything about their food matters, and whether the manager should be told
 * about their payment. Deliberately excludes contact details and medical
 * notes — a meal queue is not the place for either.
 */
export function serializeCamperForLine(
  id: string,
  data: FirebaseFirestore.DocumentData
) {
  return {
    id,
    campId: data.campId,
    firstName: data.firstName ?? "",
    lastName: data.lastName ?? "",
    gender: data.gender ?? null,
    churchOrSchool: data.churchOrSchool ?? null,
    checkInCode: data.checkInCode ?? null,
    paymentStatus: data.paymentStatus ?? "UNPAID",
    sponsorshipId: data.sponsorshipId ?? null,
    sponsorName: data.sponsorName ?? null,
    dietaryPreference: data.dietaryPreference ?? null,
    allergies: data.allergies ?? null,
    checkedIn: data.checkedIn ?? false,
    onPass: data.onPass ?? false,
  };
}

/** True when nobody has covered this camper's fee — flagged, never refused. */
export function isPaymentFlagged(data: FirebaseFirestore.DocumentData): boolean {
  const paid = data.paymentStatus === "PAID";
  const sponsored = !!data.sponsorshipId;
  return !paid && !sponsored;
}
