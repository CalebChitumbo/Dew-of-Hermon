import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// ─── Helper: Verify Firebase auth token from Authorization header ───

async function verifyToken(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return decoded;
  } catch {
    return null;
  }
}

// ─── GET /api/notifications ───
// Returns all notifications for the authenticated user, ordered by createdAt desc.
// Query params:
//   - limit (number) — max number of notifications to return (default 50)
//   - unreadOnly (boolean) — if "true", return only unread notifications

export async function GET(request: NextRequest) {
  try {
    const decodedToken = await verifyToken(request);
    if (!decodedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const pageLimit = limitParam ? Math.min(parseInt(limitParam, 10), 200) : 50;

    let notifQuery: FirebaseFirestore.Query = adminDb
      .collection("notifications")
      .where("userId", "==", decodedToken.uid);

    if (unreadOnly) {
      notifQuery = notifQuery.where("isRead", "==", false);
    }

    notifQuery = notifQuery.orderBy("createdAt", "desc").limit(pageLimit);

    const snapshot = await notifQuery.get();

    const notifications = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type,
        isRead: data.isRead ?? false,
        link: data.link || null,
        emailStatus: data.emailStatus || null,
        emailError: data.emailError || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// ─── PUT /api/notifications ───
// Body: { notificationId: string } — marks a single notification as read
// Body: { markAllRead: true } — marks all notifications as read for the user

export async function PUT(request: NextRequest) {
  try {
    const decodedToken = await verifyToken(request);
    if (!decodedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId, markAllRead } = body;

    // Mark all as read
    if (markAllRead === true) {
      const unreadQuery = adminDb
        .collection("notifications")
        .where("userId", "==", decodedToken.uid)
        .where("isRead", "==", false);

      const snapshot = await unreadQuery.get();

      if (snapshot.empty) {
        return NextResponse.json({ message: "No unread notifications", updated: 0 });
      }

      const batch = adminDb.batch();
      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { isRead: true });
      });
      await batch.commit();

      return NextResponse.json({
        message: "All notifications marked as read",
        updated: snapshot.size,
      });
    }

    // Mark single notification as read
    if (!notificationId) {
      return NextResponse.json(
        { error: "Missing notificationId or markAllRead in request body" },
        { status: 400 }
      );
    }

    const notifRef = adminDb.collection("notifications").doc(notificationId);
    const notifDoc = await notifRef.get();

    if (!notifDoc.exists) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    // Verify the notification belongs to the authenticated user
    const notifData = notifDoc.data();
    if (notifData?.userId !== decodedToken.uid) {
      return NextResponse.json(
        { error: "Forbidden: You can only update your own notifications" },
        { status: 403 }
      );
    }

    await notifRef.update({ isRead: true });

    return NextResponse.json({
      message: "Notification marked as read",
      id: notificationId,
    });
  } catch (error) {
    console.error("PUT /api/notifications error:", error);
    return NextResponse.json(
      { error: "Failed to update notification" },
      { status: 500 }
    );
  }
}
