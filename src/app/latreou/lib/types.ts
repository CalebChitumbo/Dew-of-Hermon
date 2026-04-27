export type Song = {
  id: string;
  title: string;
  leader: string;
  youtubeLink: string;
};

export type SpecialItem = {
  title: string;
  responsible: string;
  link: string;
};

export type SundayPlan = {
  date: string;
  session1: Song[];
  session2: Song[];
  specialItem: SpecialItem;
};

export type Uniforms = {
  firstSundayGents: string;
  firstSundayLadies: string;
  secondSundayGents: string;
  secondSundayLadies: string;
  notes: string;
};

export type Rehearsal = {
  id: string;
  date: string;
  time: string;
  location: string;
  coordinator: string;
  focus: string;
};

export type LatreouCycle = {
  version: 1;
  cycleName: string;
  preparedBy: string;
  firstSunday: SundayPlan;
  secondSunday: SundayPlan;
  uniforms: Uniforms;
  rehearsals: Rehearsal[];
  scripture: { reference: string; text: string };
  prayerDirection: string;
};

export const STEP_LABELS: readonly string[] = [
  "Cycle Overview",
  "First Sunday",
  "Second Sunday",
  "Uniforms",
  "Rehearsals",
  "Scripture & Prayer",
  "Preview & Export",
] as const;

export const TOTAL_STEPS = STEP_LABELS.length;

export type SongSuggestionStatus = "open" | "archived";

export type SongSuggestion = {
  id: string;
  title: string;
  youtubeLink: string;
  suggestedBy: string;
  suggestedByName: string;
  status: SongSuggestionStatus;
  createdAt: Date | null;
  archivedAt?: Date | null;
  pickedForCycle?: string;
};
