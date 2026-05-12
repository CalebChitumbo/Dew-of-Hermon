import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { canPlanBraai, getCaller } from "../_auth";
import { FUNDRAISING_DEPARTMENT_NAME } from "@/lib/braai";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const caller = await getCaller(request);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await canPlanBraai(caller))) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Resolve the Fundraising department by name.
    const deptSnap = await adminDb
      .collection("departments")
      .where("name", "==", FUNDRAISING_DEPARTMENT_NAME)
      .limit(1)
      .get();

    if (deptSnap.empty) {
      return NextResponse.json({ members: [], departmentId: null });
    }
    const departmentId = deptSnap.docs[0].id;

    // Members and leads of the Fundraising department.
    const membersSnap = await adminDb
      .collection("users")
      .where("departmentIds", "array-contains", departmentId)
      .get();
    const leadsSnap = await adminDb
      .collection("users")
      .where("leadsDepartmentIds", "array-contains", departmentId)
      .get();

    const map = new Map<
      string,
      {
        id: string;
        name: string;
        email: string;
        phone: string | null;
        role: string;
        isLead: boolean;
        isActive: boolean;
      }
    >();
    for (const docSnap of [...membersSnap.docs, ...leadsSnap.docs]) {
      const data = docSnap.data();
      if (data.isActive === false) continue;
      const existing = map.get(docSnap.id);
      map.set(docSnap.id, {
        id: docSnap.id,
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || null,
        role: data.role || "MEMBER",
        isLead:
          existing?.isLead ||
          (Array.isArray(data.leadsDepartmentIds) &&
            data.leadsDepartmentIds.includes(departmentId)),
        isActive: data.isActive ?? true,
      });
    }

    const members = Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return NextResponse.json({ members, departmentId });
  } catch (error) {
    console.error("Error fetching fundraising members:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to load department members", details: message },
      { status: 500 }
    );
  }
}
