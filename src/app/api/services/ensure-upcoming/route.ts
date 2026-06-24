import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import {
  ensureUpcomingServices,
  maybeNotifyRotaOpen,
  DEFAULT_WEEKS_AHEAD,
} from "@/lib/service-provisioning";
import { UserRole } from "@/types";

export const dynamic = "force-dynamic";

const ROLE_HIERARCHY: Record<string, number> = {
  SUPER_ADMIN: 6,
  VICE_CHAIRPERSON: 5,
  ADMIN: 4,
  DEPARTMENT_LEAD: 3,
  YOUTH_LEADER: 2,
  MEMBER: 1,
};

async function getCaller(): Promise<{ uid: string; role: UserRole } | null> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session");
    if (!session?.value) return null;
    const decoded = await adminAuth.verifySessionCookie(session.value);
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) return null;
    return { uid: decoded.uid, role: userDoc.data()!.role as UserRole };
  } catch {
    return null;
  }
}

/**
 * POST /api/services/ensure-upcoming
 *
 * Idempotently makes sure the next couple of Sundays each have a service rota,
 * and pings department heads for any rota that was newly opened. Called when a
 * manager opens the Services page so the coming Sunday is "already there"
 * without waiting for the weekly cron. Access: DEPARTMENT_LEAD+ (the people who
 * run rotas).
 */
export async function POST() {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((ROLE_HIERARCHY[caller.role] || 0) < ROLE_HIERARCHY.DEPARTMENT_LEAD) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { services } = await ensureUpcomingServices({
      weeks: DEFAULT_WEEKS_AHEAD,
      createdBy: caller.uid,
    });

    let notified = 0;
    for (const ensured of services) {
      notified += await maybeNotifyRotaOpen(ensured);
    }

    return NextResponse.json({
      ensured: services.map((s) => ({
        serviceId: s.serviceId,
        date: s.date,
        created: s.created,
      })),
      created: services.filter((s) => s.created).length,
      headsNotified: notified,
    });
  } catch (error) {
    console.error("POST /api/services/ensure-upcoming error:", error);
    return NextResponse.json(
      { error: "Failed to ensure upcoming services" },
      { status: 500 }
    );
  }
}
