// Pure, framework-free Caffeine annotation for a Fueling Plan's timeline.
//
// Caffeine is advisory only: it never changes what planFueling already
// decided (gel counts, totals, timing). This module just marks which already-
// planned gel slots in the final third of the Run are worth making
// caffeinated, so it has no React or Next.js dependencies and takes a
// FuelingPlan's timeline as input rather than recomputing it.

import type { FuelTimelineEntry } from "./fueling";

// Below this Run Duration there's no meaningful final third to place
// caffeine in, so toggling Caffeine on explains why instead of annotating.
export const CAFFEINE_MIN_DURATION_MINUTES = 120;

// The advisory dose range shown per annotated gel. Exact caffeine content
// varies by brand, so this is a range rather than a single figure.
export const CAFFEINE_MG_PER_SLOT_LOW = 50;
export const CAFFEINE_MG_PER_SLOT_HIGH = 100;

// The advisory ceiling for caffeine across the whole Run.
export const CAFFEINE_TOTAL_CAP_MG = 200;

// How many gel slots can be annotated without risking the total cap, using
// the high end of the per-slot range so the actual total never exceeds the
// cap even if every annotated gel turns out to be a stronger brand.
export const MAX_CAFFEINATED_SLOTS = Math.floor(
  CAFFEINE_TOTAL_CAP_MG / CAFFEINE_MG_PER_SLOT_HIGH,
);

// Display copy for an annotated slot, matching the issue's wording.
export const CAFFEINE_SLOT_MESSAGE = `Make this one caffeinated (~${CAFFEINE_MG_PER_SLOT_LOW}-${CAFFEINE_MG_PER_SLOT_HIGH} mg)`;

// Explains why no annotations appear for a Run under the duration threshold.
export const CAFFEINE_TOO_SHORT_MESSAGE =
  "This Run is under about 2 hours, so there's no caffeine guidance: keep it to plain gels.";

// Which already-planned gel slots to annotate as caffeinated, and why, for a
// given Run Duration. eligible is false under the duration threshold, in
// which case annotatedEntryIndexes is always empty.
export interface CaffeinePlan {
  readonly eligible: boolean;
  // FuelTimelineEntry.index values of the gel slots to annotate.
  readonly annotatedEntryIndexes: ReadonlySet<number>;
}

// Choose which gel slots in the final third of the Run to annotate as
// caffeinated: gels are unaffected in count or timing, only marked. Picks the
// earliest eligible gels within the final third, capped at
// MAX_CAFFEINATED_SLOTS so the advisory total never risks passing
// CAFFEINE_TOTAL_CAP_MG.
export function planCaffeine(
  timeline: readonly FuelTimelineEntry[],
  durationMinutes: number,
): CaffeinePlan {
  if (durationMinutes < CAFFEINE_MIN_DURATION_MINUTES) {
    return { eligible: false, annotatedEntryIndexes: new Set() };
  }

  const finalThirdStartMinutes = (durationMinutes * 2) / 3;

  const eligibleGelEntries = timeline.filter(
    (entry) =>
      entry.kind === "gels" && entry.offsetMinutes >= finalThirdStartMinutes,
  );

  const annotated = eligibleGelEntries.slice(0, MAX_CAFFEINATED_SLOTS);

  return {
    eligible: true,
    annotatedEntryIndexes: new Set(annotated.map((entry) => entry.index)),
  };
}
