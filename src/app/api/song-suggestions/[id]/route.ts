import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { hasMinRole } from "@/lib/permissions";
import { UserRole } from "@/types";

export const dynamic = "force-dynamic";

const COLLECTION = "worshipSongSuggestions";

async function getCaller() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session");
    if (!session?.value) return null;

    const decoded = await adminAuth.verifySessionCookie(session.value);
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) return null;

    const data = userDoc.data()!;
    return {
      uid: decoded.uid,
      role: data.role as UserRole,
    };
  } catch {
    return null;
  }
}

// PATCH /api/song-suggestions/[id] — archive / restore. Lead-only.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasMinRole(caller.role, "DEPARTMENT_LEAD")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const docRef = adminDb.collection(COLLECTION).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Suggestion not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.status === "archived") {
      updates.status = "archived";
      updates.archivedAt = new Date();
      updates.pickedForCycle =
        typeof body.pickedForCycle === "string" && body.pickedForCycle.trim()
          ? body.pickedForCycle.trim()
          : null;
    } else if (body.status === "open") {
      updates.status = "open";
      updates.archivedAt = null;
      updates.pickedForCycle = null;
    } else {
      return NextResponse.json(
        { error: "Invalid status — must be 'open' or 'archived'" },
        { status: 400 }
      );
    }

    await docRef.update(updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/song-suggestions/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update song suggestion" },
      { status: 500 }
    );
  }
}

// DELETE /api/song-suggestions/[id] — leads, or the original suggester.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const docRef = adminDb.collection(COLLECTION).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Suggestion not found" },
        { status: 404 }
      );
    }

    const isLead = hasMinRole(caller.role, "DEPARTMENT_LEAD");
    const isOwner = doc.data()?.suggestedBy === caller.uid;
    if (!isLead && !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await docRef.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/song-suggestions/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete song suggestion" },
      { status: 500 }
    );
  }
}
