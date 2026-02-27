import { adminDb } from "./firebase-admin";

export async function assignRole(
  serviceId: string,
  roleId: string,
  userId: string
): Promise<{ success: boolean; error?: string; warning?: string }> {
  return adminDb.runTransaction(async (transaction) => {
    const assignmentsRef = adminDb
      .collection("services")
      .doc(serviceId)
      .collection("assignments");

    // CHECK 1: Is this person already assigned to ANY role in this service?
    const userAssignments = await transaction.get(
      assignmentsRef.where("userId", "==", userId)
    );

    if (!userAssignments.empty) {
      const existing = userAssignments.docs[0].data();
      return {
        success: false,
        error: `${existing.userName} is already assigned as ${existing.roleName} for this service. Each person can only have ONE role per service.`,
      };
    }

    // CHECK 2: Is this role already filled by someone else?
    const roleAssignments = await transaction.get(
      assignmentsRef.where("roleId", "==", roleId)
    );

    if (!roleAssignments.empty) {
      const existing = roleAssignments.docs[0].data();
      return {
        success: false,
        error: `The ${existing.roleName} role is already assigned to ${existing.userName}. Remove them first.`,
      };
    }

    // CHECK 3: Is the user available? (warning, not blocking)
    const serviceDoc = await transaction.get(
      adminDb.collection("services").doc(serviceId)
    );
    const serviceData = serviceDoc.data();

    let warning: string | undefined;

    if (serviceData?.eventId) {
      const eventDoc = await transaction.get(
        adminDb.collection("events").doc(serviceData.eventId)
      );
      const eventData = eventDoc.data();

      if (eventData?.startDate) {
        const serviceDate = eventData.startDate.toDate();
        const dateStr = serviceDate.toISOString().split("T")[0];

        const availabilityDoc = await transaction.get(
          adminDb
            .collection("users")
            .doc(userId)
            .collection("availabilities")
            .doc(dateStr)
        );

        if (availabilityDoc.exists && !availabilityDoc.data()?.available) {
          warning = `Note: This person marked themselves as unavailable (${availabilityDoc.data()?.reason || "no reason given"}). Assigning anyway.`;
        }
      }
    }

    // ALL CLEAR — Fetch user and role data for denormalization
    const userDoc = await transaction.get(
      adminDb.collection("users").doc(userId)
    );
    const roleDoc = await transaction.get(
      adminDb.collection("serviceRoles").doc(roleId)
    );

    if (!userDoc.exists) {
      return { success: false, error: "User not found." };
    }
    if (!roleDoc.exists) {
      return { success: false, error: "Service role not found." };
    }

    const user = userDoc.data()!;
    const role = roleDoc.data()!;

    // Create the assignment
    const newAssignmentRef = assignmentsRef.doc();
    transaction.set(newAssignmentRef, {
      roleId,
      roleName: role.name,
      userId,
      userName: user.name,
      userEmail: user.email,
      userPhone: user.phone || null,
      status: "PENDING",
      emailSent: false,
      emailSentAt: null,
      confirmedAt: null,
      notes: warning || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { success: true, warning };
  });
}

export async function removeAssignment(
  serviceId: string,
  assignmentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await adminDb
      .collection("services")
      .doc(serviceId)
      .collection("assignments")
      .doc(assignmentId)
      .delete();

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to remove assignment";
    return { success: false, error: message };
  }
}

export async function updateAssignmentStatus(
  serviceId: string,
  assignmentId: string,
  status: "CONFIRMED" | "DECLINED",
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const assignmentRef = adminDb
      .collection("services")
      .doc(serviceId)
      .collection("assignments")
      .doc(assignmentId);

    const assignmentDoc = await assignmentRef.get();

    if (!assignmentDoc.exists) {
      return { success: false, error: "Assignment not found." };
    }

    const assignment = assignmentDoc.data()!;

    if (assignment.userId !== userId) {
      return { success: false, error: "You can only update your own assignment status." };
    }

    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };

    if (status === "CONFIRMED") {
      updateData.confirmedAt = new Date();
    }

    await assignmentRef.update(updateData);

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update status";
    return { success: false, error: message };
  }
}
