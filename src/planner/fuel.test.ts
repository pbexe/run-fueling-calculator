import { describe, expect, it } from "vitest";

import { carbTargetForRunDuration } from "./plan";
import type { CarbTarget } from "./plan";
import {
  allocateSolidsForRun,
  BANANA_CARBS_GRAMS,
  BANANA_IMPRACTICAL_THRESHOLD,
  BANANAS,
  carbTargetBandGrams,
  CHEW_CARBS_GRAMS,
  CHEW_CARBS_PER_PIECE_GRAMS,
  CHEW_PIECES_PER_HANDFUL,
  CHEWS,
  formatTimeOffset,
  FUEL_SOURCES,
  GEL_CARBS_GRAMS,
  GELS,
  spaceServingsEvenly,
} from "./fuel";

const NO_FUEL: CarbTarget = {
  fuelNeeded: false,
  gramsPerHourLow: null,
  gramsPerHourHigh: null,
};

describe("FUEL_SOURCES", () => {
  it("offers gels, bananas and chews as selectable Fuel Sources", () => {
    expect(FUEL_SOURCES.map((source) => source.id)).toEqual([
      "gels",
      "bananas",
      "chews",
    ]);
  });

  it("models a gel at roughly 22 to 25 g of carbohydrate", () => {
    expect(GEL_CARBS_GRAMS).toBeGreaterThanOrEqual(22);
    expect(GEL_CARBS_GRAMS).toBeLessThanOrEqual(25);
  });

  it("models a banana at roughly 25 to 27 g of carbohydrate", () => {
    expect(BANANA_CARBS_GRAMS).toBeGreaterThanOrEqual(25);
    expect(BANANA_CARBS_GRAMS).toBeLessThanOrEqual(27);
    expect(BANANAS.carbsPerServingGrams).toBe(BANANA_CARBS_GRAMS);
  });

  it("flags bananas as impractical at the 4+ threshold", () => {
    expect(BANANA_IMPRACTICAL_THRESHOLD).toBe(4);
    expect(BANANAS.impracticalServingThreshold).toBe(4);
  });

  it("models chews at ~5 g carbs per piece, dosed in handfuls", () => {
    expect(CHEW_CARBS_PER_PIECE_GRAMS).toBe(5);
    expect(CHEW_PIECES_PER_HANDFUL).toBeGreaterThan(1);
    expect(CHEW_CARBS_GRAMS).toBe(
      CHEW_CARBS_PER_PIECE_GRAMS * CHEW_PIECES_PER_HANDFUL,
    );
    expect(CHEWS.carbsPerServingGrams).toBe(CHEW_CARBS_GRAMS);
    expect(CHEWS.piecesPerServing).toBe(CHEW_PIECES_PER_HANDFUL);
  });
});

describe("carbTargetBandGrams", () => {
  it("returns null when the Run needs no fuel", () => {
    expect(carbTargetBandGrams(NO_FUEL, 60)).toBeNull();
  });

  it("scales the g/h band by the Run Duration", () => {
    // 2 hour Run in the moderate band: 45 to 60 g/h over 2 hours.
    const target = carbTargetForRunDuration(120);
    expect(carbTargetBandGrams(target, 120)).toEqual({
      lowGrams: 90,
      highGrams: 120,
    });
  });
});

describe("allocateSolidsForRun", () => {
  it("returns no allocations when no sources are selected", () => {
    expect(allocateSolidsForRun(105, [], true)).toEqual([]);
  });

  it("allocates a single source to hit the middle of the Carb Target band", () => {
    // 105 g target at 23 g per gel is 4.57 -> 5 gels.
    const [allocation] = allocateSolidsForRun(105, [GELS], true);
    expect(allocation.source.id).toBe("gels");
    expect(allocation.count).toBe(5);
    expect(allocation.totalCarbsGrams).toBe(115);
  });

  it("splits the target evenly across two sources and rounds each independently", () => {
    // 105 g split evenly is 52.5 g each: gels 52.5/23 = 2.28 -> 2,
    // bananas 52.5/26 = 2.02 -> 2.
    const [gels, bananas] = allocateSolidsForRun(105, [GELS, BANANAS], true);
    expect(gels).toMatchObject({ count: 2, totalCarbsGrams: 46 });
    expect(bananas).toMatchObject({ count: 2, totalCarbsGrams: 52 });
  });

  it("allocates sensibly across three different solids", () => {
    // 105 g split three ways is 35 g each: gels 35/23 = 1.52 -> 2,
    // bananas 35/26 = 1.35 -> 1, chews 35/20 = 1.75 -> 2.
    const [gels, bananas, chews] = allocateSolidsForRun(
      105,
      [GELS, BANANAS, CHEWS],
      true,
    );
    expect(gels.count).toBe(2);
    expect(bananas.count).toBe(1);
    expect(chews.count).toBe(2);
  });

  it("allows a source to round down to zero when it is not required to floor", () => {
    // 10 g remainder at 23 g per gel rounds down to nothing, and no floor
    // applies because a drink already covers the rest of the target.
    const [allocation] = allocateSolidsForRun(10, [GELS], false);
    expect(allocation.count).toBe(0);
    expect(allocation.totalCarbsGrams).toBe(0);
  });

  it("bumps the first source to one serving when every source would round to zero and a floor is required", () => {
    const [gels, bananas] = allocateSolidsForRun(0, [GELS, BANANAS], true);
    expect(gels.count).toBe(1);
    expect(gels.totalCarbsGrams).toBe(GEL_CARBS_GRAMS);
    expect(bananas.count).toBe(0);
  });

  it("does not bump when the floor is not required", () => {
    const [gels, bananas] = allocateSolidsForRun(0, [GELS, BANANAS], false);
    expect(gels.count).toBe(0);
    expect(bananas.count).toBe(0);
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
