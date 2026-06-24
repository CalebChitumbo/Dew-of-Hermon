import { adminDb } from "@/lib/firebase-admin";
import { createNotificationWithEmail } from "@/lib/notifications";
import type { DocumentReference, DocumentData } from "firebase-admin/firestore";
import {
  startOfDay,
  endOfDay,
  nextSunday,
  addWeeks,
  getDay,
  format,
} from "date-fns";

/**
 * Auto-provisioning for the weekly Potter's Wheel service.
 *
 * The service preparation is the Potter's Wheel manager's responsibility, but
 * the individual roles are filled by the different department heads (Media,
 * Hospitality, Worship, ...). So that heads never have to wait for someone to
 * manually open a service before they can assign their people, the rota for the
 * coming Sunday(s) is created ahead of time.
 *
 * Everything here is idempotent and safe to call repeatedly — from the weekly
 * cron, from the reminders cron, and opportunistically when a manager opens the
 * Services page. A Sunday is only ever provisioned once.
 */

const DEFAULT_VENUE = "Main Auditorium";
const DEFAULT_SERVICE_TIME = "10:00";

/** How many Sundays ahead to keep provisioned at any time. */
export const DEFAULT_WEEKS_AHEAD = 2;

/** The starter checklist stamped onto every newly-provisioned service. */
const DEFAULT_CHECKLIST: { task: string; category: string; order: number }[] = [
  { task: "Sound system setup and test", category: "Technical", order: 1 },
  { task: "Projector and slides ready", category: "Technical", order: 2 },
  { task: "Musical instruments tuned", category: "Technical", order: 3 },
  { task: "Worship song list finalized", category: "Worship", order: 4 },
  { task: "Worship team rehearsal complete", category: "Worship", order: 5 },
  { task: "Sermon notes / message prepared", category: "Ministry", order: 6 },
  { task: "Welcome team briefed", category: "Hospitality", order: 7 },
  { task: "Venue cleaned and arranged", category: "Hospitality", order: 8 },
  { task: "Refreshments organized", category: "Hospitality", order: 9 },
  { task: "Attendance register ready", category: "Admin", order: 10 },
  { task: "Offering baskets prepared", category: "Admin", order: 11 },
  { task: "All role assignments confirmed", category: "Admin", order: 12 },
];

export interface EnsuredService {
  serviceId: string;
  eventId: string;
  /** ISO string for the service (Sunday) date. */
  date: string;
  /** True when this call newly created the service. */
  created: boolean;
  theme: string | null;
  venue: string;
  serviceTime: string;
}

export interface EnsureOptions {
  venue?: string;
  serviceTime?: string;
  theme?: string | null;
  createdBy?: string;
  /** Marks the service as opened automatically rather than by hand. */
  autoProvisioned?: boolean;
}

/** The coming Sunday (today if today is already Sunday), at start-of-day. */
function comingSunday(from: Date): Date {
  return getDay(from) === 0 ? startOfDay(from) : startOfDay(nextSunday(from));
}

/** The next `count` Sundays, starting from the coming one. */
export function upcomingSundays(count: number, from: Date = new Date()): Date[] {
  const first = comingSunday(from);
  return Array.from({ length: count }, (_, i) => addWeeks(first, i));
}

/**
 * Venue + service time to use for an auto-provisioned service. Inherits from an
 * admin-configured override or the most recent Potter's Wheel service so the
 * rota matches the usual venue/time, falling back to sensible defaults. Only
 * runs when a service is actually being created (a couple of times a week).
 */
async function getServiceDefaults(): Promise<{ venue: string; serviceTime: string }> {
  const settingsSnap = await adminDb
    .collection("settings")
    .doc("serviceProvisioning")
    .get();
  const settings = settingsSnap.exists ? settingsSnap.data()! : {};
  let venue: string | null = settings.venue || null;
  let serviceTime: string | null = settings.serviceTime || null;

  if (!venue || !serviceTime) {
    const eventsSnap = await adminDb
      .collection("events")
      .where("type", "==", "POTTERS_WHEEL_SERVICE")
      .get();

    let latest: { date: Date; venue: string; eventId: string } | null = null;
    eventsSnap.docs.forEach((doc) => {
      const data = doc.data();
      const date: Date | undefined = data.startDate?.toDate?.();
      if (date && (!latest || date > latest.date)) {
        latest = { date, venue: data.venue || "", eventId: doc.id };
      }
    });

    if (latest) {
      const found = latest as { date: Date; venue: string; eventId: string };
      if (!venue && found.venue) venue = found.venue;
      if (!serviceTime) {
        const svcSnap = await adminDb
          .collection("services")
          .where("eventId", "==", found.eventId)
          .limit(1)
          .get();
        if (!svcSnap.empty) {
          serviceTime = svcSnap.docs[0].data().serviceTime || null;
        }
      }
    }
  }

  return {
    venue: venue || DEFAULT_VENUE,
    serviceTime: serviceTime || DEFAULT_SERVICE_TIME,
  };
}

