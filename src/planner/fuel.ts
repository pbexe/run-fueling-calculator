// Pure, framework-free Fuel Source planning for a Run.
//
// This module turns a Carb Target and a Run Duration into whole-serving
// allocations across one or more solid Fuel Sources: gels, bananas and chews.
// It has no React or Next.js dependencies so the allocation rules can be unit
// tested in isolation. A Fuel Source is something the runner ingests for
// carbohydrate, each with known carbs per serving; the Fueling Plan (built in
// fueling.ts) is the timeline of when to take each serving plus a
// shopping-list summary of totals.

import type { CarbTarget } from "./plan";

// A Fuel Source the runner can select. Quantities are always whole servings,
// so carbsPerServingGrams is the smallest carb increment the planner can
// allocate for this source.
export interface FuelSource {
  readonly id: FuelSourceId;
  readonly label: string;
  // Carbohydrate delivered by one whole serving, in grams.
  readonly carbsPerServingGrams: number;
  // The singular noun for one serving, used in timeline copy and when exactly
  // one serving is allocated, e.g. "gel", "banana", "handful of chews".
  readonly servingNoun: string;
  // The plural noun for zero or more than one serving, e.g. "gels", "bananas",
  // "handfuls of chews".
  readonly servingNounPlural: string;
  // For sources dosed as a bundle of smaller pieces (chews), how many pieces
  // make up one serving and the singular noun for one piece. Absent for
  // sources that are already a single unit (gels, bananas).
  readonly piecesPerServing?: number;
  readonly pieceNoun?: string;
  // The serving count at or above which this source becomes impractical to
  // carry (e.g. 4+ bananas). Absent means no practicality warning applies.
  readonly impracticalServingThreshold?: number;
}

export type FuelSourceId = "gels" | "bananas" | "chews";

// Gels are modelled generically at ~22 to 25 g carbs per sachet. We use a
// single representative value so the planner can allocate whole gels; the
// exact figure varies by brand and is not something the runner tunes here.
export const GEL_CARBS_GRAMS = 23;

export const GELS: FuelSource = {
  id: "gels",
  label: "Gels",
  carbsPerServingGrams: GEL_CARBS_GRAMS,
  servingNoun: "gel",
  servingNounPlural: "gels",
};

// A banana carries roughly 25 to 27 g carbs; we use a representative
// mid-point so the planner can allocate whole bananas.
export const BANANA_CARBS_GRAMS = 26;

// Carrying this many bananas or more is impractical, so the plan warns and
// suggests rebalancing onto a drink or gels.
export const BANANA_IMPRACTICAL_THRESHOLD = 4;

export const BANANAS: FuelSource = {
  id: "bananas",
  label: "Bananas",
  carbsPerServingGrams: BANANA_CARBS_GRAMS,
  servingNoun: "banana",
  servingNounPlural: "bananas",
  impracticalServingThreshold: BANANA_IMPRACTICAL_THRESHOLD,
};

// Chews carry roughly 5 g carbs per piece and are dosed in handfuls rather
// than one at a time, so a "serving" for chews is one handful.
export const CHEW_CARBS_PER_PIECE_GRAMS = 5;
export const CHEW_PIECES_PER_HANDFUL = 4;
export const CHEW_CARBS_GRAMS =
  CHEW_CARBS_PER_PIECE_GRAMS * CHEW_PIECES_PER_HANDFUL;

export const CHEWS: FuelSource = {
  id: "chews",
  label: "Chews",
  carbsPerServingGrams: CHEW_CARBS_GRAMS,
  servingNoun: "handful of chews",
  servingNounPlural: "handfuls of chews",
  piecesPerServing: CHEW_PIECES_PER_HANDFUL,
  pieceNoun: "chew",
};

// Every Fuel Source the selection UI offers.
export const FUEL_SOURCES: readonly FuelSource[] = [GELS, BANANAS, CHEWS];

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

// The low and high bounds of the Carb Target band held over the whole Run, in
// grams. Null when the Run needs no fuel. Used to warn when a plan's rounded
// totals land outside the band.
export function carbTargetBandGrams(
  carbTarget: CarbTarget,
  durationMinutes: number,
): { lowGrams: number; highGrams: number } | null {
  if (
    !carbTarget.fuelNeeded ||
    carbTarget.gramsPerHourLow === null ||
    carbTarget.gramsPerHourHigh === null
  ) {
    return null;
  }

  const hours = durationMinutes / 60;
  return {
    lowGrams: carbTarget.gramsPerHourLow * hours,
    highGrams: carbTarget.gramsPerHourHigh * hours,
  };
}

// One Fuel Source's share of an allocation: how many whole servings and the
// carbs that delivers.
export interface SolidAllocation {
  readonly source: FuelSource;
  readonly count: number;
  readonly totalCarbsGrams: number;
}

// Allocate a total carb amount across one or more solid Fuel Sources in whole
// servings.
//
// The amount is split evenly across the given sources, then each source's
// share is independently rounded to the nearest whole serving of that source
// - so a mix of gels, bananas and chews each gets a sensible portion rather
// than one source soaking up the whole target. When requireAtLeastOne is set
// (a fuelled Run with no drink to cover the gap) and every source would
// otherwise round to zero, the first source is bumped to one serving so the
// Run is never left with no fuel at all.
export function allocateSolidsForRun(
  totalCarbsGrams: number,
  sources: readonly FuelSource[],
  requireAtLeastOne: boolean,
): SolidAllocation[] {
  if (sources.length === 0) {
    return [];
  }

  const shareGrams = Math.max(0, totalCarbsGrams) / sources.length;
  const allocations = sources.map((source) => {
    const count = Math.max(
      0,
      Math.round(shareGrams / source.carbsPerServingGrams),
    );
    return {
      source,
      count,
      totalCarbsGrams: count * source.carbsPerServingGrams,
    };
  });

  if (
    requireAtLeastOne &&
    allocations.every((allocation) => allocation.count === 0)
  ) {
    const [first, ...rest] = allocations;
    return [
      {
        ...first,
        count: 1,
        totalCarbsGrams: first.source.carbsPerServingGrams,
      },
      ...rest,
    ];
  }

  return allocations;
}

// Space a number of servings evenly across the Run Duration.
//
// N servings split the Run into N + 1 equal gaps, so the runner has an equal
// stretch before the first serving, between each pair, and after the last one
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
