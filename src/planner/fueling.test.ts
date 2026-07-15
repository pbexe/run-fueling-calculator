import { describe, expect, it } from "vitest";

import { carbTargetForRunDuration } from "./plan";
import type { CarbTarget } from "./plan";
import type { DrinkReminder } from "./hydration";
import { planFueling } from "./fueling";
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

const GELS_ONLY: FuelSelection = { solids: ["gels"], drink: false };
const BANANAS_ONLY: FuelSelection = { solids: ["bananas"], drink: false };
const GELS_AND_BANANAS: FuelSelection = {
  solids: ["gels", "bananas"],
  drink: false,
};
const DRINK_ONLY: FuelSelection = { solids: [], drink: true };
const GELS_AND_DRINK: FuelSelection = { solids: ["gels"], drink: true };

describe("planFueling: drink only", () => {
  it("covers the whole Fluid Target and delivers 6% carbs", () => {
    const plan = planFueling(
      TWO_HOUR_TARGET,
      120,
      DRINK_ONLY,
      hydration(1000, [30, 60, 90]),
    );

    expect(plan.drinkSelected).toBe(true);
    expect(plan.solidAllocations).toEqual([]);
    // 1000 ml at 6 g per 100 ml is 60 g of carbs.
    expect(plan.drinkCarbsGrams).toBe(60);
    expect(plan.totalCarbsGrams).toBe(60);
    expect(plan.recipe).not.toBeNull();
    expect(plan.recipe?.totalVolumeMl).toBe(1000);
  });

  it("emits a recipe scaled to the plan's total volume", () => {
    const plan = planFueling(
      TWO_HOUR_TARGET,
      120,
      DRINK_ONLY,
      hydration(750, [30, 60, 90]),
    );
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
      GELS_AND_DRINK,
      hydration(750, [15, 30, 45, 60, 75, 90, 105]),
    );

    expect(plan.drinkCarbsGrams).toBe(45);
    expect(plan.solidAllocations).toHaveLength(1);
    expect(plan.solidAllocations[0]).toMatchObject({
      count: 3,
      totalCarbsGrams: 69,
    });
    expect(plan.solidsCarbsGrams).toBe(69);
    expect(plan.totalCarbsGrams).toBe(114);
    expect(plan.carbTargetTotalGrams).toBe(TWO_HOUR_TARGET_CARBS);
    expect(plan.drinkMeetsCarbTarget).toBe(false);
    expect(plan.warnings).toEqual([]);
  });

  it("interleaves drink amounts with the gel servings in time order", () => {
    const plan = planFueling(
      TWO_HOUR_TARGET,
      120,
      GELS_AND_DRINK,
      hydration(750, [15, 30, 45, 60, 75, 90, 105]),
    );

    const offsets = plan.timeline.map((entry) => entry.offsetMinutes);
    const sorted = [...offsets].sort((a, b) => a - b);
    expect(offsets).toEqual(sorted);

    const drinks = plan.timeline.filter((entry) => entry.kind === "drink");
    const gels = plan.timeline.filter((entry) => entry.kind === "gels");
    expect(drinks).toHaveLength(7);
    expect(gels).toHaveLength(3);
    // Gels are evenly spaced across the Run at 0:30, 1:00, 1:30.
    expect(gels.map((entry) => entry.offsetMinutes)).toEqual([30, 60, 90]);

    // Where a drink and a gel share an offset the drink comes first.
    const at60 = plan.timeline.filter((entry) => entry.offsetMinutes === 60);
    expect(at60.map((entry) => entry.kind)).toEqual(["drink", "gels"]);
  });
});

describe("planFueling: drink alone meets the Carb Target", () => {
  it("needs no solids even when gels are also selected", () => {
    // 2000 ml delivers 120 g, above the 105 g target, so the remainder is
    // covered and no gels are allocated.
    const plan = planFueling(
      TWO_HOUR_TARGET,
      120,
      GELS_AND_DRINK,
      hydration(2000, [30, 60, 90]),
    );

    expect(plan.drinkCarbsGrams).toBe(120);
    expect(plan.drinkMeetsCarbTarget).toBe(true);
    expect(plan.solidAllocations[0].count).toBe(0);
    expect(plan.timeline.every((entry) => entry.kind === "drink")).toBe(true);
  });
});

describe("planFueling: no drink", () => {
  it("falls back to the solids-only allocation with the at-least-one rule", () => {
    const plan = planFueling(
      TWO_HOUR_TARGET,
      120,
      GELS_ONLY,
      hydration(1000, [30, 60, 90]),
    );

    expect(plan.drinkSelected).toBe(false);
    expect(plan.recipe).toBeNull();
    expect(plan.drinkCarbsGrams).toBe(0);
    // 105 g target at 23 g per gel is 4.57 -> 5 gels.
    expect(plan.solidAllocations[0].count).toBe(5);
    expect(plan.timeline.every((entry) => entry.kind === "gels")).toBe(true);
  });
});

