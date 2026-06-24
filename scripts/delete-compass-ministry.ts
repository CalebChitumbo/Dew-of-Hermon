// Run with: npm run delete:compass-ministry
//   (or:    npx ts-node scripts/delete-compass-ministry.ts)
//
// One-off, idempotent cleanup that removes the stray "Compass Ministry"
// department. The correctly-spelled "Campus Ministry" department is left
// untouched. The script also strips the deleted department's id from every
// user's departmentIds / leadsDepartmentIds so no dangling references remain.
//
// Safe to re-run: if no "Compass Ministry" department exists, it exits cleanly.
// Make sure to place your service-account-key.json in scripts/.

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as path from "path";

const TARGET_NAME = "Compass Ministry";

const serviceAccountPath = path.join(__dirname, "service-account-key.json");

let serviceAccount;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  serviceAccount = require(serviceAccountPath);
} catch {
  console.error("Could not find service-account-key.json in scripts/ directory.");
  console.error(
    "   Download it from Firebase Console -> Project Settings -> Service Accounts"
  );
  process.exit(1);
}

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function main(): Promise<void> {
  const deptSnap = await db
    .collection("departments")
    .where("name", "==", TARGET_NAME)
    .get();

  if (deptSnap.empty) {
    console.log(`No "${TARGET_NAME}" department found. Nothing to delete.`);
    process.exit(0);
  }

  const deptIds = deptSnap.docs.map((d) => d.id);
  console.log(
    `Found ${deptIds.length} "${TARGET_NAME}" department(s): ${deptIds.join(", ")}`
  );

  // 1. Strip the department id from any users that still reference it, so we
  //    don't leave dangling memberships / leaderships behind.
  let referencesCleaned = 0;
  for (const deptId of deptIds) {
    for (const field of ["departmentIds", "leadsDepartmentIds"] as const) {
      const usersSnap = await db
        .collection("users")
        .where(field, "array-contains", deptId)
        .get();
      for (let i = 0; i < usersSnap.docs.length; i += 400) {
        const batch = db.batch();
        for (const userDoc of usersSnap.docs.slice(i, i + 400)) {
          batch.update(userDoc.ref, { [field]: FieldValue.arrayRemove(deptId) });
          referencesCleaned++;
        }
        await batch.commit();
      }
    }
  }

  // 2. Delete the department document(s).
  const deleteBatch = db.batch();
  for (const doc of deptSnap.docs) deleteBatch.delete(doc.ref);
  await deleteBatch.commit();

  console.log(
    `Deleted ${deptIds.length} department(s) and cleaned ${referencesCleaned} user reference(s). Done.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
