import { NextRequest, NextResponse } from "next/server";
import {
  ensureUpcomingServices,
  maybeNotifyRotaOpen,
  DEFAULT_WEEKS_AHEAD,
} from "@/lib/service-provisioning";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/ensure-services
 *
 * Weekly job that keeps the next couple of Sundays' Potter's Wheel rotas
 * provisioned ahead of time and notifies department heads about any rota that
 * was newly opened, so they can assign their people without waiting for an
 * admin to create the service by hand. Idempotent — safe to run repeatedly.
 */
export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error("CRON_SECRET is not configured");
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { services } = await ensureUpcomingServices({
      weeks: DEFAULT_WEEKS_AHEAD,
    });

    let headsNotified = 0;
    for (const ensured of services) {
      headsNotified += await maybeNotifyRotaOpen(ensured);
    }

    const created = services.filter((s) => s.created);

    return NextResponse.json({
      message: `Ensured ${services.length} upcoming service(s)`,
      created: created.length,
      createdDates: created.map((s) => s.date),
      headsNotified,
    });
  } catch (error) {
    console.error("Cron ensure-services error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
