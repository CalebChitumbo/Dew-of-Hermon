import { NextResponse } from "next/server";
import type { Query } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import {
  getFeaturePermissionsConfig,
  getDepartmentNameToIdMap,
} from "@/lib/feature-permissions-server";
import { checkFeatureAccess } from "@/lib/access-control";
import { hasMinRole } from "@/lib/permissions";
import { getSessionCaller as getCaller } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

async function aggCount(q: Query): Promise<number> {
  const snap = await q.count().get();
  return snap.data().count;
}

/**
 * GET /api/pending-counts
 *
 * Returns, for the signed-in user, the number of items awaiting their
 * attention in each actionable queue, keyed by the sidebar nav pageKey:
 *   { counts: { [pageKey]: number }, total: number }
 *
 * Each queue is only counted when the caller is allowed to act on it, using
 * the same feature-access gating the pages enforce. The sidebar renders a
 * badge wherever a count is present.
 */
export async function GET() {
  try {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ counts: {}, total: 0 });

    const { role, departmentIds, leadsDepartmentIds } = caller;
    const isAdminPlus = hasMinRole(role, "ADMIN");
    const isSuperAdmin = role === "SUPER_ADMIN";

    // Resolve permission config + department map once, then gate in-memory.
    const [config, deptMap] = await Promise.all([
      getFeaturePermissionsConfig(),
      getDepartmentNameToIdMap(),
    ]);
    const can = (featureKey: string) =>
      checkFeatureAccess(
        featureKey,
        role,
        departmentIds,
        leadsDepartmentIds,
        deptMap,
        config
      );

    const counts: Record<string, number> = {};
    const set = (key: string, n: number) => {
      if (n > 0) counts[key] = n;
    };

    const results = await Promise.allSettled([
      // 1. Event Approvals — counted per the stage(s) this user signs off.
      (async () => {
        const stages: string[] = [];
        if (can("approve_events")) {
          stages.push("PENDING_DISPATCH", "PENDING_STAKEHOLDERS");
        }
        if (role === "VICE_CHAIRPERSON" || isSuperAdmin) {
          stages.push("PENDING_VICE_CHAIR");
        }
        if (isSuperAdmin) stages.push("PENDING_CHAIR");
        if (stages.length === 0) return;
        set(
          "events_approvals",
          await aggCount(
            adminDb.collection("events").where("approvalStatus", "in", stages)
          )
        );
      })(),

      // 2. Event Reports — submitted reports awaiting the Chairperson's review.
      (async () => {
        if (!isSuperAdmin) return;
        set(
          "event_reports_submit",
          await aggCount(
            adminDb.collection("eventReports").where("status", "==", "SUBMITTED")
          )
        );
      })(),

      // 3. Department Join Requests — manager stage (the dept's lead, or any
      //    ADMIN+/Vice-Chair) plus the chair stage (Chairperson only).
      (async () => {
        let n = 0;
        const mgrQueue = adminDb
          .collection("departmentJoinRequests")
          .where("status", "==", "PENDING_MANAGER");
        if (isAdminPlus || role === "VICE_CHAIRPERSON") {
          n += await aggCount(mgrQueue);
        } else if (role === "DEPARTMENT_LEAD" && leadsDepartmentIds.length > 0) {
          // Count only this lead's departments server-side ("in" accepts ≤10
          // values, so chunk) instead of downloading the whole queue.
          for (let i = 0; i < leadsDepartmentIds.length; i += 10) {
            const chunk = leadsDepartmentIds.slice(i, i + 10);
            n += await aggCount(mgrQueue.where("departmentId", "in", chunk));
          }
        }
        if (isSuperAdmin) {
          n += await aggCount(
            adminDb
              .collection("departmentJoinRequests")
              .where("status", "==", "PENDING_CHAIR")
          );
        }
        set("department_join_requests", n);
      })(),

      // 4. Campus Ministry — follow-up cards awaiting lead approval.
      (async () => {
        if (!can("approve_follow_up")) return;
        set(
          "campus_ministry",
          await aggCount(
            adminDb
              .collection("followUpCards")
              .where("source", "==", "CAMPUS_MINISTRY")
              .where("status", "==", "PENDING_LEAD_APPROVAL")
          )
        );
      })(),

      // 5. Discipleship — approved contacts not yet assigned to anyone.
      (async () => {
        if (!can("manage_follow_ups")) return;
        set(
          "discipleship",
          await aggCount(
            adminDb
              .collection("followUpCards")
              .where("status", "==", "NEW_CONTACT")
              .where("assigneeId", "==", null)
          )
        );
      })(),

      // 6. Transport Requests — awaiting the coordinator's details.
      (async () => {
        if (!can("manage_transport_logistics")) return;
        set(
          "transport_requests",
          await aggCount(
            adminDb
              .collection("transportRequests")
              .where("status", "==", "PENDING_DETAILS")
          )
        );
      })(),

      // 7. Media Requests — awaiting the Media coordinator's confirmation.
      (async () => {
        if (!can("manage_media")) return;
        set(
          "media_requests",
          await aggCount(
            adminDb
              .collection("mediaRequests")
              .where("status", "==", "PENDING_MEDIA")
          )
        );
      })(),

      // 8. Food Requests — awaiting Food Logistics' confirmation.
      (async () => {
        if (!can("confirm_food")) return;
        set(
          "food_requests",
          await aggCount(
            adminDb
              .collection("foodRequests")
              .where("status", "==", "PENDING_FOOD")
          )
        );
      })(),

      // 9. Accounts Approvals — transport + budget requests awaiting treasurer.
      (async () => {
        if (!can("approve_accounts")) return;
        const [t, b] = await Promise.all([
          aggCount(
            adminDb
              .collection("transportRequests")
              .where("status", "==", "PENDING_TREASURER")
          ),
          aggCount(
            adminDb
              .collection("budgetRequests")
              .where("status", "==", "PENDING_TREASURER")
          ),
        ]);
        set("accounts_approvals", t + b);
      })(),
    ]);

    // One queue failing (e.g. a missing index) shouldn't blank every badge.
    for (const r of results) {
      if (r.status === "rejected") {
        console.error("pending-counts: a queue failed:", r.reason);
      }
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return NextResponse.json({ counts, total });
  } catch (error) {
    console.error("GET /api/pending-counts error:", error);
    return NextResponse.json({ counts: {}, total: 0 });
  }
}
