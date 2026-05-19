// Run with: npx ts-node scripts/seed.ts
// Make sure to place your service-account-key.json in the scripts/ directory

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import * as path from "path";

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, "service-account-key.json");

let serviceAccount;
try {
  serviceAccount = require(serviceAccountPath);
} catch {
  console.error("❌ Could not find service-account-key.json in scripts/ directory.");
  console.error("   Download it from Firebase Console → Project Settings → Service Accounts");
  process.exit(1);
}

const app = initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore(app);
const auth = getAuth(app);

// ─── Departments ───
const departments = [
  // Service departments
  { name: "Administration", icon: "📋", order: 1, description: "Oversees service coordination and administrative functions" },
  { name: "Intercession", icon: "🙏", order: 2, description: "Leads prayer and intercession during services" },
  { name: "Teaching & Word", icon: "📖", order: 3, description: "Bible study coordination and preaching ministry" },
  { name: "Worship & Music", icon: "🎵", order: 4, description: "Choir direction, music, and worship leading" },
  { name: "Media & Technical", icon: "🎛️", order: 5, description: "Sound engineering, visuals, and technical setup" },
  { name: "Ushering & Protocol", icon: "🚪", order: 6, description: "Ushering, protocol, and guest management" },
  { name: "Hospitality", icon: "☕", order: 7, description: "Hospitality, refreshments, and seating arrangements" },
  { name: "Visitor Engagement", icon: "🤗", order: 8, description: "First-time visitor welcome and follow-up" },
  // Ministry departments
  { name: "Events & Fellowship", icon: "🎪", order: 9, description: "Planning and coordinating youth events, approval gateway, and fellowship activities" },
  { name: "Campus Ministry", icon: "🎓", order: 10, description: "Student outreach, campus evangelism, and student registration" },
  { name: "Discipleship & Follow-Up", icon: "🤝", order: 11, description: "New believer discipleship, follow-up programs, and spiritual growth tracking" },
  { name: "Life Groups", icon: "👥", order: 12, description: "Small group fellowship, Bible study circles, and community building" },
  { name: "Transport & Logistics", icon: "🚐", order: 13, description: "Coordinating transport logistics for services, events, and outreach" },
  { name: "Youth Ablaze", icon: "🔥", order: 14, description: "Intercession and prayer warfare for youth events" },
  // Departmental manager teams
  { name: "Communications & Media", icon: "📣", order: 15, description: "Announcements, social media, publicity, and external communications" },
  { name: "Fundraising", icon: "💰", order: 16, description: "Fundraising campaigns, donor relations, and financial mobilisation" },
  { name: "Food Logistics", icon: "🍽️", order: 17, description: "Meal planning, catering logistics, and food provision for events and camps" },
  { name: "Finance", icon: "🏦", order: 18, description: "Treasury oversight: confirm funds availability for departmental requests such as transport, catering, and events" },
];

// ─── Institutions ───
const institutions = [
  { name: "UNZA", order: 1 },
  { name: "Texila American University", order: 2 },
  { name: "Evelyn Hone College", order: 3 },
  { name: "Apex Medical University", order: 4 },
  { name: "NIPA", order: 5 },
  { name: "ZCAS University", order: 6 },
  { name: "Chreso University", order: 7 },
  { name: "Cavendish University", order: 8 },
  { name: "Eden University", order: 9 },
];

