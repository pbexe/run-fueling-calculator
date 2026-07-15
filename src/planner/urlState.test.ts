import { describe, expect, it } from "vitest";

import {
  DEFAULT_PLANNER_STATE,
  decodePlannerState,
  encodePlannerState,
  type PlannerState,
} from "./urlState";

describe("encodePlannerState / decodePlannerState round-trip", () => {
  it("round-trips the default state", () => {
    const params = encodePlannerState(DEFAULT_PLANNER_STATE);
    expect(decodePlannerState(params)).toEqual(DEFAULT_PLANNER_STATE);
  });

  it("round-trips a fully customised state", () => {
    const state: PlannerState = {
      distanceId: "custom",
      customKm: "15.5",
      paceMinutes: "5",
      paceSeconds: "45",
      selectedSolidIds: ["bananas", "chews"],
      drinkSelected: true,
      sweatRatePresetId: "heavy",
      sweatRateOverride: "820",
      conditionsId: "hot",
    };

    const params = encodePlannerState(state);
    expect(decodePlannerState(params)).toEqual(state);
  });

  it("round-trips no solids selected", () => {
    const state: PlannerState = {
      ...DEFAULT_PLANNER_STATE,
      selectedSolidIds: [],
    };

    const params = encodePlannerState(state);
    expect(decodePlannerState(params)).toEqual(state);
  });

  it("omits empty optional fields from the encoded params", () => {
    const params = encodePlannerState(DEFAULT_PLANNER_STATE);
    expect(params.has("km")).toBe(false);
    expect(params.has("sweatOverride")).toBe(false);
  });
});

describe("decodePlannerState with missing or malformed params", () => {
  it("falls back to the default state for an empty query string", () => {
    expect(decodePlannerState(new URLSearchParams())).toEqual(
      DEFAULT_PLANNER_STATE,
    );
  });

  it("falls back field by field for an unknown distance id", () => {
    const params = new URLSearchParams({ distance: "moon-marathon" });
    expect(decodePlannerState(params).distanceId).toBe(
      DEFAULT_PLANNER_STATE.distanceId,
    );
  });

  it("falls back for a non-numeric pace", () => {
    const params = new URLSearchParams({
      paceMin: "fast",
      paceSec: "<script>",
    });
    const state = decodePlannerState(params);
    expect(state.paceMinutes).toBe(DEFAULT_PLANNER_STATE.paceMinutes);
    expect(state.paceSeconds).toBe(DEFAULT_PLANNER_STATE.paceSeconds);
  });

  it("drops unknown fuel source ids and de-duplicates the rest", () => {
    const params = new URLSearchParams({
      fuel: "gels,gels,unknown-source,bananas",
    });
    expect(decodePlannerState(params).selectedSolidIds).toEqual([
      "gels",
      "bananas",
    ]);
  });

  it("falls back for a malformed drink flag", () => {
    const params = new URLSearchParams({ drink: "yes" });
    expect(decodePlannerState(params).drinkSelected).toBe(
      DEFAULT_PLANNER_STATE.drinkSelected,
    );
  });

  it("falls back for an unknown sweat rate preset and conditions id", () => {
    const params = new URLSearchParams({
      sweat: "extreme",
      conditions: "arctic",
    });
    const state = decodePlannerState(params);
    expect(state.sweatRatePresetId).toBe(
      DEFAULT_PLANNER_STATE.sweatRatePresetId,
    );
    expect(state.conditionsId).toBe(DEFAULT_PLANNER_STATE.conditionsId);
  });

  it("ignores a non-numeric custom distance and sweat override", () => {
    const params = new URLSearchParams({
      distance: "custom",
      km: "not-a-number",
      sweatOverride: "lots",
    });
    const state = decodePlannerState(params);
    expect(state.customKm).toBe("");
    expect(state.sweatRateOverride).toBe("");
  });

  it("only applies partial overrides, defaulting everything else", () => {
    const params = new URLSearchParams({ distance: "marathon" });
    const state = decodePlannerState(params);
    expect(state.distanceId).toBe("marathon");
    expect(state.paceMinutes).toBe(DEFAULT_PLANNER_STATE.paceMinutes);
    expect(state.selectedSolidIds).toEqual(
      DEFAULT_PLANNER_STATE.selectedSolidIds,
    );
  });
});
