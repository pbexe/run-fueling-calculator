import { describe, expect, it } from "vitest";

import {
  DEFAULT_UNIT_SYSTEM,
  distanceFromUnit,
  distanceToUnit,
  distanceUnitLabel,
  formatDistanceValue,
  KM_PER_MILE,
  kmToMiles,
  milesToKm,
  minutesToWholeAndSeconds,
  paceFromUnit,
  paceMinPerKmToMinPerMile,
  paceMinPerMileToMinPerKm,
  paceToUnit,
  paceUnitLabel,
} from "./units";

describe("kmToMiles / milesToKm round-trip", () => {
  it("converts a marathon to miles and back", () => {
    const km = 42.195;
    const miles = kmToMiles(km);
    expect(miles).toBeCloseTo(26.2188, 3);
    expect(milesToKm(miles)).toBeCloseTo(km, 10);
  });

  it("uses the exact International Yard and Pound conversion", () => {
    expect(kmToMiles(KM_PER_MILE)).toBeCloseTo(1, 10);
    expect(milesToKm(1)).toBe(KM_PER_MILE);
  });
});

describe("distanceToUnit / distanceFromUnit round-trip", () => {
  it("is the identity for metric", () => {
    expect(distanceToUnit(10, "metric")).toBe(10);
    expect(distanceFromUnit(10, "metric")).toBe(10);
  });

  it("round-trips a distance through imperial", () => {
    const km = 21.0975;
    const displayed = distanceToUnit(km, "imperial");
    expect(distanceFromUnit(displayed, "imperial")).toBeCloseTo(km, 10);
  });
});

describe("pace conversion round-trip", () => {
  it("is the identity for metric", () => {
    expect(paceToUnit(6, "metric")).toBe(6);
    expect(paceFromUnit(6, "metric")).toBe(6);
  });

  it("converts a 6:00 min/km pace to min/mi and back", () => {
    const paceMinPerKm = 6;
    const paceMinPerMile = paceToUnit(paceMinPerKm, "imperial");
    expect(paceMinPerMile).toBeCloseTo(9.656, 3);
    expect(paceFromUnit(paceMinPerMile, "imperial")).toBeCloseTo(
      paceMinPerKm,
      10,
    );
  });

  it("agrees with the dedicated min/km <-> min/mi helpers", () => {
    expect(paceMinPerKmToMinPerMile(5)).toBeCloseTo(8.0467, 3);
    expect(paceMinPerMileToMinPerKm(paceMinPerKmToMinPerMile(5))).toBeCloseTo(
      5,
      10,
    );
  });
});

describe("minutesToWholeAndSeconds", () => {
  it("splits a whole number of minutes", () => {
    expect(minutesToWholeAndSeconds(6)).toEqual({ minutes: 6, seconds: 0 });
  });

  it("splits minutes with a fractional remainder into seconds", () => {
    expect(minutesToWholeAndSeconds(5.5)).toEqual({ minutes: 5, seconds: 30 });
  });

  it("rounds a seconds remainder that rounds up to 60 into the next minute", () => {
    expect(minutesToWholeAndSeconds(5.9992)).toEqual({
      minutes: 6,
      seconds: 0,
    });
  });

  it("clamps negative input to zero", () => {
    expect(minutesToWholeAndSeconds(-5)).toEqual({ minutes: 0, seconds: 0 });
  });
});

describe("formatDistanceValue", () => {
  it("trims trailing zeros from whole numbers", () => {
    expect(formatDistanceValue(5)).toBe("5");
    expect(formatDistanceValue(10)).toBe("10");
  });

  it("rounds to at most two decimal places", () => {
    expect(formatDistanceValue(3.10685596)).toBe("3.11");
    expect(formatDistanceValue(13.109444)).toBe("13.11");
  });
});

describe("unit labels", () => {
  it("labels metric distance and pace", () => {
    expect(distanceUnitLabel("metric")).toBe("km");
    expect(paceUnitLabel("metric")).toBe("min/km");
  });

  it("labels imperial distance and pace", () => {
    expect(distanceUnitLabel("imperial")).toBe("mi");
    expect(paceUnitLabel("imperial")).toBe("min/mi");
  });
});

describe("DEFAULT_UNIT_SYSTEM", () => {
  it("defaults to metric", () => {
    expect(DEFAULT_UNIT_SYSTEM).toBe("metric");
  });
});
