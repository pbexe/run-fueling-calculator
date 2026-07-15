// Pure, framework-free conversion helpers between the metric (km, min/km) and
// imperial (mi, min/mi) unit systems used by the distance and pace toggle.
//
// This module has no React or Next.js dependencies so the conversion round
// trips can be unit tested in isolation. Distances and paces are always held
// in metric internally (km, min/km) - see plan.ts and urlState.ts - so this
// module is only consulted at the presentation edge: formatting a value for
// display in the runner's chosen unit, or parsing a value the runner typed in
// that unit back into metric.

export type UnitSystem = "metric" | "imperial";

export const DEFAULT_UNIT_SYSTEM: UnitSystem = "metric";

// The exact International Yard and Pound Agreement conversion.
export const KM_PER_MILE = 1.609344;

export function kmToMiles(km: number): number {
  return km / KM_PER_MILE;
}

export function milesToKm(miles: number): number {
  return miles * KM_PER_MILE;
}

// A distance in km, converted to the given unit system for display.
export function distanceToUnit(km: number, unit: UnitSystem): number {
  return unit === "metric" ? km : kmToMiles(km);
}

// A distance in the given unit system, converted back to km for calculation.
export function distanceFromUnit(value: number, unit: UnitSystem): number {
  return unit === "metric" ? value : milesToKm(value);
}

// A pace's time component scales the same way regardless of whether it is
// expressed per km or per mile: minutes per mile = minutes per km * km per
// mile, since covering a (longer) mile at the same speed takes proportionally
// more time than covering a km.
export function paceMinPerKmToMinPerMile(paceMinPerKm: number): number {
  return paceMinPerKm * KM_PER_MILE;
}

export function paceMinPerMileToMinPerKm(paceMinPerMile: number): number {
  return paceMinPerMile / KM_PER_MILE;
}

// A pace in minutes per km, converted to the given unit system for display.
export function paceToUnit(paceMinPerKm: number, unit: UnitSystem): number {
  return unit === "metric" ? paceMinPerKm : paceMinPerKmToMinPerMile(paceMinPerKm);
}

// A pace in the given unit system, converted back to minutes per km.
export function paceFromUnit(paceValue: number, unit: UnitSystem): number {
  return unit === "metric" ? paceValue : paceMinPerMileToMinPerKm(paceValue);
}

export function distanceUnitLabel(unit: UnitSystem): string {
  return unit === "metric" ? "km" : "mi";
}

export function paceUnitLabel(unit: UnitSystem): string {
  return unit === "metric" ? "min/km" : "min/mi";
}

// Split a decimal minutes value (e.g. a pace) into whole minutes and rounded
// seconds components, the inverse of plan.ts's paceToMinutesPerKm. Carries a
// seconds value that rounds up to 60 into the next whole minute.
export function minutesToWholeAndSeconds(totalMinutes: number): {
  minutes: number;
  seconds: number;
} {
  const safeTotal = Math.max(0, totalMinutes);
  const minutes = Math.floor(safeTotal);
  const seconds = Math.round((safeTotal - minutes) * 60);

  if (seconds === 60) {
    return { minutes: minutes + 1, seconds: 0 };
  }

  return { minutes, seconds };
}

// Format a converted distance value for display: up to two decimal places,
// without padding whole numbers with trailing zeros.
export function formatDistanceValue(value: number): string {
  return Number(value.toFixed(2)).toString();
}
