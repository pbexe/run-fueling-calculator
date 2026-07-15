// Pure, framework-free encode/decode between PlannerForm state and URL query
// params. This is the site's only persistence: a plan is shared, bookmarked or
// survives a refresh purely by round-tripping through the URL, so this module
// has no React or Next.js dependencies and every decode falls back field by
// field to a default rather than throwing on missing or malformed input.

import { DISTANCE_PRESETS } from "./plan";
import { FUEL_SOURCES } from "./fuel";
import type { FuelSourceId } from "./fuel";
import {
  CONDITIONS,
  DEFAULT_CONDITIONS_ID,
  DEFAULT_SWEAT_RATE_PRESET_ID,
  SWEAT_RATE_PRESETS,
} from "./hydration";
import type { ConditionsId, SweatRatePresetId } from "./hydration";

// Sentinel distanceId meaning "the runner typed a custom distance", used
// alongside the DISTANCE_PRESETS ids.
export const CUSTOM_DISTANCE_ID = "custom";

// The full shape of PlannerForm's inputs, shared between the component state
// and the URL query params.
export interface PlannerState {
  readonly distanceId: string;
  readonly customKm: string;
  readonly paceMinutes: string;
  readonly paceSeconds: string;
  readonly selectedSolidIds: readonly FuelSourceId[];
  readonly drinkSelected: boolean;
  readonly sweatRatePresetId: SweatRatePresetId;
  readonly sweatRateOverride: string;
  readonly conditionsId: ConditionsId;
}

// The state PlannerForm starts from with no query params at all, matching its
// original useState initial values.
export const DEFAULT_PLANNER_STATE: PlannerState = {
  distanceId: DISTANCE_PRESETS[0].id,
  customKm: "",
  paceMinutes: "6",
  paceSeconds: "0",
  selectedSolidIds: ["gels"],
  drinkSelected: false,
  sweatRatePresetId: DEFAULT_SWEAT_RATE_PRESET_ID,
  sweatRateOverride: "",
  conditionsId: DEFAULT_CONDITIONS_ID,
};

const PARAM_KEYS = {
  distance: "distance",
  km: "km",
  paceMinutes: "paceMin",
  paceSeconds: "paceSec",
  fuel: "fuel",
  drink: "drink",
  sweat: "sweat",
  sweatOverride: "sweatOverride",
  conditions: "conditions",
} as const;

const VALID_DISTANCE_IDS = new Set<string>([
  ...DISTANCE_PRESETS.map((preset) => preset.id),
  CUSTOM_DISTANCE_ID,
]);
const VALID_FUEL_SOURCE_IDS = new Set<string>(
  FUEL_SOURCES.map((source) => source.id),
);
const VALID_SWEAT_RATE_PRESET_IDS = new Set<string>(
  SWEAT_RATE_PRESETS.map((preset) => preset.id),
);
const VALID_CONDITIONS_IDS = new Set<string>(
  CONDITIONS.map((condition) => condition.id),
);

// Encode Planner state into URL query params so a plan can be shared,
// bookmarked and survive a refresh. Empty optional fields (no custom distance,
// no measured Sweat Rate) are omitted to keep shared URLs short.
export function encodePlannerState(state: PlannerState): URLSearchParams {
  const params = new URLSearchParams();

  params.set(PARAM_KEYS.distance, state.distanceId);
  if (state.distanceId === CUSTOM_DISTANCE_ID && state.customKm !== "") {
    params.set(PARAM_KEYS.km, state.customKm);
  }
  params.set(PARAM_KEYS.paceMinutes, state.paceMinutes);
  params.set(PARAM_KEYS.paceSeconds, state.paceSeconds);
  params.set(PARAM_KEYS.fuel, state.selectedSolidIds.join(","));
  params.set(PARAM_KEYS.drink, state.drinkSelected ? "1" : "0");
  params.set(PARAM_KEYS.sweat, state.sweatRatePresetId);
  if (state.sweatRateOverride !== "") {
    params.set(PARAM_KEYS.sweatOverride, state.sweatRateOverride);
  }
  params.set(PARAM_KEYS.conditions, state.conditionsId);

  return params;
}