// ─── Service Roles with Email Templates ───
const roles = [
  {
    name: "Moderator",
    department: "Administration",
    reminderSchedule: ["MONDAY", "THURSDAY", "SATURDAY"],
    arrivalTime: "9:45 AM",
    timeSlot: null,
    order: 1,
    emailSubject: "📢 MC Assignment – Potter's Wheel | {{ServiceDate}}",
    emailBody: `Greetings {{Name}} 🙏🏾

You have been assigned to MODERATE (MC) Potter's Wheel Service.

📅 Date: {{ServiceDate}}
📌 Theme: {{Theme}}
⏰ Please arrive by: 9:45 AM
📍 Venue: {{Venue}}

As Moderator, you will MC the entire service. Please review the program flow and confirm your availability.

God bless!
Dew of Hermon Youth Ministry`,
  },
  {
    name: "Intercessor",
    department: "Intercession",
    reminderSchedule: ["SATURDAY"],
    arrivalTime: "10:10 AM",
    timeSlot: "10:20 AM – 10:30 AM",
    order: 2,
    emailSubject: "🙏 Intercession Assignment – Potter's Wheel | {{ServiceDate}}",
    emailBody: `Greetings {{Name}} 🙏🏾

You are confirmed to LEAD INTERCESSION at Potter's Wheel Service.

📅 Date: {{ServiceDate}}
⏰ Time Slot: 10:20 AM – 10:30 AM
📍 Please be in position by: 10:10 AM
📍 Venue: {{Venue}}

Kindly prepare your heart and confirm your availability.

God bless!
Dew of Hermon Youth Ministry`,
  },
  {
    name: "Bible Study Coordinator",
    department: "Teaching & Word",
    reminderSchedule: ["MONDAY", "THURSDAY"],
    arrivalTime: "10:00 AM",
    timeSlot: "10:45 AM – 11:15 AM",
    order: 3,
    emailSubject: "📖 Bible Study Assignment – Potter's Wheel | {{ServiceDate}}",
    emailBody: `Greetings {{Name}} 🙏🏾

You are leading BIBLE STUDY at Potter's Wheel Service.

📅 Date: {{ServiceDate}}
📌 Theme: {{Theme}}
⏰ Time Slot: 10:45 AM – 11:15 AM
📍 Venue: {{Venue}}

Please prepare your study material and confirm your availability.

God bless!
Dew of Hermon Youth Ministry`,
  },
  {
    name: "Preacher",
    department: "Teaching & Word",
    reminderSchedule: ["MONDAY", "THURSDAY"],
    arrivalTime: "10:00 AM",
    timeSlot: "11:45 AM – 12:25 PM",
    order: 4,
    emailSubject: "🎤 Preaching Assignment – Potter's Wheel | {{ServiceDate}}",
    emailBody: `Greetings {{Name}} 🙏🏾

You are scheduled to PREACH at Potter's Wheel Service.

📅 Date: {{ServiceDate}}
📌 Theme: {{Theme}}
⏰ Time Slot: 11:45 AM – 12:25 PM
📍 Venue: {{Venue}}

We are believing God for a powerful word through you! Please confirm your readiness.

God bless!
Dew of Hermon Youth Ministry`,
  },
  {
    name: "Choir Director",
    department: "Worship & Music",
    reminderSchedule: ["THURSDAY"],
    arrivalTime: "9:45 AM",
    timeSlot: null,
    order: 5,
    emailSubject: "🎶 Choir Direction – Potter's Wheel | {{ServiceDate}}",
    emailBody: `Greetings {{Name}} 🙏🏾

You are directing the CHOIR/WORSHIP at Potter's Wheel Service.

📅 Date: {{ServiceDate}}
⏰ Sound check by: 9:45 AM
📍 Venue: {{Venue}}

Please coordinate with the Music Director and brief your choir team. Confirm by replying.

God bless!
Dew of Hermon Youth Ministry`,
  },
  {
    name: "Music Director",
    department: "Worship & Music",
    reminderSchedule: ["THURSDAY"],
    arrivalTime: "9:30 AM",
    timeSlot: null,
    order: 6,
    emailSubject: "🎸 Music Direction – Potter's Wheel | {{ServiceDate}}",
    emailBody: `Greetings {{Name}} 🙏🏾

You are the MUSIC DIRECTOR (instruments/band) for Potter's Wheel Service.

📅 Date: {{ServiceDate}}
⏰ Setup & sound check by: 9:30 AM
📍 Venue: {{Venue}}

Please coordinate with the Choir Director on the song list and ensure all instruments are ready.

God bless!
Dew of Hermon Youth Ministry`,
  },
  {
    name: "Sound Engineer",
    department: "Media & Technical",
    reminderSchedule: ["THURSDAY", "SATURDAY"],
    arrivalTime: "9:30 AM",
    timeSlot: null,
    order: 7,
    emailSubject: "🎛️ Sound Engineering – Potter's Wheel | {{ServiceDate}}",
    emailBody: `Greetings {{Name}} 🙏🏾

You are on SOUND ENGINEERING for Potter's Wheel Service.

📅 Date: {{ServiceDate}}
⏰ Arrive by: 9:30 AM for full setup and testing
📍 Venue: {{Venue}}

Checklist:
✅ Sound system tested
✅ Microphones checked
✅ Monitor levels set
✅ Recording ready (if applicable)

Confirm all will be ready.

God bless!
Dew of Hermon Youth Ministry`,
  },
  {
    name: "Visual Officer",
    department: "Media & Technical",
    reminderSchedule: ["THURSDAY", "SATURDAY"],
    arrivalTime: "9:30 AM",
    timeSlot: null,
    order: 8,
    emailSubject: "📺 Visual/Media Setup – Potter's Wheel | {{ServiceDate}}",
    emailBody: `Greetings {{Name}} 🙏🏾

You are the VISUAL OFFICER for Potter's Wheel Service.

📅 Date: {{ServiceDate}}
⏰ Arrive by: 9:30 AM
📍 Venue: {{Venue}}

Checklist:
✅ Projector & screen set up
✅ Slides/lyrics loaded
✅ Sermon slides ready
✅ Camera/recording set (if applicable)

Confirm by replying.

God bless!
Dew of Hermon Youth Ministry`,
  },
  {
    name: "Ushers Coordinator",
    department: "Ushering & Protocol",
    reminderSchedule: ["SATURDAY"],
    arrivalTime: "9:45 AM",
    timeSlot: null,
    order: 9,
    emailSubject: "🚪 Ushering Assignment – Potter's Wheel | {{ServiceDate}}",
    emailBody: `Greetings {{Name}} 🙏🏾

You are coordinating USHERING at Potter's Wheel Service.

📅 Date: {{ServiceDate}}
⏰ Please arrive by: 9:45 AM
📍 Venue: {{Venue}}

Checklist:
✅ Offering baskets ready
✅ Welcome/registration desk set
✅ Usher team briefed

Confirm your team is ready.

God bless!
Dew of Hermon Youth Ministry`,
  },
  {
    name: "Protocol Officer",
    department: "Ushering & Protocol",
    reminderSchedule: ["SATURDAY"],
    arrivalTime: "9:45 AM",
    timeSlot: null,
    order: 10,
    emailSubject: "🎖️ Protocol Assignment – Potter's Wheel | {{ServiceDate}}",
    emailBody: `Greetings {{Name}} 🙏🏾

You are on PROTOCOL duty for Potter's Wheel Service.

📅 Date: {{ServiceDate}}
⏰ Please arrive by: 9:45 AM
📍 Venue: {{Venue}}

Please coordinate VIP/guest seating, pastor reception, and any special arrangements. Confirm by replying.

God bless!
Dew of Hermon Youth Ministry`,
  },
  {
    name: "Hospitality Lead",
    department: "Hospitality",
    reminderSchedule: ["THURSDAY"],
    arrivalTime: "9:30 AM",
    timeSlot: null,
    order: 11,
    emailSubject: "☕ Hospitality Assignment – Potter's Wheel | {{ServiceDate}}",
    emailBody: `Greetings {{Name}} 🙏🏾

You are the HOSPITALITY LEAD for Potter's Wheel Service.

📅 Date: {{ServiceDate}}
⏰ Please arrive by: 9:30 AM
📍 Venue: {{Venue}}

Checklist:
✅ Seating arranged
✅ Water/refreshments for ministers
✅ Welcome area set up

Confirm by replying.

God bless!
Dew of Hermon Youth Ministry`,
  },
  {
    name: "Affirmations Coordinator",
    department: "Administration",
    reminderSchedule: ["MONDAY", "THURSDAY"],
    arrivalTime: null,
    timeSlot: null,
    order: 12,
    emailSubject: "✨ Potter's Wheel Affirmations – Prep Reminder | {{ServiceDate}}",
    emailBody: `Greetings {{Name}} 🙏🏾

You are preparing the POTTER'S WHEEL AFFIRMATIONS for this Sunday's service.

📅 Date: {{ServiceDate}}
📌 Theme: {{Theme}}

Please have the affirmation notes ready and shared with the Moderator by Saturday evening. Confirm your progress.

God bless!
Dew of Hermon Youth Ministry`,
  },
  {
    name: "Visitor Engagement Lead",
    department: "Visitor Engagement",
    reminderSchedule: ["THURSDAY"],
    arrivalTime: "10:00 AM",
    timeSlot: null,
    order: 13,
    emailSubject: "🤗 Visitor Engagement – Potter's Wheel | {{ServiceDate}}",
    emailBody: `Greetings {{Name}} 🙏🏾

You are leading the VISITOR ENGAGEMENT SESSION after Potter's Wheel Service.

📅 Date: {{ServiceDate}}
📍 Venue: {{Venue}}

After the main service, you will lead an interactive welcome session with first-time visitors. Please prepare ice-breakers, ministry introduction, and have follow-up cards ready.

Confirm by replying.

God bless!
Dew of Hermon Youth Ministry`,
  },
];

