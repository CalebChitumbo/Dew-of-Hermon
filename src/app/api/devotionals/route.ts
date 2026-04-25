import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { serverCheckFeatureAccess } from "@/lib/feature-permissions-server";
import { createNotificationWithEmail } from "@/lib/notifications";
import { DevotionalScope, UserRole } from "@/types";

const VALID_SCOPES: DevotionalScope[] = ["CAMPUS_MINISTRY", "LIFE_GROUPS"];

const SCOPE_CONFIG: Record<
  DevotionalScope,
  {
    featureKey: string;
    departmentName: string;
    audienceLabel: string;
    coordinatorLabel: string;
    link: string;
  }
> = {
  CAMPUS_MINISTRY: {
    featureKey: "manage_devotionals",
    departmentName: "Campus Ministry",
    audienceLabel: "Campus",
    coordinatorLabel: "Campus Ministry coordinator",
    link: "/department/campus-ministry?tab=devotional",
  },
  LIFE_GROUPS: {
    featureKey: "manage_life_group_devotionals",
    departmentName: "Life Groups",
    audienceLabel: "Life Group",
    coordinatorLabel: "Life Groups coordinator",
    link: "/department/life-groups?tab=devotional",
  },
};

function parseScope(raw: string | null): DevotionalScope | null {
  if (!raw) return null;
  return VALID_SCOPES.includes(raw as DevotionalScope)
    ? (raw as DevotionalScope)
    : null;
}

export const dynamic = "force-dynamic";

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
      name: data.name || "",
      departmentIds: (data.departmentIds || []) as string[],
      leadsDepartmentIds: (data.leadsDepartmentIds || []) as string[],
    };
  } catch {
    return null;
  }
}

async function getDeptIdByName(name: string): Promise<string | null> {
  const snap = await adminDb
    .collection("departments")
    .where("name", "==", name)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

// GET /api/devotionals — anyone signed in can read the devotional feed.
export async function GET(request: Request) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 20;
    const scope = parseScope(searchParams.get("scope"));

    // Fetch by createdAt (always set as a Timestamp on write) so we never
    // silently drop docs whose weekStartDate field is missing/wrong-typed,
    // which would happen with a server-side orderBy("weekStartDate").
    const snapshot = await adminDb
      .collection("devotionals")
      .orderBy("createdAt", "desc")
      .limit(scope ? Math.min(limit * 4, 200) : limit)
      .get();

    const devotionals = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        // Default older docs (written before scope was introduced) to the
        // Campus Ministry feed so they keep showing up where they were
        // originally posted.
        const docScope: DevotionalScope =
          (data.scope as DevotionalScope) || "CAMPUS_MINISTRY";
        return {
          id: doc.id,
          scope: docScope,
          title: data.title || "",
          content: data.content || "",
          weekStartDate: data.weekStartDate || "",
          scriptureReference: data.scriptureReference || null,
          authorId: data.authorId,
          authorName: data.authorName || "",
          createdAt:
            data.createdAt?.toDate?.()?.toISOString() ||
            new Date().toISOString(),
          updatedAt:
            data.updatedAt?.toDate?.()?.toISOString() ||
            new Date().toISOString(),
        };
      })
      .filter((d) => (scope ? d.scope === scope : true))
      .slice(0, limit)
      // Sort by weekStartDate desc on the client side so the most recent
      // week shows first regardless of submission order.
      .sort((a, b) => (b.weekStartDate || "").localeCompare(a.weekStartDate || ""));

    return NextResponse.json({ devotionals });
  } catch (error) {
    console.error("GET /api/devotionals error:", error);
    return NextResponse.json(
      { error: "Failed to fetch devotionals" },
      { status: 500 }
    );
  }
}

// POST /api/devotionals — Campus Ministry coordinator (or admins) only.
export async function POST(request: Request) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      content,
      weekStartDate,
      scriptureReference,
      scope: scopeRaw,
    } = body;

    const scope: DevotionalScope = parseScope(scopeRaw) || "CAMPUS_MINISTRY";
    const config = SCOPE_CONFIG[scope];

    const canManage = await serverCheckFeatureAccess(
      config.featureKey,
      caller.role,
      caller.departmentIds,
      caller.leadsDepartmentIds
    );
    if (!canManage) {
      return NextResponse.json(
        {
          error: `Forbidden: Only the ${config.coordinatorLabel} can post ${config.audienceLabel.toLowerCase()} devotionals`,
        },
        { status: 403 }
      );
    }

    if (!title || !content || !weekStartDate) {
      return NextResponse.json(
        { error: "Missing required fields: title, content, weekStartDate" },
        { status: 400 }
      );
    }

    const now = new Date();
    const devData = {
      scope,
      title: String(title).trim(),
      content: String(content).trim(),
      weekStartDate: String(weekStartDate),
      scriptureReference: scriptureReference
        ? String(scriptureReference).trim()
        : null,
      authorId: caller.uid,
      authorName: caller.name,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await adminDb.collection("devotionals").add(devData);

    // Notify every active member of the target department so the whole
    // audience sees this week's focus.
    const deptId = await getDeptIdByName(config.departmentName);
    if (deptId) {
      const membersSnap = await adminDb
        .collection("users")
        .where("departmentIds", "array-contains", deptId)
        .where("isActive", "==", true)
        .get();

      for (const memberDoc of membersSnap.docs) {
        if (memberDoc.id === caller.uid) continue;
        createNotificationWithEmail({
          userId: memberDoc.id,
          title: `This week's devotional focus: ${devData.title}`,
          message: devData.content.slice(0, 240),
          type: "announcement",
          link: config.link,
          recipientEmail: memberDoc.data().email,
          email: {
            subject: `${config.audienceLabel} Devotional Focus: ${devData.title}`,
            text: `${devData.title}\n\n${devData.content}\n\nPosted by ${caller.name}.`,
          },
        }).catch(console.error);
      }
    }

    return NextResponse.json(
      {
        id: docRef.id,
        ...devData,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/devotionals error:", error);
    return NextResponse.json(
      { error: "Failed to create devotional" },
      { status: 500 }
    );
  }
}