// A bare number field (optionally negative, optionally decimal), matching
// what the number inputs in PlannerForm can produce, including the empty
// string for an untouched optional field.
const NUMERIC_FIELD_PATTERN = /^-?\d*\.?\d*$/;

function sanitizedNumberField(raw: string | null, fallback: string): string {
  if (raw === null) {
    return fallback;
  }
  return NUMERIC_FIELD_PATTERN.test(raw) ? raw : fallback;
}

function parseFuelSourceIds(raw: string): readonly FuelSourceId[] {
  const seen = new Set<FuelSourceId>();
  const ids: FuelSourceId[] = [];

  for (const candidate of raw.split(",")) {
    const trimmed = candidate.trim();
    if (VALID_FUEL_SOURCE_IDS.has(trimmed) && !seen.has(trimmed as FuelSourceId)) {
      seen.add(trimmed as FuelSourceId);
      ids.push(trimmed as FuelSourceId);
    }
  }

  return ids;
}

// Decode Planner state from URL query params, falling back field by field to
// DEFAULT_PLANNER_STATE for anything missing, malformed, or outside the known
// set of ids - so a broken or partial share link never crashes, it just falls
// back to sensible defaults for the affected fields.
export function decodePlannerState(params: URLSearchParams): PlannerState {
  const distanceIdRaw = params.get(PARAM_KEYS.distance);
  const distanceId =
    distanceIdRaw !== null && VALID_DISTANCE_IDS.has(distanceIdRaw)
      ? distanceIdRaw
      : DEFAULT_PLANNER_STATE.distanceId;

  const fuelRaw = params.get(PARAM_KEYS.fuel);
  const selectedSolidIds =
    fuelRaw === null
      ? DEFAULT_PLANNER_STATE.selectedSolidIds
      : parseFuelSourceIds(fuelRaw);

  const drinkRaw = params.get(PARAM_KEYS.drink);
  const drinkSelected =
    drinkRaw === "1" ? true : drinkRaw === "0" ? false : DEFAULT_PLANNER_STATE.drinkSelected;

  const sweatRatePresetIdRaw = params.get(PARAM_KEYS.sweat);
  const sweatRatePresetId = (
    sweatRatePresetIdRaw !== null &&
    VALID_SWEAT_RATE_PRESET_IDS.has(sweatRatePresetIdRaw)
      ? sweatRatePresetIdRaw
      : DEFAULT_PLANNER_STATE.sweatRatePresetId
  ) as SweatRatePresetId;

  const conditionsIdRaw = params.get(PARAM_KEYS.conditions);
  const conditionsId = (
    conditionsIdRaw !== null && VALID_CONDITIONS_IDS.has(conditionsIdRaw)
      ? conditionsIdRaw
      : DEFAULT_PLANNER_STATE.conditionsId
  ) as ConditionsId;

  return {
    distanceId,
    customKm: sanitizedNumberField(
      params.get(PARAM_KEYS.km),
      DEFAULT_PLANNER_STATE.customKm,
    ),
    paceMinutes: sanitizedNumberField(
      params.get(PARAM_KEYS.paceMinutes),
      DEFAULT_PLANNER_STATE.paceMinutes,
    ),
    paceSeconds: sanitizedNumberField(
      params.get(PARAM_KEYS.paceSeconds),
      DEFAULT_PLANNER_STATE.paceSeconds,
    ),
    selectedSolidIds,
    drinkSelected,
    sweatRatePresetId,
    sweatRateOverride: sanitizedNumberField(
      params.get(PARAM_KEYS.sweatOverride),
      DEFAULT_PLANNER_STATE.sweatRateOverride,
    ),
    conditionsId,
  };
}