/** A stable per-Sunday id so concurrent writers collide instead of duplicating. */
function serviceKey(date: Date): string {
  return `pwservice-${format(date, "yyyy-MM-dd")}`;
}

/**
 * Create a document at a fixed id, tolerating a concurrent writer that beat us
 * to it. Returns true if *this* call created the doc, false if it already
 * existed (so callers only run one-time side effects, like seeding a checklist,
 * exactly once).
 */
async function createIfAbsent(
  ref: DocumentReference,
  data: DocumentData
): Promise<boolean> {
  try {
    await ref.create(data);
    return true;
  } catch (err) {
    const snap = await ref.get();
    if (snap.exists) return false; // someone else won the race
    throw err;
  }
}

/**
 * Creates the service doc (+ its starter checklist) for an event, at a stable
 * id. Returns true only if this call actually created it.
 */
async function createServiceDoc(
  eventId: string,
  serviceId: string,
  opts: { theme: string | null; serviceTime: string; autoProvisioned: boolean }
): Promise<boolean> {
  const now = new Date();
  const serviceRef = adminDb.collection("services").doc(serviceId);
  const created = await createIfAbsent(serviceRef, {
    eventId,
    theme: opts.theme,
    serviceTime: opts.serviceTime,
    programNotes: null,
    attendanceCount: null,
    isArchived: false,
    autoProvisioned: opts.autoProvisioned,
    rotaOpenNotifiedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  if (!created) return false; // another writer already seeded it

  const batch = adminDb.batch();
  for (const item of DEFAULT_CHECKLIST) {
    const ref = adminDb.collection("checklistItems").doc();
    batch.set(ref, {
      serviceId: serviceRef.id,
      task: item.task,
      category: item.category,
      isCompleted: false,
      completedBy: null,
      order: item.order,
      updatedAt: now,
    });
  }
  await batch.commit();

  return true;
}

/**
 * Ensures a Potter's Wheel service exists for the given date. If one already
 * exists for that calendar day it is returned untouched (`created: false`);
 * otherwise the event + service + checklist are created. Idempotent.
 */
export async function ensureServiceForDate(
  date: Date,
  opts: EnsureOptions = {}
): Promise<EnsuredService> {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  // 1. Is there already a Potter's Wheel event on this calendar day?
  const existingEvents = await adminDb
    .collection("events")
    .where("type", "==", "POTTERS_WHEEL_SERVICE")
    .where("startDate", ">=", dayStart)
    .where("startDate", "<=", dayEnd)
    .get();

  if (!existingEvents.empty) {
    const eventDoc = existingEvents.docs[0];
    const eventData = eventDoc.data();
    const eventDate: Date = eventData.startDate?.toDate?.() || dayStart;

    const svcSnap = await adminDb
      .collection("services")
      .where("eventId", "==", eventDoc.id)
      .limit(1)
      .get();

    if (!svcSnap.empty) {
      const svc = svcSnap.docs[0];
      return {
        serviceId: svc.id,
        eventId: eventDoc.id,
        date: eventDate.toISOString(),
        created: false,
        theme: svc.data().theme || null,
        venue: eventData.venue || DEFAULT_VENUE,
        serviceTime: svc.data().serviceTime || DEFAULT_SERVICE_TIME,
      };
    }

    // Defensive: event exists but no linked service — create the service.
    const serviceTime =
      opts.serviceTime || (await getServiceDefaults()).serviceTime;
    const created = await createServiceDoc(eventDoc.id, serviceKey(dayStart), {
      theme: opts.theme ?? null,
      serviceTime,
      autoProvisioned: opts.autoProvisioned ?? false,
    });
    return {
      serviceId: serviceKey(dayStart),
      eventId: eventDoc.id,
      date: eventDate.toISOString(),
      created,
      theme: opts.theme ?? null,
      venue: eventData.venue || DEFAULT_VENUE,
      serviceTime,
    };
  }

  // 2. Nothing yet — create event + service + checklist, all at stable ids so
  // concurrent triggers (cron + page loads) can never duplicate a Sunday.
  const defaults = await getServiceDefaults();
  const venue = opts.venue || defaults.venue;
  const serviceTime = opts.serviceTime || defaults.serviceTime;
  const theme = opts.theme ?? null;
  const now = new Date();
  const key = serviceKey(dayStart);

  const eventRef = adminDb.collection("events").doc(key);
  await createIfAbsent(eventRef, {
    title: theme ? `Potter's Wheel: ${theme}` : "Potter's Wheel Service",
    description: null,
    type: "POTTERS_WHEEL_SERVICE",
    startDate: dayStart,
    endDate: null,
    venue,
    isRecurring: false,
    createdBy: opts.createdBy || "system",
    createdAt: now,
    updatedAt: now,
  });

  const created = await createServiceDoc(eventRef.id, key, {
    theme,
    serviceTime,
    autoProvisioned: opts.autoProvisioned ?? false,
  });

  return {
    serviceId: key,
    eventId: eventRef.id,
    date: dayStart.toISOString(),
    created,
    theme,
    venue,
    serviceTime,
  };
}

/**
 * Ensures the next `weeks` Sundays each have a service rota. Returns what was
 * found/created so callers can decide whether to notify heads.
 */
export async function ensureUpcomingServices(
  opts: { weeks?: number; createdBy?: string } = {}
): Promise<{ services: EnsuredService[] }> {
  const weeks = opts.weeks ?? DEFAULT_WEEKS_AHEAD;
  const sundays = upcomingSundays(weeks);

  const services: EnsuredService[] = [];
  for (const sunday of sundays) {
    services.push(
      await ensureServiceForDate(sunday, {
        createdBy: opts.createdBy,
        autoProvisioned: true,
      })
    );
  }
  return { services };
}

/**
 * When a service rota is freshly opened, notify each department head so they
 * can assign their team straight away. Guarded by `rotaOpenNotifiedAt` on the
 * service doc, so heads are pinged at most once per service no matter how many
 * times the ensure routines run. Returns the number of heads notified.
 */
export async function maybeNotifyRotaOpen(
  ensured: EnsuredService
): Promise<number> {
  if (!ensured.created) return 0;

  const serviceRef = adminDb.collection("services").doc(ensured.serviceId);
  const serviceSnap = await serviceRef.get();
  if (!serviceSnap.exists) return 0;
  if (serviceSnap.data()?.rotaOpenNotifiedAt) return 0; // already notified

  // Which departments own service roles, and what roles each owns.
  const rolesSnap = await adminDb.collection("serviceRoles").get();
  const rolesByDept = new Map<string, string[]>();
  rolesSnap.docs.forEach((doc) => {
    const data = doc.data();
    if (!data.departmentId) return;
    if (!rolesByDept.has(data.departmentId)) {
      rolesByDept.set(data.departmentId, []);
    }
    rolesByDept.get(data.departmentId)!.push(data.name);
  });

  if (rolesByDept.size === 0) {
    await serviceRef.update({ rotaOpenNotifiedAt: new Date() });
    return 0;
  }

  // Department names for friendlier copy.
  const deptNames = new Map<string, string>();
  const deptSnap = await adminDb.collection("departments").get();
  deptSnap.docs.forEach((doc) => deptNames.set(doc.id, doc.data().name));

  // Accumulate, per head, every department (and its roles) they lead, so a
  // head who leads multiple departments gets a single combined notice.
  const leadAccum = new Map<
    string,
    { email: string | null; lines: string[] }
  >();
  for (const [deptId, roleNames] of Array.from(rolesByDept.entries())) {
    const deptName = deptNames.get(deptId) || "your department";
    const leadsSnap = await adminDb
      .collection("users")
      .where("leadsDepartmentIds", "array-contains", deptId)
      .where("isActive", "==", true)
      .get();
    for (const lead of leadsSnap.docs) {
      if (!leadAccum.has(lead.id)) {
        leadAccum.set(lead.id, {
          email: lead.data().email || null,
          lines: [],
        });
      }
      leadAccum.get(lead.id)!.lines.push(`${deptName}: ${roleNames.join(", ")}`);
    }
  }

  const serviceDate = format(new Date(ensured.date), "EEEE, d MMMM yyyy");
  const link = `/manage/services/${ensured.serviceId}`;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://dew-of-hermon-xy9h.vercel.app";

  let sent = 0;
  for (const [userId, info] of Array.from(leadAccum.entries())) {
    const summary = info.lines.join(" | ");
    try {
      await createNotificationWithEmail({
        userId,
        title: "Service Rota Open — Assign Your Team",
        message: `The Potter's Wheel rota for ${serviceDate} is open. Please assign your team: ${summary}.`,
        type: "assignment",
        link,
        recipientEmail: info.email || undefined,
        email: {
          subject: `Assign your team — Potter's Wheel, ${serviceDate}`,
          text: `Greetings 🙏🏾\n\nThe Potter's Wheel service rota for ${serviceDate} is now open for assignments.\n\nPlease assign your team for the following role(s):\n${info.lines
            .map((l) => `• ${l}`)
            .join("\n")}\n\nOpen the rota board: ${appUrl}${link}\n\nGod bless!\nDew of Hermon Youth Ministry`,
        },
      });
      sent++;
    } catch (err) {
      console.error(`Rota-open notice failed for user ${userId}:`, err);
    }
  }

  await serviceRef.update({ rotaOpenNotifiedAt: new Date() });
  return sent;
}
