import { describe, expect, it } from "vitest";

import {
  adjustedSweatRateMlPerHour,
  CONDITIONS,
  DEFAULT_CONDITIONS_ID,
  DEFAULT_SWEAT_RATE_PRESET_ID,
  FLUID_CAP_ML_PER_HOUR,
  FLUID_FLOOR_ML_PER_HOUR,
  fluidTargetMlPerHour,
  hasSweatRateOverride,
  planHydration,
  SWEAT_RATE_PRESETS,
} from "./hydration";
import type { SweatRateInput } from "./hydration";

function preset(
  presetId: SweatRateInput["presetId"],
): SweatRateInput {
  return { presetId, overrideMlPerHour: null };
}

function override(mlPerHour: number | null): SweatRateInput {
  return { presetId: "moderate", overrideMlPerHour: mlPerHour };
}

describe("SWEAT_RATE_PRESETS", () => {
  it("offers light, moderate and heavy presets", () => {
    expect(SWEAT_RATE_PRESETS.map((option) => option.id)).toEqual([
      "light",
      "moderate",
      "heavy",
    ]);
  });

  it("defaults the Sweat Rate to moderate", () => {
    expect(DEFAULT_SWEAT_RATE_PRESET_ID).toBe("moderate");
  });

  it("orders the preset Sweat Rates from light to heavy", () => {
    const rates = SWEAT_RATE_PRESETS.map((option) => option.mlPerHour);
    expect(rates[0]).toBeLessThan(rates[1]);
    expect(rates[1]).toBeLessThan(rates[2]);
  });
});

describe("CONDITIONS", () => {
  it("offers cool, mild, hot and very hot", () => {
    expect(CONDITIONS.map((option) => option.id)).toEqual([
      "cool",
      "mild",
      "hot",
      "very-hot",
    ]);
  });

  it("defaults the Conditions to mild with a neutral multiplier", () => {
    expect(DEFAULT_CONDITIONS_ID).toBe("mild");
    const mild = CONDITIONS.find((option) => option.id === "mild");
    expect(mild?.multiplier).toBe(1);
  });

  it("nudges the Sweat Rate up in the heat and down in the cool", () => {
    const cool = CONDITIONS.find((option) => option.id === "cool");
    const hot = CONDITIONS.find((option) => option.id === "hot");
    const veryHot = CONDITIONS.find((option) => option.id === "very-hot");
    expect(cool?.multiplier).toBeLessThan(1);
    expect(hot?.multiplier).toBeGreaterThan(1);
    expect(veryHot?.multiplier).toBeGreaterThan(hot?.multiplier ?? 0);
  });
});

describe("hasSweatRateOverride", () => {
  it("is false when there is no override", () => {
    expect(hasSweatRateOverride(preset("moderate"))).toBe(false);
  });

  it("is true for a positive override", () => {
    expect(hasSweatRateOverride(override(900))).toBe(true);
  });

  it("ignores a non-positive override", () => {
    expect(hasSweatRateOverride(override(0))).toBe(false);
    expect(hasSweatRateOverride(override(-100))).toBe(false);
  });
});

describe("adjustedSweatRateMlPerHour", () => {
  it("nudges the preset Sweat Rate by the Conditions multiplier", () => {
    // Moderate preset is 650 ml/h; hot multiplier is 1.2 -> 780 ml/h before
    // the cap is applied.
    expect(adjustedSweatRateMlPerHour(preset("moderate"), "hot")).toBeCloseTo(
      780,
      6,
    );
  });

  it("uses the mild baseline as the neutral Conditions", () => {
    expect(adjustedSweatRateMlPerHour(preset("moderate"), "mild")).toBe(650);
  });

  it("returns the override exactly and ignores the Conditions", () => {
    // 700 under very hot would nudge well past the cap if Conditions applied,
    // but an override is taken as measured and left untouched here.
    expect(adjustedSweatRateMlPerHour(override(700), "very-hot")).toBe(700);
  });
});

