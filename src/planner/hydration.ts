// Pure, framework-free hydration planning for a Run.
//
// This module turns a Sweat Rate and the expected Conditions into a Fluid
// Target and a set of drink reminders, with no React or Next.js dependencies so
// the cap, floor and Conditions rules can be unit tested in isolation. Terms
// follow CONTEXT.md:
//   - Sweat Rate is how much fluid the runner loses per hour, chosen as a
//     qualitative preset (light / moderate / heavy, defaulting to moderate)
//     with an optional explicit ml-per-hour override for runners who have
//     measured theirs.
//   - Conditions are the expected weather (cool / mild / hot / very hot). They
//     nudge the preset-derived Sweat Rate but are ignored when an override is
//     set.
//   - The Fluid Target is the millilitres per hour to drink: the Sweat Rate
//     adjusted for Conditions, capped by gut absorption and floored for longer
//     Runs.
//
// Fluid is modelled as water in this slice; the Homemade Sports Drink, which
// also counts toward the Fluid Target, arrives in a later slice.

// A qualitative Sweat Rate the runner can pick without measuring theirs. The
// millilitres per hour are representative mid-points for each band.
export type SweatRatePresetId = "light" | "moderate" | "heavy";

export interface SweatRatePreset {
  readonly id: SweatRatePresetId;
  readonly label: string;
  // Fluid lost per hour for this band, in millilitres, before any Conditions
  // adjustment.
  readonly mlPerHour: number;
}

export const SWEAT_RATE_PRESETS: readonly SweatRatePreset[] = [
  { id: "light", label: "Light", mlPerHour: 450 },
  { id: "moderate", label: "Moderate", mlPerHour: 650 },
  { id: "heavy", label: "Heavy", mlPerHour: 900 },
];

// The Sweat Rate the plan assumes until the runner picks another: moderate.
export const DEFAULT_SWEAT_RATE_PRESET_ID: SweatRatePresetId = "moderate";

// The expected weather for the Run. Each Condition nudges the preset-derived
// Sweat Rate by a multiplier; mild is the neutral baseline.
export type ConditionsId = "cool" | "mild" | "hot" | "very-hot";

export interface Conditions {
  readonly id: ConditionsId;
  readonly label: string;
  // Multiplier applied to the preset Sweat Rate. Ignored when an explicit
  // ml-per-hour override is set.
  readonly multiplier: number;
}

export const CONDITIONS: readonly Conditions[] = [
  { id: "cool", label: "Cool", multiplier: 0.85 },
  { id: "mild", label: "Mild", multiplier: 1 },
  { id: "hot", label: "Hot", multiplier: 1.2 },
  { id: "very-hot", label: "Very hot", multiplier: 1.4 },
];

// The Conditions the plan assumes until the runner picks another: mild.
export const DEFAULT_CONDITIONS_ID: ConditionsId = "mild";

// Gut absorption limits how much fluid the plan should ask a runner to drink,
// so the Fluid Target is capped here however high the Sweat Rate.
export const FLUID_CAP_ML_PER_HOUR = 750;

// Runs over an hour get a floor so the plan never under-hydrates a longer
// effort even in cool Conditions with a light Sweat Rate.
export const FLUID_FLOOR_ML_PER_HOUR = 400;

// The floor only applies to Runs longer than this many minutes.
export const FLOOR_APPLIES_ABOVE_MINUTES = 60;

// How the runner has expressed their Sweat Rate: always a preset, plus an
// optional explicit ml-per-hour override for runners who have done a sweat
// test. When the override is set the Conditions adjustment is ignored.
export interface SweatRateInput {
  readonly presetId: SweatRatePresetId;
  readonly overrideMlPerHour: number | null;
}

// Whether a Sweat Rate override is present and usable. A non-positive or
// non-finite override is treated as absent.
export function hasSweatRateOverride(input: SweatRateInput): boolean {
  return (
    input.overrideMlPerHour !== null &&
    Number.isFinite(input.overrideMlPerHour) &&
    input.overrideMlPerHour > 0
  );
}

function presetMlPerHour(presetId: SweatRatePresetId): number {
  const preset = SWEAT_RATE_PRESETS.find((option) => option.id === presetId);
  return preset ? preset.mlPerHour : 0;
}

function conditionsMultiplier(conditionsId: ConditionsId): number {
  const condition = CONDITIONS.find((option) => option.id === conditionsId);
  return condition ? condition.multiplier : 1;
}

