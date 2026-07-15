"use client";

import { useMemo, useState } from "react";

import {
  carbTargetForRunDuration,
  DISTANCE_PRESETS,
  formatRunDuration,
  paceToMinutesPerKm,
  runDurationMinutes,
} from "../planner/plan";
import { FUEL_SOURCES, GELS, planGels } from "../planner/fuel";
import type { FuelSourceId } from "../planner/fuel";

const CUSTOM_DISTANCE_ID = "custom";

export default function PlannerForm() {
  const [distanceId, setDistanceId] = useState<string>(DISTANCE_PRESETS[0].id);
  const [customKm, setCustomKm] = useState<string>("");
  const [paceMinutes, setPaceMinutes] = useState<string>("6");
  const [paceSeconds, setPaceSeconds] = useState<string>("0");
  const [fuelSourceId, setFuelSourceId] = useState<FuelSourceId>(GELS.id);

  const distanceKm = useMemo(() => {
    if (distanceId === CUSTOM_DISTANCE_ID) {
      const parsed = Number.parseFloat(customKm);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    const preset = DISTANCE_PRESETS.find((option) => option.id === distanceId);
    return preset ? preset.km : null;
  }, [distanceId, customKm]);

  const paceMinutesPerKm = useMemo(() => {
    const minutes = Number.parseInt(paceMinutes, 10);
    const seconds = Number.parseInt(paceSeconds, 10);
    const safeMinutes = Number.isFinite(minutes) ? minutes : 0;
    const safeSeconds = Number.isFinite(seconds) ? seconds : 0;
    const pace = paceToMinutesPerKm(safeMinutes, safeSeconds);
    return pace > 0 ? pace : null;
  }, [paceMinutes, paceSeconds]);

  const durationMinutes = useMemo(() => {
    if (distanceKm === null || paceMinutesPerKm === null) {
      return null;
    }
    return runDurationMinutes(distanceKm, paceMinutesPerKm);
  }, [distanceKm, paceMinutesPerKm]);

  const carbTarget = useMemo(
    () =>
      durationMinutes === null
        ? null
        : carbTargetForRunDuration(durationMinutes),
    [durationMinutes],
  );

  const gelPlan = useMemo(() => {
    if (durationMinutes === null || carbTarget === null) {
      return null;
    }
    if (fuelSourceId !== GELS.id) {
      return null;
    }
    return planGels(carbTarget, durationMinutes);
  }, [carbTarget, durationMinutes, fuelSourceId]);

  return (
    <div className="grid w-full gap-6 md:grid-cols-2">
      <section className="card bg-base-100 shadow-xl">
        <div className="card-body gap-6 text-left">
          <h2 className="card-title">Your Run</h2>

          <div className="form-control">
            <span className="label-text mb-2 font-medium">Distance</span>
            <div className="flex flex-wrap gap-2">
              {DISTANCE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`btn btn-sm ${
                    distanceId === preset.id ? "btn-primary" : "btn-outline"
                  }`}
                  aria-pressed={distanceId === preset.id}
                  onClick={() => setDistanceId(preset.id)}
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                className={`btn btn-sm ${
                  distanceId === CUSTOM_DISTANCE_ID
                    ? "btn-primary"
                    : "btn-outline"
                }`}
                aria-pressed={distanceId === CUSTOM_DISTANCE_ID}
                onClick={() => setDistanceId(CUSTOM_DISTANCE_ID)}
              >
                Custom
              </button>
            </div>
          </div>

          {distanceId === CUSTOM_DISTANCE_ID && (
            <label className="form-control">
              <span className="label-text mb-2 font-medium">
                Custom distance
              </span>
              <div className="join">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  className="input input-bordered join-item w-full"
                  placeholder="e.g. 15"
                  value={customKm}
                  onChange={(event) => setCustomKm(event.target.value)}
                  aria-label="Custom distance in kilometres"
                />
                <span className="btn btn-disabled join-item no-animation">
                  km
                </span>
              </div>
            </label>
          )}

          <div className="form-control">
            <span className="label-text mb-2 font-medium">Pace (min/km)</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min="0"
                className="input input-bordered w-20"
                value={paceMinutes}
                onChange={(event) => setPaceMinutes(event.target.value)}
                aria-label="Pace minutes per kilometre"
              />
              <span className="text-xl font-bold">:</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                max="59"
                className="input input-bordered w-20"
                value={paceSeconds}
                onChange={(event) => setPaceSeconds(event.target.value)}
                aria-label="Pace seconds per kilometre"
              />
              <span className="text-base-content/70">min/km</span>
            </div>
          </div>

          <div className="form-control">
            <span className="label-text mb-2 font-medium">Fuel Source</span>
            <div className="flex flex-wrap gap-2">
              {FUEL_SOURCES.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  className={`btn btn-sm ${
                    fuelSourceId === source.id ? "btn-primary" : "btn-outline"
                  }`}
                  aria-pressed={fuelSourceId === source.id}
                  onClick={() => setFuelSourceId(source.id)}
                >
                  {source.label}
                </button>
              ))}
            </div>
            <span className="label-text-alt mt-2 text-base-content/60">
              More Fuel Sources coming soon.
            </span>
          </div>
        </div>
      </section>

      <section className="card bg-base-100 shadow-xl">
        <div className="card-body gap-6 text-left">
          <h2 className="card-title">Your plan</h2>

          {durationMinutes === null || carbTarget === null ? (
            <p className="text-base-content/70">
              Enter a distance and a pace to see your Run Duration and Carb
              Target.
            </p>
          ) : (
            <>
              <div className="stat px-0">
                <div className="stat-title">Run Duration</div>
                <div className="stat-value text-primary">
                  {formatRunDuration(durationMinutes)}
                </div>
              </div>

              <div className="stat px-0">
                <div className="stat-title">Carb Target</div>
                {carbTarget.fuelNeeded ? (
                  <>
                    <div className="stat-value text-primary">
                      {carbTarget.gramsPerHourLow} to{" "}
                      {carbTarget.gramsPerHourHigh} g/h
                    </div>
                    <div className="stat-desc">
                      grams of carbohydrate per hour on the Run
                    </div>
                  </>
                ) : (
                  <>
                    <div className="stat-value text-2xl">No fuel needed</div>
                    <div className="stat-desc">
                      This Run is under about 75 minutes, so it has no Carb
                      Target.
                    </div>
                  </>
                )}
              </div>

              {carbTarget.fuelNeeded && gelPlan !== null && (
                <div className="flex flex-col gap-4">
                  <div className="rounded-box bg-base-200 p-4">
                    <div className="text-sm font-semibold uppercase tracking-wide text-base-content/70">
                      Shopping summary
                    </div>
                    <div className="mt-1 text-2xl font-bold text-primary">
                      {gelPlan.gelCount}{" "}
                      {gelPlan.gelCount === 1 ? "gel" : "gels"}
                    </div>
                    <div className="text-sm text-base-content/70">
                      About {gelPlan.carbsPerGelGrams} g carbs each,{" "}
                      {gelPlan.totalCarbsGrams} g total across the Run.
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-base-content/70">
                      Timeline
                    </div>
                    <ul className="menu bg-base-200 rounded-box w-full gap-1 p-2">
                      {gelPlan.timeline.map((serving) => (
                        <li key={serving.index}>
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-semibold">
                              {serving.offsetLabel}
                            </span>
                            <span className="text-base-content/80">Gel</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}

          <div
            role="note"
            className="alert alert-warning mt-auto text-sm"
          >
            <span>
              Not medical advice. These are general guidelines only; adjust to
              your own tolerance and consult a professional for individual
              nutrition or health needs.
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
