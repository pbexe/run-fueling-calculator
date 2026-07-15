import { describe, expect, it } from "vitest";

import {
  carbTargetForRunDuration,
  DISTANCE_PRESETS,
  formatRunDuration,
  paceToMinutesPerKm,
  runDurationMinutes,
} from "./plan";

describe("runDurationMinutes", () => {
  it("multiplies distance by pace to derive time on feet", () => {
    // 10 km at 6 min/km is a 60 minute Run.
    expect(runDurationMinutes(10, 6)).toBe(60);
  });

  it("derives the Run Duration for a marathon preset", () => {
    const marathon = DISTANCE_PRESETS.find((preset) => preset.id === "marathon");
    expect(marathon).toBeDefined();
    // 42.195 km at 6 min/km is just over 4 hours.
    expect(runDurationMinutes(marathon!.km, 6)).toBeCloseTo(253.17, 2);
  });
});

describe("paceToMinutesPerKm", () => {
  it("combines whole minutes and seconds into minutes per km", () => {
    expect(paceToMinutesPerKm(5, 30)).toBe(5.5);
  });
});

describe("carbTargetForRunDuration band boundaries", () => {
  it("needs no fuel just under the 75 minute threshold", () => {
    const target = carbTargetForRunDuration(74);
    expect(target.fuelNeeded).toBe(false);
    expect(target.gramsPerHourLow).toBeNull();
    expect(target.gramsPerHourHigh).toBeNull();
  });

  it("enters the moderate band exactly at 75 minutes", () => {
    const target = carbTargetForRunDuration(75);
    expect(target.fuelNeeded).toBe(true);
    expect(target.gramsPerHourLow).toBe(45);
    expect(target.gramsPerHourHigh).toBe(60);
  });

  it("stays in the moderate band just over the threshold", () => {
    const target = carbTargetForRunDuration(76);
    expect(target.fuelNeeded).toBe(true);
    expect(target.gramsPerHourLow).toBe(45);
    expect(target.gramsPerHourHigh).toBe(60);
  });

  it("stays in the moderate band at 2.4 hours", () => {
    const target = carbTargetForRunDuration(2.4 * 60);
    expect(target.gramsPerHourLow).toBe(45);
    expect(target.gramsPerHourHigh).toBe(60);
  });

  it("stays in the moderate band exactly at 2.5 hours", () => {
    const target = carbTargetForRunDuration(150);
    expect(target.gramsPerHourLow).toBe(45);
    expect(target.gramsPerHourHigh).toBe(60);
  });

  it("enters the long band just over 2.5 hours", () => {
    const target = carbTargetForRunDuration(151);
    expect(target.gramsPerHourLow).toBe(60);
    expect(target.gramsPerHourHigh).toBe(90);
  });

  it("sits in the long band at 2.6 hours", () => {
    const target = carbTargetForRunDuration(2.6 * 60);
    expect(target.fuelNeeded).toBe(true);
    expect(target.gramsPerHourLow).toBe(60);
    expect(target.gramsPerHourHigh).toBe(90);
  });
});

describe("formatRunDuration", () => {
  it("formats sub-hour durations in minutes", () => {
    expect(formatRunDuration(45)).toBe("45 min");
  });

  it("formats whole-hour durations without minutes", () => {
    expect(formatRunDuration(120)).toBe("2 h");
  });

  it("formats mixed durations as hours and minutes", () => {
    expect(formatRunDuration(83)).toBe("1 h 23 min");
  });

  it("rounds to the nearest minute", () => {
    expect(formatRunDuration(59.6)).toBe("1 h");
  });
});

describe("DISTANCE_PRESETS", () => {
  it("offers 5k, 10k, half marathon and marathon", () => {
    expect(DISTANCE_PRESETS.map((preset) => preset.id)).toEqual([
      "5k",
      "10k",
      "half",
      "marathon",
    ]);
  });
});
