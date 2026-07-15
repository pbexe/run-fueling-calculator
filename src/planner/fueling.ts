// Pure, framework-free composition of Fuel Sources into one Fueling Plan.
//
// A Run may combine several Fuel Sources. Under ADR-0002 (drink-first isotonic
// allocation) the Homemade Sports Drink is allocated against the Carb Target
// first, limited by the Fluid Target, and solids (gels) fill only the
// remainder. This module holds that split plus the interleaved timeline, with
// no React or Next.js dependencies so the allocation rules can be unit tested
// in isolation. Terms follow CONTEXT.md: the Fueling Plan is the timeline of
// when to take each Fuel Source plus a shopping-list summary of totals, and the
// Homemade Sports Drink recipe when that source is selected.

import type { CarbTarget } from "./plan";
import {
  formatTimeOffset,
  GEL_CARBS_GRAMS,
  gelCountForRun,
  spaceServingsEvenly,
  targetCarbsGrams,
} from "./fuel";
import { drinkCarbsGrams, drinkRecipe } from "./drink";
import type { DrinkRecipe } from "./drink";
import type { DrinkReminder } from "./hydration";

// Which Fuel Sources the runner has selected. Gels are the only solid for now;
// the Homemade Sports Drink is the only source that also draws on the Fluid
// Target. Both, either or neither may be on.
export interface FuelSelection {
  readonly gels: boolean;
  readonly drink: boolean;
}

// The hydration figures the drink allocation needs: the total volume the drink
// makes (the whole Fluid Target across the Run) and the drink reminders it is
// poured across, so drink amounts can interleave with solid servings.
export interface HydrationForFuel {
  readonly totalFluidMl: number;
  readonly timeline: readonly DrinkReminder[];
}

// Whether a timeline entry is a sip of the drink or a solid serving.
export type FuelTimelineKind = "drink" | "gel";

// One entry on the combined Fueling Plan timeline: a drink amount or a solid
// serving at a time offset from the start of the Run.
export interface FuelTimelineEntry {
  // 1-based position of this entry on the interleaved timeline.
  readonly index: number;
  // Minutes from the start of the Run at which to take it.
  readonly offsetMinutes: number;
  // The offset formatted as "H:MM" for display, e.g. "0:30".
  readonly offsetLabel: string;
  readonly kind: FuelTimelineKind;
  // Display copy for the entry, e.g. "Gel" or "Drink ~180 ml".
  readonly label: string;
  // For drink entries, roughly how much to drink at this point, in millilitres.
  readonly volumeMl: number | null;
}

// A combined Fueling Plan across the selected Fuel Sources: the drink-first
// carb split, the solid count, the scaled drink recipe and the interleaved
// timeline.
export interface FuelingPlan {
  // Whether the Homemade Sports Drink is a selected Fuel Source.
  readonly drinkSelected: boolean;
  // Whole gels to buy and carry.
  readonly gelCount: number;
  // Carbs delivered by one gel, in grams.
  readonly carbsPerGelGrams: number;
  // Carbs the drink delivers across the Run, in grams. Fixed by the Fluid
  // Target, so it can exceed the Carb Target when the drink alone meets it.
  readonly drinkCarbsGrams: number;
  // Carbs the allocated gels deliver across the Run, in grams.
  readonly gelCarbsGrams: number;
  // Carbs from all selected Fuel Sources across the Run, in grams.
  readonly totalCarbsGrams: number;
  // The total carbohydrate the Carb Target aims for across the Run, in grams:
  // what the sources are allocated against.
  readonly carbTargetTotalGrams: number;
  // True when the drink alone covers the whole Carb Target, so no solids are
  // needed on top.
  readonly drinkMeetsCarbTarget: boolean;
  // The scaled recipe when the drink is selected, otherwise null.
  readonly recipe: DrinkRecipe | null;
  // Drink amounts and solid servings merged in time order.
  readonly timeline: readonly FuelTimelineEntry[];
}

