import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

// ─── Departments ───
const departments = [
  { name: "Administration", icon: "📋", order: 1, description: "Oversees service coordination and administrative functions" },
  { name: "Intercession", icon: "🙏", order: 2, description: "Leads prayer and intercession during services" },
  { name: "Teaching & Word", icon: "📖", order: 3, description: "Bible study coordination and preaching ministry" },
  { name: "Worship & Music", icon: "🎵", order: 4, description: "Choir direction, music, and worship leading" },
  { name: "Media & Technical", icon: "🎛️", order: 5, description: "Sound engineering, visuals, and technical setup" },
  { name: "Ushering & Protocol", icon: "🚪", order: 6, description: "Ushering, protocol, and guest management" },
  { name: "Hospitality", icon: "☕", order: 7, description: "Hospitality, refreshments, and seating arrangements" },
  { name: "Visitor Engagement", icon: "🤗", order: 8, description: "First-time visitor welcome and follow-up" },
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
    emailBody: `Greetings {{Name}} 🙏🏾\n\nYou have been assigned to MODERATE (MC) Potter's Wheel Service.\n\n📅 Date: {{ServiceDate}}\n📌 Theme: {{Theme}}\n⏰ Please arrive by: 9:45 AM\n📍 Venue: {{Venue}}\n\nAs Moderator, you will MC the entire service. Please review the program flow and confirm your availability.\n\nGod bless!\nDew of Hermon Youth Ministry`,
  },
  {
    name: "Intercessor",
    department: "Intercession",
    reminderSchedule: ["SATURDAY"],
    arrivalTime: "10:10 AM",
    timeSlot: "10:20 AM – 10:30 AM",
    order: 2,
    emailSubject: "🙏 Intercession Assignment – Potter's Wheel | {{ServiceDate}}",
    emailBody: `Greetings {{Name}} 🙏🏾\n\nYou are confirmed to LEAD INTERCESSION at Potter's Wheel Service.\n\n📅 Date: {{ServiceDate}}\n⏰ Time Slot: 10:20 AM – 10:30 AM\n📍 Please be in position by: 10:10 AM\n📍 Venue: {{Venue}}\n\nKindly prepare your heart and confirm your availability.\n\nGod bless!\nDew of Hermon Youth Ministry`,
  },
  {
    name: "Bible Study Coordinator",
    department: "Teaching & Word",
    reminderSchedule: ["MONDAY", "THURSDAY"],
    arrivalTime: "10:00 AM",
    timeSlot: "10:45 AM – 11:15 AM",
    order: 3,
    emailSubject: "📖 Bible Study Assignment – Potter's Wheel | {{ServiceDate}}",
    emailBody: `Greetings {{Name}} 🙏🏾\n\nYou are leading BIBLE STUDY at Potter's Wheel Service.\n\n📅 Date: {{ServiceDate}}\n📌 Theme: {{Theme}}\n⏰ Time Slot: 10:45 AM – 11:15 AM\n📍 Venue: {{Venue}}\n\nPlease prepare your study material and confirm your availability.\n\nGod bless!\nDew of Hermon Youth Ministry`,
  },
  {
    name: "Preacher",
    department: "Teaching & Word",
    reminderSchedule: ["MONDAY", "THURSDAY"],
    arrivalTime: "10:00 AM",
    timeSlot: "11:45 AM – 12:25 PM",
    order: 4,
    emailSubject: "🎤 Preaching Assignment – Potter's Wheel | {{ServiceDate}}",
    emailBody: `Greetings {{Name}} 🙏🏾\n\nYou are scheduled to PREACH at Potter's Wheel Service.\n\n📅 Date: {{ServiceDate}}\n📌 Theme: {{Theme}}\n⏰ Time Slot: 11:45 AM – 12:25 PM\n📍 Venue: {{Venue}}\n\nWe are believing God for a powerful word through you! Please confirm your readiness.\n\nGod bless!\nDew of Hermon Youth Ministry`,
  },
  {
    name: "Choir Director",
    department: "Worship & Music",
    reminderSchedule: ["THURSDAY"],
    arrivalTime: "9:45 AM",
    timeSlot: null,
    order: 5,
    emailSubject: "🎶 Choir Direction – Potter's Wheel | {{ServiceDate}}",
    emailBody: `Greetings {{Name}} 🙏🏾\n\nYou are directing the CHOIR/WORSHIP at Potter's Wheel Service.\n\n📅 Date: {{ServiceDate}}\n⏰ Sound check by: 9:45 AM\n📍 Venue: {{Venue}}\n\nPlease coordinate with the Music Director and brief your choir team. Confirm by replying.\n\nGod bless!\nDew of Hermon Youth Ministry`,
  },
  {
    name: "Music Director",
    department: "Worship & Music",
    reminderSchedule: ["THURSDAY"],
    arrivalTime: "9:30 AM",
    timeSlot: null,
    order: 6,
    emailSubject: "🎸 Music Direction – Potter's Wheel | {{ServiceDate}}",
    emailBody: `Greetings {{Name}} 🙏🏾\n\nYou are the MUSIC DIRECTOR (instruments/band) for Potter's Wheel Service.\n\n📅 Date: {{ServiceDate}}\n⏰ Setup & sound check by: 9:30 AM\n📍 Venue: {{Venue}}\n\nPlease coordinate with the Choir Director on the song list and ensure all instruments are ready.\n\nGod bless!\nDew of Hermon Youth Ministry`,
  },
  {
    name: "Sound Engineer",
    department: "Media & Technical",
    reminderSchedule: ["THURSDAY", "SATURDAY"],
    arrivalTime: "9:30 AM",
    timeSlot: null,
    order: 7,
    emailSubject: "🎛️ Sound Engineering – Potter's Wheel | {{ServiceDate}}",
    emailBody: `Greetings {{Name}} 🙏🏾\n\nYou are on SOUND ENGINEERING for Potter's Wheel Service.\n\n📅 Date: {{ServiceDate}}\n⏰ Arrive by: 9:30 AM for full setup and testing\n📍 Venue: {{Venue}}\n\nChecklist:\n✅ Sound system tested\n✅ Microphones checked\n✅ Monitor levels set\n✅ Recording ready (if applicable)\n\nConfirm all will be ready.\n\nGod bless!\nDew of Hermon Youth Ministry`,
  },
  {
    name: "Visual Officer",
    department: "Media & Technical",
    reminderSchedule: ["THURSDAY", "SATURDAY"],
    arrivalTime: "9:30 AM",
    timeSlot: null,
    order: 8,
    emailSubject: "📺 Visual/Media Setup – Potter's Wheel | {{ServiceDate}}",
    emailBody: `Greetings {{Name}} 🙏🏾\n\nYou are the VISUAL OFFICER for Potter's Wheel Service.\n\n📅 Date: {{ServiceDate}}\n⏰ Arrive by: 9:30 AM\n📍 Venue: {{Venue}}\n\nChecklist:\n✅ Projector & screen set up\n✅ Slides/lyrics loaded\n✅ Sermon slides ready\n✅ Camera/recording set (if applicable)\n\nConfirm by replying.\n\nGod bless!\nDew of Hermon Youth Ministry`,
  },
  {
    name: "Ushers Coordinator",
    department: "Ushering & Protocol",
    reminderSchedule: ["SATURDAY"],
    arrivalTime: "9:45 AM",
    timeSlot: null,
    order: 9,
    emailSubject: "🚪 Ushering Assignment – Potter's Wheel | {{ServiceDate}}",
    emailBody: `Greetings {{Name}} 🙏🏾\n\nYou are coordinating USHERING at Potter's Wheel Service.\n\n📅 Date: {{ServiceDate}}\n⏰ Please arrive by: 9:45 AM\n📍 Venue: {{Venue}}\n\nChecklist:\n✅ Offering baskets ready\n✅ Welcome/registration desk set\n✅ Usher team briefed\n\nConfirm your team is ready.\n\nGod bless!\nDew of Hermon Youth Ministry`,
  },
  {
    name: "Protocol Officer",
    department: "Ushering & Protocol",
    reminderSchedule: ["SATURDAY"],
    arrivalTime: "9:45 AM",
    timeSlot: null,
    order: 10,
    emailSubject: "🎖️ Protocol Assignment – Potter's Wheel | {{ServiceDate}}",
    emailBody: `Greetings {{Name}} 🙏🏾\n\nYou are on PROTOCOL duty for Potter's Wheel Service.\n\n📅 Date: {{ServiceDate}}\n⏰ Please arrive by: 9:45 AM\n📍 Venue: {{Venue}}\n\nPlease coordinate VIP/guest seating, pastor reception, and any special arrangements. Confirm by replying.\n\nGod bless!\nDew of Hermon Youth Ministry`,
  },
  {
    name: "Hospitality Lead",
    department: "Hospitality",
    reminderSchedule: ["THURSDAY"],
    arrivalTime: "9:30 AM",
    timeSlot: null,
    order: 11,
    emailSubject: "☕ Hospitality Assignment – Potter's Wheel | {{ServiceDate}}",
    emailBody: `Greetings {{Name}} 🙏🏾\n\nYou are the HOSPITALITY LEAD for Potter's Wheel Service.\n\n📅 Date: {{ServiceDate}}\n⏰ Please arrive by: 9:30 AM\n📍 Venue: {{Venue}}\n\nChecklist:\n✅ Seating arranged\n✅ Water/refreshments for ministers\n✅ Welcome area set up\n\nConfirm by replying.\n\nGod bless!\nDew of Hermon Youth Ministry`,
  },
  {
    name: "Affirmations Coordinator",
    department: "Administration",
    reminderSchedule: ["MONDAY", "THURSDAY"],
    arrivalTime: null,
    timeSlot: null,
    order: 12,
    emailSubject: "✨ Potter's Wheel Affirmations – Prep Reminder | {{ServiceDate}}",
    emailBody: `Greetings {{Name}} 🙏🏾\n\nYou are preparing the POTTER'S WHEEL AFFIRMATIONS for this Sunday's service.\n\n📅 Date: {{ServiceDate}}\n📌 Theme: {{Theme}}\n\nPlease have the affirmation notes ready and shared with the Moderator by Saturday evening. Confirm your progress.\n\nGod bless!\nDew of Hermon Youth Ministry`,
  },
  {
    name: "Visitor Engagement Lead",
    department: "Visitor Engagement",
    reminderSchedule: ["THURSDAY"],
    arrivalTime: "10:00 AM",
    timeSlot: null,
    order: 13,
    emailSubject: "🤗 Visitor Engagement – Potter's Wheel | {{ServiceDate}}",
    emailBody: `Greetings {{Name}} 🙏🏾\n\nYou are leading the VISITOR ENGAGEMENT SESSION after Potter's Wheel Service.\n\n📅 Date: {{ServiceDate}}\n📍 Venue: {{Venue}}\n\nAfter the main service, you will lead an interactive welcome session with first-time visitors. Please prepare ice-breakers, ministry introduction, and have follow-up cards ready.\n\nConfirm by replying.\n\nGod bless!\nDew of Hermon Youth Ministry`,
  },
];

