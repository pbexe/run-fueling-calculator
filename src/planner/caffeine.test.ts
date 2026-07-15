import { describe, expect, it } from "vitest";

import {
  CAFFEINE_MIN_DURATION_MINUTES,
  CAFFEINE_TOTAL_CAP_MG,
  CAFFEINE_MG_PER_SLOT_HIGH,
  MAX_CAFFEINATED_SLOTS,
  planCaffeine,
} from "./caffeine";
import type { FuelTimelineEntry } from "./fueling";

// Build a minimal gel timeline entry at a given offset, matching the shape
// planFueling produces.
function gel(offsetMinutes: number, index: number): FuelTimelineEntry {
  return {
    index,
    offsetMinutes,
    offsetLabel: `${Math.floor(offsetMinutes / 60)}:00`,
    kind: "gels",
    label: "Gel",
    volumeMl: null,
  };
}

function drink(offsetMinutes: number, index: number): FuelTimelineEntry {
  return {
    index,
    offsetMinutes,
    offsetLabel: `${Math.floor(offsetMinutes / 60)}:00`,
    kind: "drink",
    label: "Drink ~180 ml",
    volumeMl: 180,
  };
}

describe("planCaffeine: duration threshold", () => {
  it("is ineligible just under the 2 hour threshold", () => {
    const plan = planCaffeine(
      [gel(30, 1), gel(60, 2), gel(90, 3)],
      CAFFEINE_MIN_DURATION_MINUTES - 1,
    );
    expect(plan.eligible).toBe(false);
    expect(plan.annotatedEntryIndexes.size).toBe(0);
  });

  it("is eligible exactly at the 2 hour threshold", () => {
    const plan = planCaffeine([gel(90, 1)], CAFFEINE_MIN_DURATION_MINUTES);
    expect(plan.eligible).toBe(true);
  });
});

describe("planCaffeine: slot selection", () => {
  it("only annotates gels in the final third of the Run", () => {
    // 3 hour Run: final third starts at 120 min.
    const timeline = [gel(45, 1), gel(90, 2), gel(135, 3), gel(150, 4)];
    const plan = planCaffeine(timeline, 180);

    expect(plan.annotatedEntryIndexes.has(1)).toBe(false);
    expect(plan.annotatedEntryIndexes.has(2)).toBe(false);
    expect(plan.annotatedEntryIndexes.has(3)).toBe(true);
  });

  it("ignores non-gel entries such as drink sips", () => {
    // 2 hour Run: final third starts at 80 min.
    const timeline = [drink(90, 1), gel(100, 2)];
    const plan = planCaffeine(timeline, 120);

    expect(plan.annotatedEntryIndexes.has(1)).toBe(false);
    expect(plan.annotatedEntryIndexes.has(2)).toBe(true);
  });

  it("annotates no gels when none fall in the final third", () => {
    // 3 hour Run: final third starts at 120 min; both gels are earlier.
    const timeline = [gel(30, 1), gel(60, 2)];
    const plan = planCaffeine(timeline, 180);

    expect(plan.annotatedEntryIndexes.size).toBe(0);
  });
});

describe("planCaffeine: total cap", () => {
  it("caps the number of annotated slots so the advisory total stays under the cap", () => {
    expect(MAX_CAFFEINATED_SLOTS).toBe(
      Math.floor(CAFFEINE_TOTAL_CAP_MG / CAFFEINE_MG_PER_SLOT_HIGH),
    );

    // 4 hour Run: final third starts at 160 min. 5 gels fall in it, well
    // beyond MAX_CAFFEINATED_SLOTS.
    const timeline = [
      gel(170, 1),
      gel(190, 2),
      gel(210, 3),
      gel(220, 4),
      gel(230, 5),
    ];
    const plan = planCaffeine(timeline, 240);

    expect(plan.annotatedEntryIndexes.size).toBe(MAX_CAFFEINATED_SLOTS);
    // Picks the earliest eligible gels within the final third.
    expect(plan.annotatedEntryIndexes.has(1)).toBe(true);
    expect(plan.annotatedEntryIndexes.has(2)).toBe(true);
    expect(plan.annotatedEntryIndexes.has(3)).toBe(false);
  });

  it("annotates every eligible gel when there are fewer than the cap allows", () => {
    const timeline = [gel(170, 1)];
    const plan = planCaffeine(timeline, 240);

    expect(plan.annotatedEntryIndexes.size).toBe(1);
    expect(plan.annotatedEntryIndexes.has(1)).toBe(true);
  });
});
