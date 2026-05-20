import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

interface PublicBraaiRow {
  id: string;
  title: string;
  eventDate: string;
  venue: string | null;
}

/**
 * Public list of upcoming, non-archived braais for the order page selector.
 * Past braais and archived ones are filtered out so buyers can't accidentally
 * place an order against a finished event.
 */
export async function GET() {
  try {
    const snap = await adminDb.collection("braaiEvents").get();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const rows: PublicBraaiRow[] = [];
    snap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.isArchived) return;
      const eventDate: Date | null = data.eventDate?.toDate?.() ?? null;
      if (!eventDate) return;
      if (eventDate.getTime() < startOfToday.getTime()) return;
      rows.push({
        id: doc.id,
        title: (data.title as string) || "Fundraising Braai",
        eventDate: eventDate.toISOString(),
        venue: (data.venue as string | null) ?? null,
      });
    });

    rows.sort(
      (a, b) =>
        new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
    );

    return NextResponse.json({ braais: rows });
  } catch (error) {
    console.error("Error listing public braais:", error);
    return NextResponse.json(
      { error: "Failed to load upcoming braais" },
      { status: 500 }
    );
  }
}