export async function POST(request: Request) {
  try {
    // Accept a fresh ID token from the request body, or fall back to session cookie
    let token: string | undefined;

    try {
      const body = await request.json();
      token = body.idToken;
    } catch {
      // No JSON body — fall back to cookie
    }

    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get("session")?.value;
    }

    if (!token) {
      return NextResponse.json(
        { error: "You must be logged in to seed data" },
        { status: 401 }
      );
    }

    let uid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded.uid;
    } catch {
      return NextResponse.json(
        { error: "Invalid session. Please log in again." },
        { status: 401 }
      );
    }

    const results: string[] = [];

    // 1. Check if departments already exist
    const existingDepts = await adminDb.collection("departments").limit(1).get();
    if (!existingDepts.empty) {
      results.push("Departments already exist — skipping");
    } else {
      // Create departments
      const deptMap: Record<string, string> = {};
      const deptBatch = adminDb.batch();

      for (const dept of departments) {
        const ref = adminDb.collection("departments").doc();
        deptBatch.set(ref, {
          name: dept.name,
          description: dept.description,
          icon: dept.icon,
          order: dept.order,
          createdAt: new Date(),
        });
        deptMap[dept.name] = ref.id;
      }

      await deptBatch.commit();
      results.push(`Created ${departments.length} departments`);

      // 2. Create service roles (only if we just created departments, so we have the IDs)
      const roleBatch = adminDb.batch();

      for (const role of roles) {
        const ref = adminDb.collection("serviceRoles").doc();
        roleBatch.set(ref, {
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
      }

      await roleBatch.commit();
      results.push(`Created ${roles.length} service roles`);
    }

    // 3. Check if service roles exist (in case departments existed but roles didn't)
    const existingRoles = await adminDb.collection("serviceRoles").limit(1).get();
    if (existingRoles.empty) {
      // Need to get department IDs first
      const deptSnapshot = await adminDb.collection("departments").get();
      const deptMap: Record<string, string> = {};
      deptSnapshot.docs.forEach((doc) => {
        deptMap[doc.data().name] = doc.id;
      });

      const roleBatch = adminDb.batch();
      for (const role of roles) {
        const ref = adminDb.collection("serviceRoles").doc();
        roleBatch.set(ref, {
          name: role.name,
          departmentId: deptMap[role.department] || "",
          description: null,
          emailSubject: role.emailSubject,
          emailBody: role.emailBody,
          reminderSchedule: role.reminderSchedule,
          arrivalTime: role.arrivalTime,
          timeSlot: role.timeSlot,
          order: role.order,
        });
      }
      await roleBatch.commit();
      results.push(`Created ${roles.length} service roles`);
    }

    // 4. Upgrade the current user to SUPER_ADMIN
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (userDoc.exists) {
      const currentRole = userDoc.data()?.role;
      if (currentRole !== "SUPER_ADMIN") {
        await adminDb.collection("users").doc(uid).update({
          role: "SUPER_ADMIN",
          updatedAt: new Date(),
        });
        results.push(`Upgraded your account to SUPER_ADMIN (was ${currentRole})`);
      } else {
        results.push("Your account is already SUPER_ADMIN");
      }
    } else {
      // User document doesn't exist in Firestore — create it
      const authUser = await adminAuth.getUser(uid);
      await adminDb.collection("users").doc(uid).set({
        name: authUser.displayName || "Admin",
        email: authUser.email || "",
        phone: null,
        role: "SUPER_ADMIN",
        departmentIds: [],
        leadsDepartmentIds: [],
        profileImage: authUser.photoURL || null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      results.push("Created your user profile with SUPER_ADMIN role");
    }

    // 5. Store default checklist template
    const settingsDoc = await adminDb.collection("settings").doc("checklistTemplate").get();
    if (!settingsDoc.exists) {
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

      await adminDb.collection("settings").doc("checklistTemplate").set({
        items: defaultChecklist,
        updatedAt: new Date(),
      });
      results.push("Created checklist template");
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error: unknown) {
    console.error("Seed error:", error);
    const message = error instanceof Error ? error.message : "Seed failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
