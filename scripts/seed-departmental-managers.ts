// Run with: npx ts-node scripts/seed-departmental-managers.ts
//
// Idempotent migration that ensures the "Departmental Manager" departments
// listed in the Super Admin role management UI exist in Firestore.
// Adds only the ones that are missing; existing departments are left untouched.
//
// Make sure to place your service-account-key.json in the scripts/ directory.

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

const departmentalManagerDepartments = [
  {
    name: "Fundraising",
    icon: "💰",
    order: 16,
    description:
      "Fundraising campaigns, donor relations, and financial mobilisation",
  },
  {
    name: "Food Logistics",
    icon: "🍽️",
    order: 17,
    description:
      "Meal planning, catering logistics, and food provision for events and camps",
  },
];

async function run() {
  console.log("Seeding departmental-manager departments...\n");

  const snapshot = await db.collection("departments").get();
  const existingNames = new Set(
    snapshot.docs.map((d) => (d.data().name ?? "") as string)
  );

  let created = 0;
  let skipped = 0;

  for (const dept of departmentalManagerDepartments) {
    if (existingNames.has(dept.name)) {
      console.log(`  - ${dept.icon} ${dept.name} already exists, skipping`);
      skipped++;
      continue;
    }

    const ref = db.collection("departments").doc();
    await ref.set({
      name: dept.name,
      description: dept.description,
      icon: dept.icon,
      order: dept.order,
      createdAt: new Date(),
    });
    console.log(`  + ${dept.icon} ${dept.name} created (${ref.id})`);
    created++;
  }

  console.log("\nDone.");
  console.log(`  ${created} created, ${skipped} skipped`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
