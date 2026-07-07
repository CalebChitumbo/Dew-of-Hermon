import { TalentCategory, TalentSubmission } from "@/types";

/** Display labels for each talent category, in form/filter order. */
export const TALENT_CATEGORY_OPTIONS: {
  value: TalentCategory;
  label: string;
}[] = [
  { value: "SINGING", label: "Singing / Vocals" },
  { value: "INSTRUMENTS", label: "Musical Instruments" },
  { value: "DANCE", label: "Dance" },
  { value: "DRAMA", label: "Drama / Acting" },
  { value: "POETRY_SPOKEN_WORD", label: "Poetry / Spoken Word" },
  { value: "PREACHING_TEACHING", label: "Preaching / Teaching" },
  { value: "MEDIA_CREATIVE", label: "Media / Photography / Video" },
  { value: "ART_DESIGN", label: "Art / Design" },
  { value: "TECH", label: "Tech / Sound / Livestream" },
  { value: "OTHER", label: "Something else" },
];

const LABELS = new Map(
  TALENT_CATEGORY_OPTIONS.map((o) => [o.value, o.label])
);

/**
 * Human label for a submission's category — uses the member's own words when
 * they picked "Something else".
 */
export function talentCategoryLabel(
  sub: Pick<TalentSubmission, "category" | "categoryOther">
): string {
  if (sub.category === "OTHER" && sub.categoryOther) return sub.categoryOther;
  return LABELS.get(sub.category) || sub.category;
}