// ─── Default Checklist Template ───
const defaultChecklist = [
  { task: "Moderator confirmed and briefed", category: "People & Roles", order: 1 },
  { task: "Preacher confirmed and topic received", category: "People & Roles", order: 2 },
  { task: "Bible Study Coordinator confirmed", category: "People & Roles", order: 3 },
  { task: "Intercessor confirmed", category: "People & Roles", order: 4 },
  { task: "Choir Director & team briefed", category: "Worship & Music", order: 5 },
  { task: "Music Director & instruments ready", category: "Worship & Music", order: 6 },
  { task: "Sound system tested", category: "Sound & Media", order: 7 },
  { task: "Microphones checked", category: "Sound & Media", order: 8 },
  { task: "Projector & slides ready", category: "Sound & Media", order: 9 },
  { task: "Camera/recording set up", category: "Sound & Media", order: 10 },
  { task: "Ushering team briefed", category: "Logistics", order: 11 },
  { task: "Offering baskets prepared", category: "Logistics", order: 12 },
  { task: "Seating arrangement done", category: "Logistics", order: 13 },
  { task: "Welcome/registration desk set", category: "Logistics", order: 14 },
  { task: "Refreshments prepared", category: "Hospitality", order: 15 },
  { task: "Water for ministers ready", category: "Hospitality", order: 16 },
  { task: "Affirmation notes ready", category: "Content", order: 17 },
  { task: "Program flow printed/shared", category: "Content", order: 18 },
  { task: "Visitor engagement materials ready", category: "Visitor Engagement", order: 19 },
  { task: "Follow-up cards prepared", category: "Visitor Engagement", order: 20 },
];

