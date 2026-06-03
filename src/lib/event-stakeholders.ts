import { adminDb } from "@/lib/firebase-admin";
import {
  createTransportRequest,
  notifyTransportCoordinators,
  cancelTransportRequestForEvent,
} from "@/lib/transport-helpers";
import {
  createBudgetRequest,
  notifyTreasurersOfBudgetRequest,
  transitionBudgetRequest,
} from "@/lib/budget-helpers";
import {
  createMediaRequest,
  notifyMediaCoordinators,
  cancelMediaRequestForEvent,
} from "@/lib/media-helpers";
import {
  createFoodRequest,
  notifyFoodLeads,
  cancelFoodRequestForEvent,
} from "@/lib/food-helpers";

function toDate(val: unknown): Date {
  if (val instanceof Date) return val;
  if (val && typeof val === "object" && "toDate" in val) {
    return (val as { toDate: () => Date }).toDate();
  }
  return new Date();
}

async function getStatus(
  collection: string,
  id: string | null | undefined
): Promise<string | null> {
  if (!id) return null;
  const doc = await adminDb.collection(collection).doc(id).get();
  return doc.exists ? (doc.data()?.status ?? null) : null;
}

/**
 * Create requests for every flagged-and-not-yet-created stakeholder resource on
 * an event (transport, budget, media, food) and notify each stakeholder.
 * Idempotent: resources that already have a request id are skipped.
 */
export async function dispatchStakeholderRequests(
  eventId: string,
  actor: { uid: string; name: string }
): Promise<{ created: string[]; skipped: string[] }> {
  const eventDoc = await adminDb.collection("events").doc(eventId).get();
  if (!eventDoc.exists) throw new Error("Event not found");
  const e = eventDoc.data()!;
  const title: string = e.title;
  const startDate = toDate(e.startDate);

  const created: string[] = [];
  const skipped: string[] = [];

  if (e.transportRequired) {
    if (e.transportRequestId) {
      skipped.push("transport");
    } else {
      await createTransportRequest({
        eventId,
        eventTitle: title,
        eventStartDate: startDate,
        needsDescription: e.transportNeeds || "",
        routedBy: actor.uid,
        routedByName: actor.name,
      }).then((reqId) => notifyTransportCoordinators(reqId, title));
      created.push("transport");
    }
  }

  if (e.budgetRequested) {
    if (e.budgetRequestId) {
      skipped.push("budget");
    } else {
      const reqId = await createBudgetRequest({
        eventId,
        eventTitle: title,
        eventStartDate: startDate,
        requestedAmount: Number(e.budgetAmount) || 0,
        currency: e.budgetCurrency || "",
        purpose: e.budgetPurpose || "",
        requestedBy: actor.uid,
        requestedByName: actor.name,
      });
      notifyTreasurersOfBudgetRequest(
        reqId,
        title,
        Number(e.budgetAmount) || 0,
        e.budgetCurrency || ""
      ).catch(console.error);
      created.push("budget");
    }
  }

  if (e.mediaRequired) {
    if (e.mediaRequestId) {
      skipped.push("media");
    } else {
      await createMediaRequest({
        eventId,
        eventTitle: title,
        eventStartDate: startDate,
        needsDescription: e.mediaNeeds || "",
        routedBy: actor.uid,
        routedByName: actor.name,
      }).then((reqId) => notifyMediaCoordinators(reqId, title));
      created.push("media");
    }
  }

  if (e.foodRequired) {
    if (e.foodRequestId) {
      skipped.push("food");
    } else {
      await createFoodRequest({
        eventId,
        eventTitle: title,
        eventStartDate: startDate,
        needsDescription: e.foodNeeds || "",
        routedBy: actor.uid,
        routedByName: actor.name,
      }).then((reqId) => notifyFoodLeads(reqId, title));
      created.push("food");
    }
  }

  return { created, skipped };
}

/**
 * Cancel every still-open stakeholder request for an event (transport, media,
 * food, and all pending budget requests — direct and food-originated). Called
 * when an event is rejected at any approval tier. Safe when nothing exists.
 */
export async function cancelAllStakeholderRequests(
  eventId: string,
  actor: { uid: string; name: string },
  reason: string
): Promise<void> {
  const eventDoc = await adminDb.collection("events").doc(eventId).get();
  if (!eventDoc.exists) return;
  const e = eventDoc.data()!;

  if (e.transportRequired && e.transportRequestId) {
    await cancelTransportRequestForEvent(eventId, actor, reason).catch(console.error);
  }
  if (e.mediaRequired && e.mediaRequestId) {
    await cancelMediaRequestForEvent(eventId, actor, reason).catch(console.error);
  }
  if (e.foodRequired && e.foodRequestId) {
    await cancelFoodRequestForEvent(eventId, actor, reason).catch(console.error);
  }
  try {
    const snap = await adminDb
      .collection("budgetRequests")
      .where("eventId", "==", eventId)
      .get();
    for (const d of snap.docs) {
      if (d.data().status === "PENDING_TREASURER") {
        await transitionBudgetRequest(d.id, "CANCELLED", actor, reason).catch(
          console.error
        );
      }
    }
  } catch (err) {
    console.error("Failed to cancel budget requests:", err);
  }
}

/**
 * Whether every flagged stakeholder request for an event is in its terminal,
 * approvable state. Returns the list of human-readable blockers (empty = ready).
 * Mirrors the existing transport/budget gates and extends them to media/food.
 */
export async function getStakeholderBlockers(eventId: string): Promise<string[]> {
  const eventDoc = await adminDb.collection("events").doc(eventId).get();
  if (!eventDoc.exists) return ["Event not found"];
  const e = eventDoc.data()!;
  const blockers: string[] = [];

  if (e.transportRequired) {
    if (!e.transportRequestId) {
      blockers.push("Transport has not been dispatched yet.");
    } else {
      const status = await getStatus("transportRequests", e.transportRequestId);
      if (status !== "APPROVED") {
        blockers.push(
          `Transport is not yet treasurer-approved (currently ${status ?? "missing"}).`
        );
      }
    }
  }

  if (e.budgetRequested) {
    if (!e.budgetRequestId) {
      blockers.push("Funds request has not been dispatched yet.");
    } else {
      const status = await getStatus("budgetRequests", e.budgetRequestId);
      if (status === "PENDING_TREASURER") {
        blockers.push("Funds request is still awaiting the treasurer's review.");
      }
    }
  }

  if (e.mediaRequired) {
    if (!e.mediaRequestId) {
      blockers.push("Media has not been dispatched yet.");
    } else {
      const status = await getStatus("mediaRequests", e.mediaRequestId);
      if (status !== "CONFIRMED") {
        blockers.push(
          `Media is not yet confirmed (currently ${status ?? "missing"}).`
        );
      }
    }
  }

  if (e.foodRequired) {
    if (!e.foodRequestId) {
      blockers.push("Food has not been dispatched yet.");
    } else {
      const foodDoc = await adminDb.collection("foodRequests").doc(e.foodRequestId).get();
      const foodStatus = foodDoc.exists ? foodDoc.data()?.status : null;
      if (foodStatus !== "CONFIRMED") {
        blockers.push(
          `Food is not yet confirmed (currently ${foodStatus ?? "missing"}).`
        );
      } else {
        const foodBudgetId = foodDoc.data()?.budgetRequestId;
        if (foodBudgetId) {
          const bStatus = await getStatus("budgetRequests", foodBudgetId);
          if (bStatus === "PENDING_TREASURER") {
            blockers.push(
              "Catering funds request is still awaiting the treasurer's review."
            );
          }
        }
      }
    }
  }

  return blockers;
}
