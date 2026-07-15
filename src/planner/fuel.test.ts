import { describe, expect, it } from "vitest";

import { carbTargetForRunDuration } from "./plan";
import type { CarbTarget } from "./plan";
import {
  FUEL_SOURCES,
  formatTimeOffset,
  GEL_CARBS_GRAMS,
  gelCountForRun,
  planGels,
  spaceServingsEvenly,
} from "./fuel";

const NO_FUEL: CarbTarget = {
  fuelNeeded: false,
  gramsPerHourLow: null,
  gramsPerHourHigh: null,
};

describe("FUEL_SOURCES", () => {
  it("offers gels as a selectable Fuel Source", () => {
    expect(FUEL_SOURCES.map((source) => source.id)).toEqual(["gels"]);
  });

  it("models a gel at roughly 22 to 25 g of carbohydrate", () => {
    expect(GEL_CARBS_GRAMS).toBeGreaterThanOrEqual(22);
    expect(GEL_CARBS_GRAMS).toBeLessThanOrEqual(25);
  });
});

describe("gelCountForRun", () => {
  it("allocates no gels when the Run needs no fuel", () => {
    expect(gelCountForRun(NO_FUEL, 60)).toBe(0);
  });

  it("allocates whole gels to hit the middle of the Carb Target band", () => {
    // 2 hour Run in the moderate band: middle of 45 to 60 g/h is 52.5 g/h,
    // so 105 g over the Run. At 23 g per gel that is 4.57 gels -> 5.
    const target = carbTargetForRunDuration(120);
    expect(gelCountForRun(target, 120, 23)).toBe(5);
  });

  it("rounds the allocation to the nearest whole gel", () => {
    // 3 hour Run in the long band: middle of 60 to 90 g/h is 75 g/h, so 225 g.
    // At 23 g per gel that is 9.78 gels -> 10.
    const target = carbTargetForRunDuration(180);
    expect(gelCountForRun(target, 180, 23)).toBe(10);
  });

  it("always allocates at least one gel when fuel is needed", () => {
    // Just into the moderate band with an oversized gel: the rounded count
    // would be below one, but a fuelled Run must get at least one gel.
    const target = carbTargetForRunDuration(75);
    expect(gelCountForRun(target, 75, 1000)).toBe(1);
  });

  it("scales the count with a different gel carb value", () => {
    // Same 2 hour Run (105 g target) but 25 g gels: 4.2 -> 4 gels.
    const target = carbTargetForRunDuration(120);
    expect(gelCountForRun(target, 120, 25)).toBe(4);
  });
});

describe("spaceServingsEvenly", () => {
  it("returns no offsets when there are no servings", () => {
    expect(spaceServingsEvenly(0, 120)).toEqual([]);
  });

  it("splits the Run Duration into equal gaps around the servings", () => {
    // 3 gels across a 2 hour Run: 4 equal 30 min gaps.
    expect(spaceServingsEvenly(3, 120)).toEqual([30, 60, 90]);
  });

  it("keeps the first and last serving off the start and the finish", () => {
    const offsets = spaceServingsEvenly(4, 200);
    expect(offsets[0]).toBeGreaterThan(0);
    expect(offsets[offsets.length - 1]).toBeLessThan(200);
  });

  it("spaces every serving by an equal interval", () => {
    const offsets = spaceServingsEvenly(5, 180);
    const gaps = offsets.slice(1).map((offset, i) => offset - offsets[i]);
    for (const gap of gaps) {
      expect(gap).toBeCloseTo(180 / 6, 10);
    }
  });
});

describe("formatTimeOffset", () => {
  it("formats a half hour offset as 0:30", () => {
    expect(formatTimeOffset(30)).toBe("0:30");
  });

  it("pads the minutes to two digits", () => {
    expect(formatTimeOffset(65)).toBe("1:05");
  });

  it("formats a whole hour offset as H:00", () => {
    expect(formatTimeOffset(120)).toBe("2:00");
  });

  it("rounds to the nearest minute", () => {
    expect(formatTimeOffset(18.75)).toBe("0:19");
  });
});

describe("planGels", () => {
  it("produces an empty plan when the Run needs no fuel", () => {
    const plan = planGels(NO_FUEL, 60);
    expect(plan.gelCount).toBe(0);
    expect(plan.totalCarbsGrams).toBe(0);
    expect(plan.timeline).toEqual([]);
  });

  it("builds a timeline with one entry per allocated gel", () => {
    const target = carbTargetForRunDuration(120);
    const plan = planGels(target, 120, 23);

    expect(plan.gelCount).toBe(5);
    expect(plan.timeline).toHaveLength(5);
    expect(plan.timeline.map((serving) => serving.index)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it("evenly spaces the timeline and labels each offset", () => {
    // 3 gels across a 2 hour Run land at 0:30, 1:00, 1:30.
    const target = carbTargetForRunDuration(120);
    const plan = planGels(target, 120, 35);

    expect(plan.gelCount).toBe(3);
    expect(plan.timeline.map((serving) => serving.offsetLabel)).toEqual([
      "0:30",
      "1:00",
      "1:30",
    ]);
  });

  it("reports total carbs as whole gels times carbs per gel", () => {
    const target = carbTargetForRunDuration(120);
    const plan = planGels(target, 120, 23);
    expect(plan.totalCarbsGrams).toBe(plan.gelCount * 23);
    expect(plan.carbsPerGelGrams).toBe(23);
  });
});
