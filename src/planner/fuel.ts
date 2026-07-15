// Pure, framework-free Fuel Source planning for a Run.
//
// This module turns a Carb Target and a Run Duration into a Fueling Plan for a
// single Fuel Source: gels. It has no React or Next.js dependencies so the
// allocation and spacing rules can be unit tested in isolation. Terms follow
// CONTEXT.md: a Fuel Source is something the runner ingests for carbohydrate,
// each with known carbs per serving; the Fueling Plan is the timeline of when
// to take each serving plus a shopping-list summary of totals.

import type { CarbTarget } from "./plan";

// A Fuel Source the runner can select. Gels are the only source for now; more
// sources (bananas, chews, the Homemade Sports Drink) come in later slices.
export interface FuelSource {
  readonly id: FuelSourceId;
  readonly label: string;
  // Carbohydrate delivered by one whole serving, in grams. Quantities are
  // always whole servings, so this is the smallest carb increment the planner
  // can allocate for this source.
  readonly carbsPerServingGrams: number;
  // The singular noun for one serving, used in timeline and summary copy.
  readonly servingNoun: string;
}

export type FuelSourceId = "gels";

// Gels are modelled generically at ~22 to 25 g carbs per sachet. We use a
// single representative value so the planner can allocate whole gels; the exact
// figure varies by brand and is not something the runner tunes here.
export const GEL_CARBS_GRAMS = 23;

export const GELS: FuelSource = {
  id: "gels",
  label: "Gels",
  carbsPerServingGrams: GEL_CARBS_GRAMS,
  servingNoun: "gel",
};

// Every Fuel Source the selection UI offers. Gels only for now.
export const FUEL_SOURCES: readonly FuelSource[] = [GELS];

// One entry on the Fueling Plan timeline: a single serving at a time offset
// from the start of the Run.
export interface FuelServing {
  // 1-based position of this serving on the timeline.
  readonly index: number;
  // Minutes from the start of the Run at which to take this serving.
  readonly offsetMinutes: number;
  // The offset formatted as "H:MM" for display, e.g. "0:30".
  readonly offsetLabel: string;
}

// A complete gels-only Fueling Plan: the timeline of servings plus the totals
// the shopping-list summary needs.
export interface GelPlan {
  // Whole gels to buy and carry.
  readonly gelCount: number;
  // Carbs delivered by one gel, in grams.
  readonly carbsPerGelGrams: number;
  // Total carbs the allocated gels deliver across the Run, in grams.
  readonly totalCarbsGrams: number;
  // When to take each gel, evenly spaced across the Run Duration.
  readonly timeline: readonly FuelServing[];
}

// The total carbohydrate, in grams, the plan aims to deliver across the whole
// Run: the middle of the Carb Target band held over the Run Duration. A Run
// with no Carb Target (fuelNeeded false) needs no carbs, so this is zero.
//
// This is the quantity the planner allocates Fuel Sources against. Under the
// drink-first rule (ADR-0002) the Homemade Sports Drink is subtracted from it
// first and solids fill only the remainder.
export function targetCarbsGrams(
  carbTarget: CarbTarget,
  durationMinutes: number,
): number {
  if (
    !carbTarget.fuelNeeded ||
    carbTarget.gramsPerHourLow === null ||
    carbTarget.gramsPerHourHigh === null
  ) {
    return 0;
  }

  const targetGramsPerHour =
    (carbTarget.gramsPerHourLow + carbTarget.gramsPerHourHigh) / 2;
  const hours = durationMinutes / 60;
  return targetGramsPerHour * hours;
}

// Allocate whole gels to hit the Carb Target across the Run Duration.
//
// The Carb Target is a grams-per-hour band, so we aim for the middle of the
// band over the whole Run and round to the nearest whole gel: quantities are
// whole servings only. A Run that needs fuel always gets at least one gel. A
// Run with no Carb Target (fuelNeeded false) gets none.
export function gelCountForRun(
  carbTarget: CarbTarget,
  durationMinutes: number,
  carbsPerGelGrams: number = GEL_CARBS_GRAMS,
): number {
  const totalTargetCarbs = targetCarbsGrams(carbTarget, durationMinutes);
  if (totalTargetCarbs <= 0) {
    return 0;
  }

  const count = Math.round(totalTargetCarbs / carbsPerGelGrams);
  return Math.max(1, count);
}

// Space a number of servings evenly across the Run Duration.
//
// N servings split the Run into N + 1 equal gaps, so the runner has an equal
// stretch before the first gel, between each pair, and after the last gel
// before the finish. For 3 gels across a 2 hour Run each gap is 30 min, giving
// offsets of 0:30, 1:00 and 1:30.
export function spaceServingsEvenly(
  count: number,
  durationMinutes: number,
): number[] {
  const offsets: number[] = [];
  for (let i = 1; i <= count; i += 1) {
    offsets.push((durationMinutes * i) / (count + 1));
  }
  return offsets;
}

// Format a time offset in minutes as "H:MM", e.g. 30 -> "0:30", 90 -> "1:30".
export function formatTimeOffset(offsetMinutes: number): string {
  const totalMinutes = Math.round(offsetMinutes);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${minutes.toString().padStart(2, "0")}`;
}

// Build the gels-only Fueling Plan for a Run: allocate whole gels to the Carb
// Target, then space them evenly across the Run Duration.
export function planGels(
  carbTarget: CarbTarget,
  durationMinutes: number,
  carbsPerGelGrams: number = GEL_CARBS_GRAMS,
): GelPlan {
  const gelCount = gelCountForRun(
    carbTarget,
    durationMinutes,
    carbsPerGelGrams,
  );

  const timeline: FuelServing[] = spaceServingsEvenly(
    gelCount,
    durationMinutes,
  ).map((offsetMinutes, index) => ({
    index: index + 1,
    offsetMinutes,
    offsetLabel: formatTimeOffset(offsetMinutes),
  }));

  return {
    gelCount,
    carbsPerGelGrams,
    totalCarbsGrams: gelCount * carbsPerGelGrams,
    timeline,
  };
}
