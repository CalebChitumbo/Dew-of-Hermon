import { addDays, parseISO, format } from "date-fns";
import type { Rehearsal } from "./types";
import { newId } from "./empty-cycle";

function toISO(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

type Template = {
  anchor: "first" | "second" | "midpoint";
  offsetDays: number;
  time: string;
  focus: string;
};

const TEMPLATES: Template[] = [
  { anchor: "first", offsetDays: -14, time: "18:30", focus: "Cycle kickoff & song allocation" },
  { anchor: "first", offsetDays: -11, time: "18:30", focus: "Vocals & harmonies" },
  { anchor: "first", offsetDays: -7, time: "18:30", focus: "Instrumental tightening" },
  { anchor: "first", offsetDays: -3, time: "18:30", focus: "Full run-through (First Sunday set)" },
  { anchor: "first", offsetDays: -1, time: "16:00", focus: "Dress rehearsal — First Sunday" },
  { anchor: "midpoint", offsetDays: 0, time: "18:30", focus: "Mid-cycle review & introduce Second Sunday set" },
  { anchor: "second", offsetDays: -12, time: "18:30", focus: "Vocals & harmonies (Second Sunday)" },
  { anchor: "second", offsetDays: -9, time: "18:30", focus: "Band tightening (Second Sunday)" },
  { anchor: "second", offsetDays: -5, time: "18:30", focus: "Full run-through (Second Sunday set)" },
  { anchor: "second", offsetDays: -3, time: "18:30", focus: "Final polish & special item" },
  { anchor: "second", offsetDays: -1, time: "16:00", focus: "Dress rehearsal — Second Sunday" },
];

export function generateRehearsalSchedule(
  firstSundayISO: string,
  secondSundayISO: string,
  defaults: { location?: string; coordinator?: string } = {}
): Rehearsal[] {
  if (!firstSundayISO || !secondSundayISO) return [];

  let first: Date;
  let second: Date;
  try {
    first = parseISO(firstSundayISO);
    second = parseISO(secondSundayISO);
  } catch {
    return [];
  }

  if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) return [];

  if (second.getTime() < first.getTime()) {
    [first, second] = [second, first];
  }

  const gapDays = Math.round(
    (second.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)
  );
  const midpoint = addDays(first, Math.max(1, Math.floor(gapDays / 2)));

  const location = defaults.location ?? "TOD";
  const coordinator = defaults.coordinator ?? "";

  const used = new Set<string>();
  const rehearsals: Rehearsal[] = [];

  for (const tpl of TEMPLATES) {
    const anchor =
      tpl.anchor === "first" ? first : tpl.anchor === "second" ? second : midpoint;
    let date = addDays(anchor, tpl.offsetDays);
    let iso = toISO(date);
    let walkBack = 0;
    while (used.has(`${iso}|${tpl.time}`)) {
      walkBack += 1;
      date = addDays(date, -1);
      iso = toISO(date);
      if (walkBack > 14) break;
    }
    used.add(`${iso}|${tpl.time}`);

    rehearsals.push({
      id: newId(),
      date: iso,
      time: tpl.time,
      location,
      coordinator,
      focus: tpl.focus,
    });
  }

  rehearsals.sort((a, b) => {
    if (a.date === b.date) return a.time.localeCompare(b.time);
    return a.date.localeCompare(b.date);
  });

  return rehearsals;
}
