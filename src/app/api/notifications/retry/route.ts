import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { retryNotificationEmail } from "@/lib/notifications";
import { hasMinRole } from "@/lib/permissions";
import type { UserRole } from "@/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/notifications/retry
 * Retry sending email for a failed notification.
 *
 * Body: { notificationId: string }
 * OR:   { retryAllFailed: true } (admin only — retries all failed emails)
 *
 * Requires DEPARTMENT_LEAD+ role.
 */
export async function POST(request: NextRequest) {
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

    // Check caller role
    const userDoc = await adminDb
      .collection("users")
      .doc(decodedToken.uid)
      .get();
    const callerRole = userDoc.data()?.role as UserRole | undefined;

    if (!callerRole || !hasMinRole(callerRole, "DEPARTMENT_LEAD")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    const { notificationId, retryAllFailed } = body;

    // Retry all failed emails
    if (retryAllFailed === true) {
      if (!hasMinRole(callerRole, "ADMIN")) {
        return NextResponse.json(
          { error: "Only admins can retry all failed emails" },
          { status: 403 }
        );
      }

      const failedQuery = await adminDb
        .collection("notifications")
        .where("emailStatus", "in", ["failed", "skipped"])
        .limit(50)
        .get();

      if (failedQuery.empty) {
        return NextResponse.json({
          message: "No failed emails to retry",
          retried: 0,
        });
      }

      let retriedCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      for (const doc of failedQuery.docs) {
        try {
          const { emailSent } = await retryNotificationEmail(doc.id);
          if (emailSent) {
            retriedCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          failCount++;
          errors.push(
            `${doc.id}: ${err instanceof Error ? err.message : "Unknown"}`
          );
        }
      }

      return NextResponse.json({
        message: "Batch retry completed",
        retried: retriedCount,
        failed: failCount,
        total: failedQuery.size,
        errors: errors.slice(0, 10),
      });
    }

    // Retry single notification
    if (!notificationId) {
      return NextResponse.json(
        { error: "notificationId is required" },
        { status: 400 }
      );
    }

    const { emailSent, newMailDocId } =
      await retryNotificationEmail(notificationId);

    return NextResponse.json({
      message: emailSent ? "Email retry queued" : "Email retry failed",
      emailSent,
      newMailDocId: newMailDocId || null,
    });
  } catch (error) {
    console.error("POST /api/notifications/retry error:", error);
    return NextResponse.json(
      {
        error: "Failed to retry email",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