describe("fluidTargetMlPerHour", () => {
  it("caps the Fluid Target at the gut-absorption limit", () => {
    // Heavy preset (900) under very hot (1.4) is 1260 ml/h, well over the cap.
    const target = fluidTargetMlPerHour(preset("heavy"), "very-hot", 180);
    expect(target).toBe(FLUID_CAP_ML_PER_HOUR);
  });

  it("floors the Fluid Target for Runs over an hour", () => {
    // Light preset (450) under cool (0.85) is 382.5 ml/h, below the floor. A
    // 90 minute Run is over an hour, so the floor applies.
    const target = fluidTargetMlPerHour(preset("light"), "cool", 90);
    expect(target).toBe(FLUID_FLOOR_ML_PER_HOUR);
  });

  it("does not floor a Run of an hour or less", () => {
    // Same light-and-cool 382.5 ml/h, but a 45 minute Run is not over an hour,
    // so the floor is not applied and the adjusted rate stands (rounded).
    const target = fluidTargetMlPerHour(preset("light"), "cool", 45);
    expect(target).toBe(383);
    expect(target).toBeLessThan(FLUID_FLOOR_ML_PER_HOUR);
  });

  it("does not floor a Run of exactly one hour", () => {
    // The floor applies only over an hour, so 60 minutes exactly is excluded.
    const target = fluidTargetMlPerHour(preset("light"), "cool", 60);
    expect(target).toBe(383);
  });

  it("ignores the Conditions when an override is set", () => {
    // Override of 700 ml/h under very hot: if Conditions were applied it would
    // be nudged to 980 and capped to 750, but the override wins so it stays at
    // 700.
    const target = fluidTargetMlPerHour(override(700), "very-hot", 120);
    expect(target).toBe(700);
  });

  it("still caps an override above the gut-absorption limit", () => {
    // The cap is a physiological ceiling, so it applies even to a measured
    // override.
    const target = fluidTargetMlPerHour(override(1200), "mild", 120);
    expect(target).toBe(FLUID_CAP_ML_PER_HOUR);
  });

  it("leaves a mid-range Fluid Target untouched by the cap and floor", () => {
    // Moderate preset (650) under mild (1.0) sits between the floor and the
    // cap, so it passes through unchanged.
    const target = fluidTargetMlPerHour(preset("moderate"), "mild", 120);
    expect(target).toBe(650);
  });
});

describe("planHydration", () => {
  it("scales the total fluid by the Run Duration", () => {
    // 650 ml/h over a 2 hour Run is 1300 ml total.
    const plan = planHydration(preset("moderate"), "mild", 120);
    expect(plan.fluidTargetMlPerHour).toBe(650);
    expect(plan.totalFluidMl).toBe(1300);
  });

  it("spaces drink reminders every interval before the finish", () => {
    // A 60 minute Run gets reminders at 0:15, 0:30 and 0:45; the finish at
    // 1:00 is not a reminder.
    const plan = planHydration(preset("moderate"), "mild", 60);
    expect(plan.timeline.map((reminder) => reminder.offsetLabel)).toEqual([
      "0:15",
      "0:30",
      "0:45",
    ]);
  });

  it("flags when an override was used so Conditions can be explained", () => {
    const withOverride = planHydration(override(700), "very-hot", 120);
    const withPreset = planHydration(preset("moderate"), "very-hot", 120);
    expect(withOverride.usedOverride).toBe(true);
    expect(withPreset.usedOverride).toBe(false);
  });

  it("gives each reminder the fluid for one interval", () => {
    // 650 ml/h across a 15 minute interval is about 163 ml per reminder.
    const plan = planHydration(preset("moderate"), "mild", 120);
    for (const reminder of plan.timeline) {
      expect(reminder.volumeMl).toBe(163);
    }
  });

  it("produces no reminders for a Run shorter than one interval", () => {
    const plan = planHydration(preset("moderate"), "mild", 10);
    expect(plan.timeline).toEqual([]);
    // A short Run still reports the fluid it needs.
    expect(plan.totalFluidMl).toBeGreaterThan(0);
  });
});
