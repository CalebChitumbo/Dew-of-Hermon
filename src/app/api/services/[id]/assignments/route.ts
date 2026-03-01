import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { canAssignAnyRole, canAssignOwnDeptRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";
import { UserRole } from "@/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const assignmentsSnapshot = await adminDb
      .collection("serviceAssignments")
      .where("serviceId", "==", id)
      .get();

    const assignments = assignmentsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        serviceId: data.serviceId,
        roleId: data.roleId,
        roleName: data.roleName,
        userId: data.userId,
        userName: data.userName,
        userEmail: data.userEmail,
        userPhone: data.userPhone || null,
        status: data.status,
        emailSent: data.emailSent || false,
        emailSentAt: data.emailSentAt?.toDate?.()?.toISOString() || null,
        confirmedAt: data.confirmedAt?.toDate?.()?.toISOString() || null,
        notes: data.notes || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    });

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error("Error fetching assignments:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: serviceId } = await params;
    const body = await request.json();
    const { roleId, userId, callerRole } = body;

    // Permission check
    if (!callerRole) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const role = callerRole as UserRole;
    if (!canAssignAnyRole(role) && !canAssignOwnDeptRole(role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    if (!roleId || !userId) {
      return NextResponse.json(
        { error: "Role ID and User ID are required" },
        { status: 400 }
      );
    }

    // Verify the service exists
    const serviceDoc = await adminDb.collection("services").doc(serviceId).get();
    if (!serviceDoc.exists) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    // Use a Firestore transaction for conflict detection
    const result = await adminDb.runTransaction(async (transaction) => {
      // Check 1: Is this person already assigned to ANY role in this service?
      const userAssignmentsQuery = adminDb
        .collection("serviceAssignments")
        .where("serviceId", "==", serviceId)
        .where("userId", "==", userId);

      const userAssignments = await transaction.get(userAssignmentsQuery);
      if (!userAssignments.empty) {
        const existingRole = userAssignments.docs[0].data().roleName;
        return {
          error: `This person is already assigned as "${existingRole}" in this service. Each person can only fill one role per service.`,
          status: 409,
        };
      }

      // Check 2: Is this role already filled in this service?
      const roleAssignmentsQuery = adminDb
        .collection("serviceAssignments")
        .where("serviceId", "==", serviceId)
        .where("roleId", "==", roleId);

      const roleAssignments = await transaction.get(roleAssignmentsQuery);
      if (!roleAssignments.empty) {
        const existingPerson = roleAssignments.docs[0].data().userName;
        return {
          error: `This role is already assigned to ${existingPerson}. Remove the existing assignment first.`,
          status: 409,
        };
      }

      // Fetch the service role details for denormalization
      const roleDoc = await transaction.get(
        adminDb.collection("serviceRoles").doc(roleId)
      );
      if (!roleDoc.exists) {
        return { error: "Service role not found", status: 404 };
      }
      const roleData = roleDoc.data()!;

      // Fetch the user details for denormalization
      const userDoc = await transaction.get(
        adminDb.collection("users").doc(userId)
      );
      if (!userDoc.exists) {
        return { error: "User not found", status: 404 };
      }
      const userData = userDoc.data()!;

      const now = new Date();
      const assignmentRef = adminDb.collection("serviceAssignments").doc();

      const assignmentData = {
        serviceId,
        roleId,
        roleName: roleData.name,
        userId,
        userName: userData.name,
        userEmail: userData.email,
        userPhone: userData.phone || null,
        status: "PENDING",
        emailSent: false,
        emailSentAt: null,
        confirmedAt: null,
        notes: null,
        createdAt: now,
        updatedAt: now,
      };

      transaction.set(assignmentRef, assignmentData);

      return {
        assignment: {
          id: assignmentRef.id,
          ...assignmentData,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
        status: 201,
      };
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json(
      { assignment: result.assignment },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error creating assignment:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create assignment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
