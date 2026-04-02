import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { hasMinRole } from "@/lib/permissions";
import { UserRole } from "@/types";

export const dynamic = "force-dynamic";

async function getCaller(): Promise<{
  uid: string;
  role: UserRole;
  leadsDepartmentIds: string[];
} | null> {
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
      leadsDepartmentIds: data.leadsDepartmentIds || [],
    };
  } catch {
    return null;
  }
}

function canAccessDepartment(
  caller: { role: UserRole; leadsDepartmentIds: string[] },
  departmentId: string
): boolean {
  if (hasMinRole(caller.role, "ADMIN")) return true;
  return caller.leadsDepartmentIds.includes(departmentId);
}

// GET /api/department-tasks?departmentId=xxx
export async function GET(request: Request) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");

    if (!departmentId) {
      return NextResponse.json({ error: "departmentId is required" }, { status: 400 });
    }

    if (!canAccessDepartment(caller, departmentId)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const snapshot = await adminDb
      .collection("departmentTasks")
      .where("departmentId", "==", departmentId)
      .orderBy("createdAt", "desc")
      .get();

    const tasks = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        dueDate: data.dueDate?.toDate?.()?.toISOString() || null,
        completedAt: data.completedAt?.toDate?.()?.toISOString() || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("GET /api/department-tasks error:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

// POST /api/department-tasks
export async function POST(request: Request) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const { departmentId, title, description, priority, assigneeId, assigneeName, dueDate } = body;

    if (!departmentId || !title) {
      return NextResponse.json({ error: "departmentId and title are required" }, { status: 400 });
    }

    if (!canAccessDepartment(caller, departmentId)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Get caller name
    const callerDoc = await adminDb.collection("users").doc(caller.uid).get();
    const callerName = callerDoc.data()?.name || "Unknown";

    const now = new Date();
    const taskData = {
      departmentId,
      title,
      description: description || null,
      status: "TODO",
      priority: priority || "MEDIUM",
      assigneeId: assigneeId || null,
      assigneeName: assigneeName || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      createdBy: caller.uid,
      createdByName: callerName,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const ref = await adminDb.collection("departmentTasks").add(taskData);

    return NextResponse.json({
      task: {
        id: ref.id,
        ...taskData,
        dueDate: taskData.dueDate?.toISOString() || null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    });
  } catch (error) {
    console.error("POST /api/department-tasks error:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}

// PATCH /api/department-tasks (update a task)
export async function PATCH(request: Request) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const { taskId, ...updates } = body;

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    const taskDoc = await adminDb.collection("departmentTasks").doc(taskId).get();
    if (!taskDoc.exists) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const taskData = taskDoc.data()!;
    if (!canAccessDepartment(caller, taskData.departmentId)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const allowedFields = ["title", "description", "status", "priority", "assigneeId", "assigneeName", "dueDate"];
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    for (const field of allowedFields) {
      if (field in updates) {
        if (field === "dueDate") {
          updateData[field] = updates[field] ? new Date(updates[field]) : null;
        } else {
          updateData[field] = updates[field];
        }
      }
    }

    // If status changed to DONE, set completedAt
    if (updates.status === "DONE" && taskData.status !== "DONE") {
      updateData.completedAt = new Date();
    }
    if (updates.status && updates.status !== "DONE") {
      updateData.completedAt = null;
    }

    await adminDb.collection("departmentTasks").doc(taskId).update(updateData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/department-tasks error:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

// DELETE /api/department-tasks?taskId=xxx
export async function DELETE(request: Request) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    const taskDoc = await adminDb.collection("departmentTasks").doc(taskId).get();
    if (!taskDoc.exists) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const taskData = taskDoc.data()!;
    if (!canAccessDepartment(caller, taskData.departmentId)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    await adminDb.collection("departmentTasks").doc(taskId).delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/department-tasks error:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
