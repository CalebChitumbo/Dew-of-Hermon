import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

async function getCallerUid(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session");
    if (!session?.value) return null;
    const decoded = await adminAuth.verifySessionCookie(session.value);
    return decoded.uid;
  } catch {
    return null;
  }
}

const FK_BY_KIND = {
  transport: { fk: "transportRequestId", collection: "transportRequests" },
  budget: { fk: "budgetRequestId", collection: "budgetRequests" },
  media: { fk: "mediaRequestId", collection: "mediaRequests" },
  food: { fk: "foodRequestId", collection: "foodRequests" },
} as const;

type Kind = keyof typeof FK_BY_KIND;
type StatusBundle = Partial<Record<Kind, string | null>>;

// ─── POST /api/events/stakeholder-statuses ───
// Body: { eventIds: string[] }
// Resolves each event's linked transport/budget/media/food request statuses
// server-side (Admin SDK), so the approvals page never depends on client-side
// read rules for those collections.

export async function POST(request: Request) {
  try {
    const uid = await getCallerUid();
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { eventIds?: string[] };
    const eventIds = Array.isArray(body.eventIds) ? body.eventIds : [];
    if (eventIds.length === 0) {
      return NextResponse.json({ statuses: {} });
    }

    // Load the events to read their FK ids.
    const eventRefs = eventIds.map((id) => adminDb.collection("events").doc(id));
    const eventSnaps = await adminDb.getAll(...eventRefs);

    // Collect every linked request reference, tracking which event/kind it maps to.
    const lookups: { eventId: string; kind: Kind; ref: FirebaseFirestore.DocumentReference }[] = [];
    const statuses: Record<string, StatusBundle> = {};
    for (const snap of eventSnaps) {
      if (!snap.exists) continue;
      const data = snap.data()!;
      statuses[snap.id] = {};
      for (const kind of Object.keys(FK_BY_KIND) as Kind[]) {
        const { fk, collection } = FK_BY_KIND[kind];
        const reqId = data[fk];
        if (reqId) {
          lookups.push({
            eventId: snap.id,
            kind,
            ref: adminDb.collection(collection).doc(reqId),
          });
        }
      }
    }

    if (lookups.length > 0) {
      const reqSnaps = await adminDb.getAll(...lookups.map((l) => l.ref));
      reqSnaps.forEach((reqSnap, i) => {
        const { eventId, kind } = lookups[i];
        statuses[eventId][kind] = reqSnap.exists
          ? ((reqSnap.data()?.status as string) ?? null)
          : null;
      });
    }

    return NextResponse.json({ statuses });
  } catch (error) {
    console.error("POST /api/events/stakeholder-statuses error:", error);
    return NextResponse.json(
      { error: "Failed to resolve stakeholder statuses" },
      { status: 500 }
    );
  }
}