async function seed() {
  console.log("🏺 Seeding Potter's Wheel database...\n");

  // 1. Create departments
  console.log("📋 Creating departments...");
  const deptMap: Record<string, string> = {};

  for (const dept of departments) {
    const ref = db.collection("departments").doc();
    await ref.set({
      name: dept.name,
      description: dept.description,
      icon: dept.icon,
      order: dept.order,
      createdAt: new Date(),
    });
    deptMap[dept.name] = ref.id;
    console.log(`  ✅ ${dept.icon} ${dept.name} (${ref.id})`);
  }

  // 2. Create service roles with email templates
  console.log("\n🎭 Creating service roles...");

  for (const role of roles) {
    const ref = db.collection("serviceRoles").doc();
    await ref.set({
      name: role.name,
      departmentId: deptMap[role.department],
      description: null,
      emailSubject: role.emailSubject,
      emailBody: role.emailBody,
      reminderSchedule: role.reminderSchedule,
      arrivalTime: role.arrivalTime,
      timeSlot: role.timeSlot,
      order: role.order,
    });
    console.log(`  ✅ ${role.name} → ${role.department}`);
  }

  // 3. Create default super admin user
  console.log("\n👤 Creating super admin user...");

  try {
    const adminUser = await auth.createUser({
      email: "admin@potterswheel.com",
      password: "ChangeMeOnFirstLogin!",
      displayName: "Admin (Chairperson)",
    });

    await db.collection("users").doc(adminUser.uid).set({
      name: "Admin (Chairperson)",
      email: "admin@potterswheel.com",
      phone: null,
      role: "SUPER_ADMIN",
      departmentIds: [],
      leadsDepartmentIds: [],
      profileImage: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`  ✅ Super Admin created`);
    console.log(`     Email: admin@potterswheel.com`);
    console.log(`     Password: ChangeMeOnFirstLogin!`);
  } catch (err: any) {
    if (err.code === "auth/email-already-exists") {
      console.log(`  ⚠️  Admin user already exists, skipping...`);
    } else {
      throw err;
    }
  }

  // 4. Store default checklist template
  console.log("\n✅ Storing default checklist template...");
  await db.collection("settings").doc("checklistTemplate").set({
    items: defaultChecklist,
    updatedAt: new Date(),
  });
  console.log(`  ✅ ${defaultChecklist.length} checklist items stored`);

  // 5. Seed institutions
  console.log("\n🎓 Seeding institutions...");
  for (const inst of institutions) {
    const ref = db.collection("institutions").doc();
    await ref.set({
      name: inst.name,
      isActive: true,
      order: inst.order,
      createdAt: new Date(),
    });
    console.log(`  ✅ ${inst.name}`);
  }

  // 6. Seed Life Group settings
  console.log("\n👥 Seeding Life Group settings...");
  await db.collection("settings").doc("lifeGroups").set({
    groups: [
      { key: "BRIDGE", name: "Bridge", ageRange: "15-20 years", order: 1 },
      { key: "ANCHOR", name: "Anchor", ageRange: "21-25 years", order: 2 },
      { key: "CORNERSTONE", name: "Cornerstone", ageRange: "26+ years", order: 3 },
    ],
    updatedAt: new Date(),
  });
  console.log("  ✅ Life Group settings stored");

  console.log("\n🎉 Seed complete!");
  console.log("\n═══════════════════════════════════════════");
  console.log("  📊 Summary:");
  console.log(`  • ${departments.length} departments created`);
  console.log(`  • ${roles.length} service roles created`);
  console.log(`  • 1 super admin user created`);
  console.log(`  • ${defaultChecklist.length} checklist items templated`);
  console.log(`  • ${institutions.length} institutions created`);
  console.log(`  • Life Group settings stored`);
  console.log("═══════════════════════════════════════════");
  console.log("\n⚠️  IMPORTANT: Change the admin password on first login!");
  console.log("📧 Login with: admin@potterswheel.com / ChangeMeOnFirstLogin!\n");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
