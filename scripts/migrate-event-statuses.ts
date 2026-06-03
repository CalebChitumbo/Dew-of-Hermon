// Run with: npx ts-node scripts/migrate-event-statuses.ts
//
// One-off, idempotent migration that maps in-flight events from the old
// single "PENDING_APPROVAL" status onto the new multi-tier state machine:
//   - PENDING_APPROVAL with an already-routed stakeholder request
//       -> PENDING_STAKEHOLDERS (the Events Lead is gathering confirmations)
//   - PENDING_APPROVAL with nothing routed yet
//       -> PENDING_DISPATCH (awaiting the Events Lead's dispatch)
// DRAFT / APPROVED / REJECTED / CHANGES_REQUESTED are left untouched.
//
// Safe to re-run. Make sure to place your service-account-key.json in scripts/.

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as path from "path";

const serviceAccountPath = path.join(__dirname, "service-account-key.json");

let serviceAccount;
try {
  serviceAccount = require(serviceAccountPath);
} catch {
  console.error("Could not find service-account-key.json in scripts/ directory.");
  console.error("   Download it from Firebase Console -> Project Settings -> Service Accounts");
  process.exit(1);
}

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function main(): Promise<void> {
  const snap = await db
    .collection("events")
    .where("approvalStatus", "==", "PENDING_APPROVAL")
    .get();

  if (snap.empty) {
    console.log("No PENDING_APPROVAL events to migrate. Done.");
    process.exit(0);
  }

  let dispatched = 0;
  let stakeholders = 0;
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    for (const doc of snap.docs.slice(i, i + 400)) {
      const data = doc.data();
      const alreadyRouted = Boolean(
        data.transportRequestId ||
          data.budgetRequestId ||
          data.mediaRequestId ||
          data.foodRequestId
      );
      const next = alreadyRouted ? "PENDING_STAKEHOLDERS" : "PENDING_DISPATCH";
      if (alreadyRouted) stakeholders++;
      else dispatched++;
      batch.update(doc.ref, { approvalStatus: next, updatedAt: new Date() });
    }
    await batch.commit();
  }

  console.log(
    `Migrated ${snap.size} event(s): ${dispatched} -> PENDING_DISPATCH, ${stakeholders} -> PENDING_STAKEHOLDERS.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Event status migration failed:", err);
  process.exit(1);
});
