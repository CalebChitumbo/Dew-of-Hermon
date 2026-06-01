import type { LatreouCycle, Song, SundayPlan } from "./types";

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function emptySong(): Song {
  return { id: newId(), title: "", leader: "", youtubeLink: "" };
}

function emptySunday(): SundayPlan {
  return {
    date: "",
    praise: [],
    worship: [],
    specialItem: { title: "", responsible: "", link: "" },
  };
}

export function createEmptyCycle(): LatreouCycle {
  return {
    version: 1,
    cycleName: "",
    preparedBy: "",
    firstSunday: emptySunday(),
    secondSunday: emptySunday(),
    uniforms: {
      firstSundayGents: "",
      firstSundayLadies: "",
      secondSundayGents: "",
      secondSundayLadies: "",
      notes: "",
    },
    rehearsals: [],
    scripture: { reference: "", text: "" },
    prayerDirection: "",
  };
}