// The whole gels needed to fill the carb remainder after the drink, rounded to
// whole servings. Unlike the gels-only allocation there is no at-least-one
// floor here: the drink already contributes carbs, so a covered remainder
// correctly needs no gels.
export function gelCountForRemainder(
  remainderCarbsGrams: number,
  carbsPerGelGrams: number = GEL_CARBS_GRAMS,
): number {
  if (remainderCarbsGrams <= 0) {
    return 0;
  }
  return Math.max(0, Math.round(remainderCarbsGrams / carbsPerGelGrams));
}

// Compose the selected Fuel Sources into one Fueling Plan.
//
// The drink, when selected, covers the whole Fluid Target and its carbs are
// subtracted from the Carb Target first (ADR-0002); gels then fill only the
// remainder as whole servings. With no drink, gels are allocated against the
// full Carb Target under the usual at-least-one rule. Drink amounts and gel
// servings are merged into a single time-ordered timeline.
export function planFueling(
  carbTarget: CarbTarget,
  durationMinutes: number,
  selection: FuelSelection,
  hydration: HydrationForFuel,
  carbsPerGelGrams: number = GEL_CARBS_GRAMS,
): FuelingPlan {
  const carbTargetTotalGrams = targetCarbsGrams(carbTarget, durationMinutes);

  const drinkSelected = selection.drink && hydration.totalFluidMl > 0;
  const drinkCarbs = drinkSelected
    ? drinkCarbsGrams(hydration.totalFluidMl)
    : 0;

  const remainderCarbs = Math.max(0, carbTargetTotalGrams - drinkCarbs);
  const drinkMeetsCarbTarget =
    carbTargetTotalGrams > 0 && drinkCarbs >= carbTargetTotalGrams;

  let gelCount = 0;
  if (selection.gels) {
    gelCount = drinkSelected
      ? gelCountForRemainder(remainderCarbs, carbsPerGelGrams)
      : gelCountForRun(carbTarget, durationMinutes, carbsPerGelGrams);
  }

  const gelCarbsGrams = gelCount * carbsPerGelGrams;

  // Interleave drink amounts with gel servings by time offset. Where a drink
  // amount and a gel land together the drink comes first, since it is a
  // continuous sip rather than a discrete serving.
  const entries: Omit<FuelTimelineEntry, "index" | "offsetLabel">[] = [];

  if (drinkSelected) {
    for (const reminder of hydration.timeline) {
      entries.push({
        offsetMinutes: reminder.offsetMinutes,
        kind: "drink",
        label: `Drink ~${reminder.volumeMl} ml`,
        volumeMl: reminder.volumeMl,
      });
    }
  }

  for (const offsetMinutes of spaceServingsEvenly(gelCount, durationMinutes)) {
    entries.push({
      offsetMinutes,
      kind: "gel",
      label: "Gel",
      volumeMl: null,
    });
  }

  const kindRank: Record<FuelTimelineKind, number> = { drink: 0, gel: 1 };
  entries.sort((a, b) => {
    if (a.offsetMinutes !== b.offsetMinutes) {
      return a.offsetMinutes - b.offsetMinutes;
    }
    return kindRank[a.kind] - kindRank[b.kind];
  });

  const timeline: FuelTimelineEntry[] = entries.map((entry, index) => ({
    ...entry,
    index: index + 1,
    offsetLabel: formatTimeOffset(entry.offsetMinutes),
  }));

  return {
    drinkSelected,
    gelCount,
    carbsPerGelGrams,
    drinkCarbsGrams: drinkCarbs,
    gelCarbsGrams,
    totalCarbsGrams: drinkCarbs + gelCarbsGrams,
    carbTargetTotalGrams,
    drinkMeetsCarbTarget,
    recipe: drinkSelected ? drinkRecipe(hydration.totalFluidMl) : null,
    timeline,
  };
}
