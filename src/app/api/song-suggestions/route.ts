import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { UserRole } from "@/types";

export const dynamic = "force-dynamic";

const COLLECTION = "worshipSongSuggestions";
const VALID_STATUSES = ["open", "archived"] as const;
type Status = (typeof VALID_STATUSES)[number];

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
      name: (data.name as string) || "",
    };
  } catch {
    return null;
  }
}

function parseStatus(raw: string | null): Status | null {
  if (!raw) return null;
  return (VALID_STATUSES as readonly string[]).includes(raw)
    ? (raw as Status)
    : null;
}

function serializeDoc(doc: FirebaseFirestore.QueryDocumentSnapshot) {
  const data = doc.data();
  return {
    id: doc.id,
    title: data.title || "",
    youtubeLink: data.youtubeLink || "",
    suggestedBy: data.suggestedBy || "",
    suggestedByName: data.suggestedByName || "",
    status: (data.status as Status) || "open",
    createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
    archivedAt: data.archivedAt?.toDate?.()?.toISOString() || null,
    pickedForCycle: data.pickedForCycle || null,
  };
}

// GET /api/song-suggestions?status=open|archived
export async function GET(request: Request) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = parseStatus(searchParams.get("status")) ?? "open";

    const snapshot = await adminDb
      .collection(COLLECTION)
      .where("status", "==", status)
      .orderBy("createdAt", "desc")
      .get();

    const suggestions = snapshot.docs.map(serializeDoc);
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("GET /api/song-suggestions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch song suggestions" },
      { status: 500 }
    );
  }
}

// POST /api/song-suggestions — any signed-in user can suggest a song.
export async function POST(request: Request) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const youtubeLink = String(body.youtubeLink ?? "").trim();

    if (!title) {
      return NextResponse.json(
        { error: "Song title is required" },
        { status: 400 }
      );
    }

    const now = new Date();
    const data = {
      title,
      youtubeLink,
      suggestedBy: caller.uid,
      suggestedByName: caller.name,
      status: "open" as Status,
      createdAt: now,
    };
    const ref = await adminDb.collection(COLLECTION).add(data);

    return NextResponse.json(
      {
        suggestion: {
          id: ref.id,
          ...data,
          createdAt: now.toISOString(),
          archivedAt: null,
          pickedForCycle: null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/song-suggestions error:", error);
    return NextResponse.json(
      { error: "Failed to create song suggestion" },
      { status: 500 }
    );
  }
}