// The Sweat Rate before the cap and floor are applied, in millilitres per hour.
//
// With an override set this is the override exactly and the Conditions are
// ignored. Otherwise it is the preset Sweat Rate nudged by the Conditions
// multiplier.
export function adjustedSweatRateMlPerHour(
  input: SweatRateInput,
  conditionsId: ConditionsId,
): number {
  if (hasSweatRateOverride(input)) {
    return input.overrideMlPerHour as number;
  }

  return presetMlPerHour(input.presetId) * conditionsMultiplier(conditionsId);
}

// Size the Fluid Target, in millilitres per hour, from the Sweat Rate, the
// Conditions and the Run Duration.
//
// The Sweat Rate is adjusted for Conditions (unless an override is set), then
// capped at the gut-absorption limit and, for Runs over an hour, floored so the
// plan never under-hydrates a longer effort.
export function fluidTargetMlPerHour(
  input: SweatRateInput,
  conditionsId: ConditionsId,
  durationMinutes: number,
): number {
  const adjusted = adjustedSweatRateMlPerHour(input, conditionsId);

  let target = Math.min(adjusted, FLUID_CAP_ML_PER_HOUR);

  if (durationMinutes > FLOOR_APPLIES_ABOVE_MINUTES) {
    target = Math.max(target, FLUID_FLOOR_ML_PER_HOUR);
  }

  return Math.round(target);
}

// A drink reminder is roughly every quarter hour: frequent enough to keep the
// runner topped up without micromanaging every sip.
export const DRINK_INTERVAL_MINUTES = 15;

// One entry on the hydration timeline: a reminder to drink a volume of fluid at
// a time offset from the start of the Run.
export interface DrinkReminder {
  // 1-based position of this reminder on the timeline.
  readonly index: number;
  // Minutes from the start of the Run at which to drink.
  readonly offsetMinutes: number;
  // The offset formatted as "H:MM" for display, e.g. "0:15".
  readonly offsetLabel: string;
  // Roughly how much to drink at this reminder, in millilitres: the Fluid
  // Target spread across one drink interval.
  readonly volumeMl: number;
}

// A complete hydration plan for a Run: the Fluid Target, the total fluid to
// carry and the drink reminders to space it across the Run.
export interface HydrationPlan {
  // Millilitres per hour the plan tells the runner to drink.
  readonly fluidTargetMlPerHour: number;
  // Total fluid to drink across the whole Run, in millilitres.
  readonly totalFluidMl: number;
  // Whether the Sweat Rate came from an explicit override (so Conditions were
  // ignored). Lets the UI explain why Conditions had no effect.
  readonly usedOverride: boolean;
  // When to drink, spaced evenly across the Run Duration.
  readonly timeline: readonly DrinkReminder[];
}

// Format a time offset in minutes as "H:MM", e.g. 15 -> "0:15", 90 -> "1:30".
export function formatTimeOffset(offsetMinutes: number): string {
  const totalMinutes = Math.round(offsetMinutes);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${minutes.toString().padStart(2, "0")}`;
}

// Build the hydration plan for a Run: work out the Fluid Target, the total
// fluid across the Run, and a drink reminder at every interval that falls
// strictly before the finish (so no reminder lands on the finish line).
export function planHydration(
  input: SweatRateInput,
  conditionsId: ConditionsId,
  durationMinutes: number,
): HydrationPlan {
  const target = fluidTargetMlPerHour(input, conditionsId, durationMinutes);
  const hours = Math.max(0, durationMinutes) / 60;
  const totalFluidMl = Math.round(target * hours);
  const volumePerReminderMl = Math.round(
    (target * DRINK_INTERVAL_MINUTES) / 60,
  );

  const timeline: DrinkReminder[] = [];
  let offset = DRINK_INTERVAL_MINUTES;
  let index = 1;
  while (offset < durationMinutes) {
    timeline.push({
      index,
      offsetMinutes: offset,
      offsetLabel: formatTimeOffset(offset),
      volumeMl: volumePerReminderMl,
    });
    offset += DRINK_INTERVAL_MINUTES;
    index += 1;
  }

  return {
    fluidTargetMlPerHour: target,
    totalFluidMl,
    usedOverride: hasSweatRateOverride(input),
    timeline,
  };
}
