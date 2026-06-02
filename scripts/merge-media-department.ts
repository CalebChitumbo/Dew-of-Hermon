// Run with: npx ts-node scripts/merge-media-department.ts
//
// Idempotent migration that merges the two media departments
// ("Media & Technical" and "Communications & Media") into a single
// department named "Media". It:
//   1. Renames the survivor "Media & Technical" -> "Media" (or creates it).
//   2. Migrates every user's departmentIds / leadsDepartmentIds from the
//      retiree "Communications & Media" to "Media" (de-duplicated).
//   3. Repoints serviceRoles / eventDepartmentRoles / departmentTasks that
//      referenced the retiree department.
//   4. Deletes the retiree department.
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

const SURVIVOR_OLD_NAME = "Media & Technical";
const SURVIVOR_NEW_NAME = "Media";
const RETIREE_NAME = "Communications & Media";
const SURVIVOR_DESCRIPTION =
  "Sound engineering, visuals, technical setup, publicity, and media coverage for services and events";

async function findDeptIdByName(name: string): Promise<string | null> {
  const snap = await db
    .collection("departments")
    .where("name", "==", name)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

// Apply update() to many docs, committing in batches under the 500-op limit.
async function updateInChunks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  refs: { ref: FirebaseFirestore.DocumentReference; data: any }[]
): Promise<void> {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    for (const { ref, data } of refs.slice(i, i + 400)) batch.update(ref, data);
    await batch.commit();
  }
}

async function main(): Promise<void> {
  // 1. Resolve the survivor "Media", renaming "Media & Technical" if present.
  let survivorId = await findDeptIdByName(SURVIVOR_NEW_NAME);
  if (survivorId) {
    console.log(`Survivor "${SURVIVOR_NEW_NAME}" already exists (${survivorId}).`);
  } else {
    const oldId = await findDeptIdByName(SURVIVOR_OLD_NAME);
    if (oldId) {
      await db
        .collection("departments")
        .doc(oldId)
        .update({ name: SURVIVOR_NEW_NAME, description: SURVIVOR_DESCRIPTION });
      survivorId = oldId;
      console.log(`Renamed "${SURVIVOR_OLD_NAME}" -> "${SURVIVOR_NEW_NAME}" (${oldId}).`);
    } else {
      const ref = await db.collection("departments").add({
        name: SURVIVOR_NEW_NAME,
        icon: "🎛️",
        order: 5,
        description: SURVIVOR_DESCRIPTION,
        createdAt: new Date(),
      });
      survivorId = ref.id;
      console.log(`Created "${SURVIVOR_NEW_NAME}" (${ref.id}).`);
    }
  }

  // 2. Find the retiree.
  const retireeId = await findDeptIdByName(RETIREE_NAME);
  if (!retireeId) {
    console.log(`No "${RETIREE_NAME}" department found — nothing to merge. Done.`);
    process.exit(0);
  }
  console.log(
    `Merging "${RETIREE_NAME}" (${retireeId}) into "${SURVIVOR_NEW_NAME}" (${survivorId}).`
  );

  // 3. Migrate user memberships / leaderships.
  const usersSnap = await db.collection("users").get();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userUpdates: { ref: FirebaseFirestore.DocumentReference; data: any }[] = [];
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    const deptIds: string[] = data.departmentIds || [];
    const leadIds: string[] = data.leadsDepartmentIds || [];
    if (!deptIds.includes(retireeId) && !leadIds.includes(retireeId)) continue;
    userUpdates.push({
      ref: doc.ref,
      data: {
        departmentIds: Array.from(
          new Set(deptIds.map((id) => (id === retireeId ? survivorId! : id)))
        ),
        leadsDepartmentIds: Array.from(
          new Set(leadIds.map((id) => (id === retireeId ? survivorId! : id)))
        ),
      },
    });
  }
  await updateInChunks(userUpdates);
  console.log(`Updated ${userUpdates.length} user(s).`);

  // 4. Repoint dependent documents that referenced the retiree department id.
  const collections: { name: string; extra: Record<string, unknown> }[] = [
    { name: "serviceRoles", extra: {} },
    { name: "eventDepartmentRoles", extra: { departmentName: SURVIVOR_NEW_NAME } },
    { name: "departmentTasks", extra: {} },
  ];
  for (const { name, extra } of collections) {
    const snap = await db
      .collection(name)
      .where("departmentId", "==", retireeId)
      .get();
    await updateInChunks(
      snap.docs.map((d) => ({ ref: d.ref, data: { departmentId: survivorId!, ...extra } }))
    );
    console.log(`Repointed ${snap.size} ${name} doc(s).`);
  }

  // 5. Delete the retiree department.
  await db.collection("departments").doc(retireeId).delete();
  console.log(`Deleted "${RETIREE_NAME}" (${retireeId}).`);

  console.log("Media department merge complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Merge failed:", err);
  process.exit(1);
});
