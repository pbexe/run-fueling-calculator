// Pure, framework-free composition of Fuel Sources into one Fueling Plan.
//
// A Run may combine several Fuel Sources. Under ADR-0002 (drink-first isotonic
// allocation) the Homemade Sports Drink is allocated against the Carb Target
// first, limited by the Fluid Target, and the selected solids (gels, bananas,
// chews) fill only the remainder, split sensibly across whichever solids are
// selected. This module holds that split plus the interleaved timeline, with
// no React or Next.js dependencies so the allocation rules can be unit tested
// in isolation. Terms follow CONTEXT.md: the Fueling Plan is the timeline of
// when to take each Fuel Source plus a shopping-list summary of totals, and
// the Homemade Sports Drink recipe when that source is selected.

import type { CarbTarget } from "./plan";
import {
  allocateSolidsForRun,
  carbTargetBandGrams,
  FUEL_SOURCES,
  formatTimeOffset,
  spaceServingsEvenly,
  targetCarbsGrams,
} from "./fuel";
import type { FuelSourceId, SolidAllocation } from "./fuel";
import { drinkCarbsGrams, drinkRecipe } from "./drink";
import type { DrinkRecipe } from "./drink";
import type { DrinkReminder } from "./hydration";

// Which Fuel Sources the runner has selected: any combination of solids
// (gels, bananas, chews) plus the Homemade Sports Drink, which also draws on
// the Fluid Target.
export interface FuelSelection {
  readonly solids: readonly FuelSourceId[];
  readonly drink: boolean;
}

// The hydration figures the drink allocation needs: the total volume the drink
// makes (the whole Fluid Target across the Run) and the drink reminders it is
// poured across, so drink amounts can interleave with solid servings.
export interface HydrationForFuel {
  readonly totalFluidMl: number;
  readonly timeline: readonly DrinkReminder[];
}

// Whether a timeline entry is a sip of the drink or a solid serving of a
// particular Fuel Source.
export type FuelTimelineKind = "drink" | FuelSourceId;

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
  // Display copy for the entry, e.g. "Gel", "Banana" or "Drink ~180 ml".
  readonly label: string;
  // For drink entries, roughly how much to drink at this point, in millilitres.
  readonly volumeMl: number | null;
}

// A warning surfaced alongside the plan: either the rounded totals fall
// outside the Carb Target band, or a solid's allocated count is impractical
// to carry (e.g. 4+ bananas). Both carry a suggestion for rebalancing.
export interface FuelingWarning {
  readonly kind: "band" | "impractical";
  readonly message: string;
}

// A combined Fueling Plan across the selected Fuel Sources: the drink-first
// carb split, the per-solid allocation, the scaled drink recipe, the
// interleaved timeline and any warnings.
export interface FuelingPlan {
  // Whether the Homemade Sports Drink is a selected Fuel Source.
  readonly drinkSelected: boolean;
  // One entry per selected solid Fuel Source, in FUEL_SOURCES order. A solid
  // that is not selected has no entry.
  readonly solidAllocations: readonly SolidAllocation[];
  // Carbs the drink delivers across the Run, in grams. Fixed by the Fluid
  // Target, so it can exceed the Carb Target when the drink alone meets it.
  readonly drinkCarbsGrams: number;
  // Carbs all selected solids deliver across the Run, in grams.
  readonly solidsCarbsGrams: number;
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
  // Warnings about the rounded totals or an impractical load, if any.
  readonly warnings: readonly FuelingWarning[];
}

function round(value: number): number {
  return Math.round(value);
}

// Build the Carb Target band warning: none while the Run needs no fuel or the
// totals sit inside the band, otherwise a message naming which way the plan
// missed and how to fix it.
function bandWarning(
  carbTarget: CarbTarget,
  durationMinutes: number,
  totalCarbsGrams: number,
): FuelingWarning | null {
  const band = carbTargetBandGrams(carbTarget, durationMinutes);
  if (band === null) {
    return null;
  }

  if (totalCarbsGrams < band.lowGrams) {
    return {
      kind: "band",
      message: `This plan delivers ${round(totalCarbsGrams)} g, below the ${round(band.lowGrams)} to ${round(band.highGrams)} g Carb Target. Add a drink or another serving to close the gap.`,
    };
  }

  if (totalCarbsGrams > band.highGrams) {
    return {
      kind: "band",
      message: `This plan delivers ${round(totalCarbsGrams)} g, above the ${round(band.lowGrams)} to ${round(band.highGrams)} g Carb Target. Drop a serving to rebalance.`,
    };
  }

  return null;
}

