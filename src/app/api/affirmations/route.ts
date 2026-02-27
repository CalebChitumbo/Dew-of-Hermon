import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { Affirmation } from "@/types";

// GET /api/affirmations - List affirmations
export async function GET(request: NextRequest) {
  try {
    // Verify authentication via session cookie or Authorization header
    const authHeader = request.headers.get("Authorization");
    let uid: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        uid = decoded.uid;
      } catch {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
    }

    if (!uid) {
      // Try session cookie
      const sessionCookie = request.cookies.get("session")?.value;
      if (sessionCookie) {
        try {
          const decoded = await adminAuth.verifySessionCookie(sessionCookie);
          uid = decoded.uid;
        } catch {
          return NextResponse.json({ error: "Invalid session" }, { status: 401 });
        }
      }
    }

    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    const snapshot = await adminDb
      .collection("affirmations")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const affirmations = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        content: data.content,
        serviceId: data.serviceId || null,
        authorId: data.authorId,
        authorName: data.authorName,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    });

    return NextResponse.json({ affirmations });
  } catch (error) {
    console.error("Error fetching affirmations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/affirmations - Create a new affirmation
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("Authorization");
    let uid: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        uid = decoded.uid;
      } catch {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
    }

    if (!uid) {
      const sessionCookie = request.cookies.get("session")?.value;
      if (sessionCookie) {
        try {
          const decoded = await adminAuth.verifySessionCookie(sessionCookie);
          uid = decoded.uid;
        } catch {
          return NextResponse.json({ error: "Invalid session" }, { status: 401 });
        }
      }
    }

    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data();
    const role = userData?.role;
    if (!role || !["SUPER_ADMIN", "ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { title, content, serviceId } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    const now = new Date();
    const affirmationData = {
      title: title.trim(),
      content: content.trim(),
      serviceId: serviceId || null,
      authorId: uid,
      authorName: userData?.name || "Unknown",
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await adminDb.collection("affirmations").add(affirmationData);

    return NextResponse.json(
      {
        id: docRef.id,
        ...affirmationData,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating affirmation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