describe("planFueling: multi-solid allocation", () => {
  it("splits the Carb Target sensibly across gels and bananas", () => {
    // 105 g split evenly is 52.5 g each: gels 52.5/23 = 2.28 -> 2,
    // bananas 52.5/26 = 2.02 -> 2.
    const plan = planFueling(
      TWO_HOUR_TARGET,
      120,
      GELS_AND_BANANAS,
      hydration(0, []),
    );

    expect(plan.solidAllocations.map((a) => a.source.id)).toEqual([
      "gels",
      "bananas",
    ]);
    expect(plan.solidAllocations.map((a) => a.count)).toEqual([2, 2]);
    expect(plan.solidsCarbsGrams).toBe(98);
    expect(plan.warnings).toEqual([]);
  });

  it("builds a timeline entry per solid serving, labelled by source", () => {
    const plan = planFueling(
      TWO_HOUR_TARGET,
      120,
      GELS_AND_BANANAS,
      hydration(0, []),
    );

    const gelEntries = plan.timeline.filter((entry) => entry.kind === "gels");
    const bananaEntries = plan.timeline.filter(
      (entry) => entry.kind === "bananas",
    );
    expect(gelEntries).toHaveLength(2);
    expect(bananaEntries).toHaveLength(2);
    expect(gelEntries[0].label).toBe("Gel");
    expect(bananaEntries[0].label).toBe("Banana");
  });
});

describe("planFueling: Carb Target band warning", () => {
  const NARROW_LOW: CarbTarget = {
    fuelNeeded: true,
    gramsPerHourLow: 48,
    gramsPerHourHigh: 52,
  };
  const NARROW_HIGH: CarbTarget = {
    fuelNeeded: true,
    gramsPerHourLow: 40,
    gramsPerHourHigh: 42,
  };

  it("warns when the rounded total falls below the band", () => {
    // 1 hour Run: mid target 50 g, gels round 50/23 = 2.17 -> 2 gels = 46 g,
    // below the 48 to 52 g band.
    const plan = planFueling(NARROW_LOW, 60, GELS_ONLY, hydration(0, []));

    expect(plan.totalCarbsGrams).toBe(46);
    expect(plan.warnings).toHaveLength(1);
    expect(plan.warnings[0].kind).toBe("band");
    expect(plan.warnings[0].message).toMatch(/below/);
  });

  it("warns when the rounded total lands above the band", () => {
    // 1 hour Run: mid target 41 g, gels round 41/23 = 1.78 -> 2 gels = 46 g,
    // above the 40 to 42 g band.
    const plan = planFueling(NARROW_HIGH, 60, GELS_ONLY, hydration(0, []));

    expect(plan.totalCarbsGrams).toBe(46);
    expect(plan.warnings).toHaveLength(1);
    expect(plan.warnings[0].kind).toBe("band");
    expect(plan.warnings[0].message).toMatch(/above/);
  });

  it("has no band warning when the rounded total sits inside the band", () => {
    const plan = planFueling(
      TWO_HOUR_TARGET,
      120,
      GELS_AND_DRINK,
      hydration(750, [15, 30, 45, 60, 75, 90, 105]),
    );
    expect(plan.warnings.filter((w) => w.kind === "band")).toEqual([]);
  });
});

describe("planFueling: impractical load warning", () => {
  it("warns when bananas alone round up to 4 or more", () => {
    // 105 g target at 26 g per banana is 4.04 -> 4 bananas, at the
    // impractical threshold.
    const plan = planFueling(
      TWO_HOUR_TARGET,
      120,
      BANANAS_ONLY,
      hydration(0, []),
    );

    expect(plan.solidAllocations[0].count).toBe(4);
    const impractical = plan.warnings.filter((w) => w.kind === "impractical");
    expect(impractical).toHaveLength(1);
    expect(impractical[0].message).toMatch(/4 bananas/);
    expect(impractical[0].message).toMatch(/drink or gels/);
  });

  it("rebalancing onto gels alongside bananas avoids the impractical load", () => {
    const plan = planFueling(
      TWO_HOUR_TARGET,
      120,
      GELS_AND_BANANAS,
      hydration(0, []),
    );

    const bananaAllocation = plan.solidAllocations.find(
      (a) => a.source.id === "bananas",
    );
    expect(bananaAllocation?.count).toBeLessThan(4);
    expect(
      plan.warnings.filter((w) => w.kind === "impractical"),
    ).toEqual([]);
  });
});
