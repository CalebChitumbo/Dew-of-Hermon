import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { syncNotificationEmailStatus } from "@/lib/notifications";
import { hasMinRole } from "@/lib/permissions";
import type { UserRole } from "@/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications/email-status
 * Returns notifications with failed or pending email delivery.
 * Also syncs the delivery status from the Firebase extension's mail docs.
 *
 * Query params:
 *   - status: "failed" | "queued" | "skipped" | "all" (default: "failed")
 *   - sync: "true" to refresh status from mail docs before returning (default: "false")
 *   - limit: max results (default: 50)
 *
 * Requires ADMIN+ role.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userDoc = await adminDb
      .collection("users")
      .doc(decodedToken.uid)
      .get();
    const callerRole = userDoc.data()?.role as UserRole | undefined;

    if (!callerRole || !hasMinRole(callerRole, "ADMIN")) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") || "failed";
    const shouldSync = searchParams.get("sync") === "true";
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      200
    );

    // Build query
    let query: FirebaseFirestore.Query = adminDb.collection("notifications");

    if (statusFilter !== "all") {
      const statuses =
        statusFilter === "failed"
          ? ["failed", "skipped"]
          : [statusFilter];
      query = query.where("emailStatus", "in", statuses);
    }

    query = query.orderBy("createdAt", "desc").limit(limit);

    const snapshot = await query.get();

    // Optionally sync delivery status from Firebase extension
    if (shouldSync) {
      const syncPromises = snapshot.docs
        .filter((doc) => {
          const data = doc.data();
          return data.emailDocId && data.emailStatus === "queued";
        })
        .map((doc) =>
          syncNotificationEmailStatus(doc.id).catch((err) => {
            console.error(`Sync failed for ${doc.id}:`, err);
            return null;
          })
        );

      await Promise.all(syncPromises);
    }

    // Re-read after sync if we synced
    const finalSnapshot = shouldSync
      ? await query.get()
      : snapshot;

    const notifications = finalSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        title: data.title,
        type: data.type,
        emailStatus: data.emailStatus || "pending",
        emailDocId: data.emailDocId || null,
        emailError: data.emailError || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });

    // Summary counts
    const summary = {
      total: notifications.length,
      failed: notifications.filter((n) => n.emailStatus === "failed").length,
      skipped: notifications.filter((n) => n.emailStatus === "skipped").length,
      queued: notifications.filter((n) => n.emailStatus === "queued").length,
      delivered: notifications.filter((n) => n.emailStatus === "delivered")
        .length,
    };

    return NextResponse.json({ notifications, summary });
  } catch (error) {
    console.error("GET /api/notifications/email-status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch email status" },
      { status: 500 }
    );
  }
}
