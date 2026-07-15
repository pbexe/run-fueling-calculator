import { describe, expect, it } from "vitest";

import { carbTargetForRunDuration } from "./plan";
import type { DrinkReminder } from "./hydration";
import { gelCountForRemainder, planFueling } from "./fueling";
import type { FuelSelection, HydrationForFuel } from "./fueling";

// A 2 hour Run sits in the moderate band: middle of 45 to 60 g/h is 52.5 g/h,
// so 105 g of carbohydrate across the Run.
const TWO_HOUR_TARGET = carbTargetForRunDuration(120);
const TWO_HOUR_TARGET_CARBS = 105;

// Build an evenly spaced set of drink reminders, standing in for the hydration
// timeline the drink is poured across.
function reminders(offsets: number[], volumeMl: number): DrinkReminder[] {
  return offsets.map((offsetMinutes, index) => ({
    index: index + 1,
    offsetMinutes,
    offsetLabel: `${Math.floor(offsetMinutes / 60)}:00`,
    volumeMl,
  }));
}

function hydration(totalFluidMl: number, offsets: number[]): HydrationForFuel {
  return { totalFluidMl, timeline: reminders(offsets, 180) };
}

const GELS_ONLY: FuelSelection = { gels: true, drink: false };
const DRINK_ONLY: FuelSelection = { gels: false, drink: true };
const BOTH: FuelSelection = { gels: true, drink: true };

describe("gelCountForRemainder", () => {
  it("needs no gels when the remainder is covered", () => {
    expect(gelCountForRemainder(0, 23)).toBe(0);
    expect(gelCountForRemainder(-10, 23)).toBe(0);
  });

  it("rounds the remainder to whole gels without an at-least-one floor", () => {
    // 60 g remainder at 23 g per gel is 2.6 gels -> 3.
    expect(gelCountForRemainder(60, 23)).toBe(3);
    // 10 g remainder at 23 g per gel rounds down to nothing.
    expect(gelCountForRemainder(10, 23)).toBe(0);
  });
});

describe("planFueling: drink only", () => {
  it("covers the whole Fluid Target and delivers 6% carbs", () => {
    const plan = planFueling(
      TWO_HOUR_TARGET,
      120,
      DRINK_ONLY,
      hydration(1000, [30, 60, 90]),
      23,
    );

    expect(plan.drinkSelected).toBe(true);
    expect(plan.gelCount).toBe(0);
    // 1000 ml at 6 g per 100 ml is 60 g of carbs.
    expect(plan.drinkCarbsGrams).toBe(60);
    expect(plan.totalCarbsGrams).toBe(60);
    expect(plan.recipe).not.toBeNull();
    expect(plan.recipe?.totalVolumeMl).toBe(1000);
  });

  it("emits a recipe scaled to the plan's total volume", () => {
    const plan = planFueling(TWO_HOUR_TARGET, 120, DRINK_ONLY, hydration(750, [30, 60, 90]), 23);
    expect(plan.recipe?.carbsGrams).toBe(45);
    expect(plan.recipe?.sugar.grams).toBe(45);
  });
});

describe("planFueling: drink plus gels", () => {
  it("allocates the drink first and fills the remainder with gels", () => {
    // 750 ml drink delivers 45 g of the 105 g target; 60 g remains, which at
    // 23 g per gel is 2.6 -> 3 gels.
    const plan = planFueling(
      TWO_HOUR_TARGET,
      120,
      BOTH,
      hydration(750, [15, 30, 45, 60, 75, 90, 105]),
      23,
    );

    expect(plan.drinkCarbsGrams).toBe(45);
    expect(plan.gelCount).toBe(3);
    expect(plan.gelCarbsGrams).toBe(69);
    expect(plan.totalCarbsGrams).toBe(114);
    expect(plan.carbTargetTotalGrams).toBe(TWO_HOUR_TARGET_CARBS);
    expect(plan.drinkMeetsCarbTarget).toBe(false);
  });

  it("interleaves drink amounts with the gel servings in time order", () => {
    const plan = planFueling(
      TWO_HOUR_TARGET,
      120,
      BOTH,
      hydration(750, [15, 30, 45, 60, 75, 90, 105]),
      23,
    );

    const offsets = plan.timeline.map((entry) => entry.offsetMinutes);
    const sorted = [...offsets].sort((a, b) => a - b);
    expect(offsets).toEqual(sorted);

    const drinks = plan.timeline.filter((entry) => entry.kind === "drink");
    const gels = plan.timeline.filter((entry) => entry.kind === "gel");
    expect(drinks).toHaveLength(7);
    expect(gels).toHaveLength(3);
    // Gels are evenly spaced across the Run at 0:30, 1:00, 1:30.
    expect(gels.map((entry) => entry.offsetMinutes)).toEqual([30, 60, 90]);

    // Where a drink and a gel share an offset the drink comes first.
    const at60 = plan.timeline.filter((entry) => entry.offsetMinutes === 60);
    expect(at60.map((entry) => entry.kind)).toEqual(["drink", "gel"]);
  });
});

describe("planFueling: drink alone meets the Carb Target", () => {
  it("needs no gels even when gels are also selected", () => {
    // 2000 ml delivers 120 g, above the 105 g target, so the remainder is
    // covered and no gels are allocated.
    const plan = planFueling(
      TWO_HOUR_TARGET,
      120,
      BOTH,
      hydration(2000, [30, 60, 90]),
      23,
    );

    expect(plan.drinkCarbsGrams).toBe(120);
    expect(plan.drinkMeetsCarbTarget).toBe(true);
    expect(plan.gelCount).toBe(0);
    expect(plan.timeline.every((entry) => entry.kind === "drink")).toBe(true);
  });
});

describe("planFueling: no drink", () => {
  it("falls back to the gels-only allocation with the at-least-one rule", () => {
    const plan = planFueling(
      TWO_HOUR_TARGET,
      120,
      GELS_ONLY,
      hydration(1000, [30, 60, 90]),
      23,
    );

    expect(plan.drinkSelected).toBe(false);
    expect(plan.recipe).toBeNull();
    expect(plan.drinkCarbsGrams).toBe(0);
    // 105 g target at 23 g per gel is 4.57 -> 5 gels.
    expect(plan.gelCount).toBe(5);
    expect(plan.timeline.every((entry) => entry.kind === "gel")).toBe(true);
  });
});