// Build impractical-load warnings: one per selected solid whose allocated
// count meets or exceeds that source's impractical threshold (e.g. 4+
// bananas), suggesting the runner rebalance onto a drink or another source.
function impracticalWarnings(
  allocations: readonly SolidAllocation[],
): FuelingWarning[] {
  const warnings: FuelingWarning[] = [];

  for (const allocation of allocations) {
    const threshold = allocation.source.impracticalServingThreshold;
    if (threshold === undefined || allocation.count < threshold) {
      continue;
    }

    const noun =
      allocation.count === 1
        ? allocation.source.servingNoun
        : allocation.source.servingNounPlural;
    warnings.push({
      kind: "impractical",
      message: `Carrying ${allocation.count} ${noun} is impractical. Add a drink or gels to cut the load.`,
    });
  }

  return warnings;
}

// Compose the selected Fuel Sources into one Fueling Plan.
//
// The drink, when selected, covers the whole Fluid Target and its carbs are
// subtracted from the Carb Target first (ADR-0002); the selected solids then
// fill only the remainder, split sensibly across whichever solids are
// selected and rounded to whole servings each. With no drink, solids are
// allocated against the full Carb Target under the usual at-least-one rule.
// Drink amounts and solid servings are merged into a single time-ordered
// timeline, and the plan carries any Carb Target band or impractical-load
// warnings.
export function planFueling(
  carbTarget: CarbTarget,
  durationMinutes: number,
  selection: FuelSelection,
  hydration: HydrationForFuel,
): FuelingPlan {
  const carbTargetTotalGrams = targetCarbsGrams(carbTarget, durationMinutes);

  const drinkSelected = selection.drink && hydration.totalFluidMl > 0;
  const drinkCarbs = drinkSelected
    ? drinkCarbsGrams(hydration.totalFluidMl)
    : 0;

  const remainderCarbs = Math.max(0, carbTargetTotalGrams - drinkCarbs);
  const drinkMeetsCarbTarget =
    carbTargetTotalGrams > 0 && drinkCarbs >= carbTargetTotalGrams;

  const selectedSources = FUEL_SOURCES.filter((source) =>
    selection.solids.includes(source.id),
  );

  const requireAtLeastOne =
    carbTarget.fuelNeeded && !drinkSelected && selectedSources.length > 0;

  const solidAllocations = allocateSolidsForRun(
    remainderCarbs,
    selectedSources,
    requireAtLeastOne,
  );

  const solidsCarbsGrams = solidAllocations.reduce(
    (sum, allocation) => sum + allocation.totalCarbsGrams,
    0,
  );

  // Interleave drink amounts with solid servings by time offset. Where a
  // drink amount and a solid serving land together the drink comes first,
  // since it is a continuous sip rather than a discrete serving.
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

  for (const allocation of solidAllocations) {
    const label =
      allocation.source.servingNoun.charAt(0).toUpperCase() +
      allocation.source.servingNoun.slice(1);
    for (const offsetMinutes of spaceServingsEvenly(
      allocation.count,
      durationMinutes,
    )) {
      entries.push({
        offsetMinutes,
        kind: allocation.source.id,
        label,
        volumeMl: null,
      });
    }
  }

  const kindRank = (kind: FuelTimelineKind): number => (kind === "drink" ? 0 : 1);
  entries.sort((a, b) => {
    if (a.offsetMinutes !== b.offsetMinutes) {
      return a.offsetMinutes - b.offsetMinutes;
    }
    return kindRank(a.kind) - kindRank(b.kind);
  });

  const timeline: FuelTimelineEntry[] = entries.map((entry, index) => ({
    ...entry,
    index: index + 1,
    offsetLabel: formatTimeOffset(entry.offsetMinutes),
  }));

  const totalCarbsGramsSum = drinkCarbs + solidsCarbsGrams;

  const warnings: FuelingWarning[] = [
    ...impracticalWarnings(solidAllocations),
    ...(carbTarget.fuelNeeded
      ? [bandWarning(carbTarget, durationMinutes, totalCarbsGramsSum)].filter(
          (warning): warning is FuelingWarning => warning !== null,
        )
      : []),
  ];

  return {
    drinkSelected,
    solidAllocations,
    drinkCarbsGrams: drinkCarbs,
    solidsCarbsGrams,
    totalCarbsGrams: totalCarbsGramsSum,
    carbTargetTotalGrams,
    drinkMeetsCarbTarget,
    recipe: drinkSelected ? drinkRecipe(hydration.totalFluidMl) : null,
    timeline,
    warnings,
  };
}
