// Pure, framework-free planner logic for a Run.
//
// This module holds the domain calculations with no React or Next.js
// dependencies so the band rules can be unit tested in isolation. Terms follow
// CONTEXT.md: a Run is a distance and a pace, its Run Duration is the derived
// time on feet, and the Carb Target is the grams of carbohydrate per hour set
// by the duration band the Run Duration falls into.

// A distance the runner can pick without typing a custom value. Distances are
// in kilometres; the unit toggle is a later slice.
export interface DistancePreset {
  readonly id: string;
  readonly label: string;
  readonly km: number;
}

export const DISTANCE_PRESETS: readonly DistancePreset[] = [
  { id: "5k", label: "5k", km: 5 },
  { id: "10k", label: "10k", km: 10 },
  { id: "half", label: "Half marathon", km: 21.0975 },
  { id: "marathon", label: "Marathon", km: 42.195 },
];

// Duration band boundaries, in minutes.
//
// Under this many minutes a Run needs no fuel: it has no Carb Target.
export const NO_FUEL_THRESHOLD_MINUTES = 75;

// At or below this many minutes (2.5 hours) the Run sits in the moderate band;
// above it the Run sits in the long band.
export const LONG_RUN_THRESHOLD_MINUTES = 150;

// The Carb Target for a Run: the grams of carbohydrate per hour the plan aims
// to deliver. Runs under the no-fuel threshold have no Carb Target, signalled
// by fuelNeeded being false and the gram bounds being null.
export interface CarbTarget {
  readonly fuelNeeded: boolean;
  readonly gramsPerHourLow: number | null;
  readonly gramsPerHourHigh: number | null;
}

// Derive the Run Duration, in minutes, from a distance (km) and a pace
// (minutes per km). Fueling and hydration needs scale with Run Duration, not
// distance.
export function runDurationMinutes(
  distanceKm: number,
  paceMinutesPerKm: number,
): number {
  return distanceKm * paceMinutesPerKm;
}

// Convert a pace expressed as whole minutes plus seconds into minutes per km.
export function paceToMinutesPerKm(minutes: number, seconds: number): number {
  return minutes + seconds / 60;
}

// Size the Carb Target from a Run Duration using the duration bands:
//   - under 75 minutes: no Carb Target, no fuel needed
//   - 75 minutes to 2.5 hours: 45 to 60 g/h
//   - over 2.5 hours: 60 to 90 g/h
export function carbTargetForRunDuration(
  durationMinutes: number,
): CarbTarget {
  if (durationMinutes < NO_FUEL_THRESHOLD_MINUTES) {
    return { fuelNeeded: false, gramsPerHourLow: null, gramsPerHourHigh: null };
  }

  if (durationMinutes <= LONG_RUN_THRESHOLD_MINUTES) {
    return { fuelNeeded: true, gramsPerHourLow: 45, gramsPerHourHigh: 60 };
  }

  return { fuelNeeded: true, gramsPerHourLow: 60, gramsPerHourHigh: 90 };
}

// Format a Run Duration in minutes as a human-readable "1 h 23 min" string.
export function formatRunDuration(durationMinutes: number): string {
  const totalMinutes = Math.round(durationMinutes);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${minutes} min`;
}
