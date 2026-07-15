"use client";

import { useMemo, useState } from "react";

import {
  carbTargetForRunDuration,
  DISTANCE_PRESETS,
  formatRunDuration,
  paceToMinutesPerKm,
  runDurationMinutes,
} from "../planner/plan";
import { FUEL_SOURCES } from "../planner/fuel";
import { planFueling } from "../planner/fueling";
import {
  CONDITIONS,
  DEFAULT_CONDITIONS_ID,
  DEFAULT_SWEAT_RATE_PRESET_ID,
  planHydration,
  SWEAT_RATE_PRESETS,
} from "../planner/hydration";
import type { ConditionsId, SweatRatePresetId } from "../planner/hydration";

const CUSTOM_DISTANCE_ID = "custom";
const HOMEMADE_DRINK_LABEL = "Homemade Sports Drink";

export default function PlannerForm() {
  const [distanceId, setDistanceId] = useState<string>(DISTANCE_PRESETS[0].id);
  const [customKm, setCustomKm] = useState<string>("");
  const [paceMinutes, setPaceMinutes] = useState<string>("6");
  const [paceSeconds, setPaceSeconds] = useState<string>("0");
  const [gelsSelected, setGelsSelected] = useState<boolean>(true);
  const [drinkSelected, setDrinkSelected] = useState<boolean>(false);
  const [sweatRatePresetId, setSweatRatePresetId] =
    useState<SweatRatePresetId>(DEFAULT_SWEAT_RATE_PRESET_ID);
  const [sweatRateOverride, setSweatRateOverride] = useState<string>("");
  const [conditionsId, setConditionsId] = useState<ConditionsId>(
    DEFAULT_CONDITIONS_ID,
  );

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

  const overrideMlPerHour = useMemo(() => {
    const parsed = Number.parseFloat(sweatRateOverride);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [sweatRateOverride]);

  const hydrationPlan = useMemo(() => {
    if (durationMinutes === null) {
      return null;
    }
    return planHydration(
      { presetId: sweatRatePresetId, overrideMlPerHour },
      conditionsId,
      durationMinutes,
    );
  }, [durationMinutes, sweatRatePresetId, overrideMlPerHour, conditionsId]);

  const fuelingPlan = useMemo(() => {
    if (durationMinutes === null || carbTarget === null) {
      return null;
    }
    return planFueling(
      carbTarget,
      durationMinutes,
      { gels: gelsSelected, drink: drinkSelected },
      {
        totalFluidMl: hydrationPlan?.totalFluidMl ?? 0,
        timeline: hydrationPlan?.timeline ?? [],
      },
    );
  }, [carbTarget, durationMinutes, gelsSelected, drinkSelected, hydrationPlan]);

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
            <span className="label-text mb-2 font-medium">Fuel Sources</span>
            <div className="flex flex-wrap gap-2">
              {FUEL_SOURCES.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  className={`btn btn-sm ${
                    gelsSelected ? "btn-primary" : "btn-outline"
                  }`}
                  aria-pressed={gelsSelected}
                  onClick={() => setGelsSelected((on) => !on)}
                >
                  {source.label}
                </button>
              ))}
              <button
                type="button"
                className={`btn btn-sm ${
                  drinkSelected ? "btn-primary" : "btn-outline"
                }`}
                aria-pressed={drinkSelected}
                onClick={() => setDrinkSelected((on) => !on)}
              >
                {HOMEMADE_DRINK_LABEL}
              </button>
            </div>
            <span className="label-text-alt mt-2 text-base-content/60">
              Combine several. The Homemade Sports Drink covers the whole Fluid
              Target and its carbs count first; gels fill the rest.
            </span>
          </div>

          <div className="form-control">
            <span className="label-text mb-2 font-medium">Sweat Rate</span>
            <div className="flex flex-wrap gap-2">
              {SWEAT_RATE_PRESETS.map((sweatPreset) => (
                <button
                  key={sweatPreset.id}
                  type="button"
                  className={`btn btn-sm ${
                    sweatRatePresetId === sweatPreset.id
                      ? "btn-primary"
                      : "btn-outline"
                  } ${overrideMlPerHour !== null ? "btn-disabled" : ""}`}
                  aria-pressed={sweatRatePresetId === sweatPreset.id}
                  disabled={overrideMlPerHour !== null}
                  onClick={() => setSweatRatePresetId(sweatPreset.id)}
                >
                  {sweatPreset.label}
                </button>
              ))}
            </div>
            <label className="form-control mt-3">
              <span className="label-text mb-2 text-base-content/70">
                Measured Sweat Rate (optional)
              </span>
              <div className="join">
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="10"
                  className="input input-bordered join-item w-full"
                  placeholder="e.g. 800"
                  value={sweatRateOverride}
                  onChange={(event) =>
                    setSweatRateOverride(event.target.value)
                  }
                  aria-label="Measured Sweat Rate in millilitres per hour"
                />
                <span className="btn btn-disabled join-item no-animation">
                  ml/h
                </span>
              </div>
              <span className="label-text-alt mt-2 text-base-content/60">
                From a sweat test. Overrides the preset and ignores Conditions.
              </span>
            </label>
          </div>

          <div className="form-control">
            <span className="label-text mb-2 font-medium">Conditions</span>
            <div className="flex flex-wrap gap-2">
              {CONDITIONS.map((condition) => (
                <button
                  key={condition.id}
                  type="button"
                  className={`btn btn-sm ${
                    conditionsId === condition.id
                      ? "btn-primary"
                      : "btn-outline"
                  } ${overrideMlPerHour !== null ? "btn-disabled" : ""}`}
                  aria-pressed={conditionsId === condition.id}
                  disabled={overrideMlPerHour !== null}
                  onClick={() => setConditionsId(condition.id)}
                >
                  {condition.label}
                </button>
              ))}
            </div>
            <span className="label-text-alt mt-2 text-base-content/60">
              {overrideMlPerHour !== null
                ? "Ignored while a measured Sweat Rate is set."
                : "Nudges the Fluid Target up in the heat, down in the cool."}
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

              {fuelingPlan !== null &&
                (carbTarget.fuelNeeded || fuelingPlan.drinkSelected) &&
                (fuelingPlan.gelCount > 0 || fuelingPlan.drinkSelected) && (
                  <div className="flex flex-col gap-4">
                    <div className="rounded-box bg-base-200 p-4">
                      <div className="text-sm font-semibold uppercase tracking-wide text-base-content/70">
                        Shopping summary
                      </div>

                      {fuelingPlan.gelCount > 0 && (
                        <>
                          <div className="mt-1 text-2xl font-bold text-primary">
                            {fuelingPlan.gelCount}{" "}
                            {fuelingPlan.gelCount === 1 ? "gel" : "gels"}
                          </div>
                          <div className="text-sm text-base-content/70">
                            About {fuelingPlan.carbsPerGelGrams} g carbs each,{" "}
                            {fuelingPlan.gelCarbsGrams} g from gels.
                          </div>
                        </>
                      )}

                      {fuelingPlan.recipe !== null && (
                        <div className={fuelingPlan.gelCount > 0 ? "mt-3" : ""}>
                          <div className="text-lg font-bold text-primary">
                            {HOMEMADE_DRINK_LABEL}
                          </div>
                          <div className="text-sm text-base-content/70">
                            Makes {fuelingPlan.recipe.totalVolumeMl} ml at ~6%
                            carbs ({fuelingPlan.recipe.carbsGrams} g carbs,{" "}
                            {fuelingPlan.recipe.sodiumMg} mg sodium).
                          </div>
                          <ul className="mt-2 flex flex-col gap-1 text-sm">
                            <li className="flex items-center justify-between">
                              <span>Table sugar</span>
                              <span className="text-base-content/80">
                                {fuelingPlan.recipe.sugar.grams} g (
                                {fuelingPlan.recipe.sugar.spoon.label})
                              </span>
                            </li>
                            <li className="flex items-center justify-between">
                              <span>Sea salt</span>
                              <span className="text-base-content/80">
                                {fuelingPlan.recipe.salt.grams} g (
                                {fuelingPlan.recipe.salt.spoon.label})
                              </span>
                            </li>
                          </ul>
                          <div className="mt-2 text-sm text-base-content/60">
                            {fuelingPlan.recipe.flavouringNote}
                          </div>
                        </div>
                      )}

                      {carbTarget.fuelNeeded && (
                        <div className="mt-3 text-sm text-base-content/70">
                          {fuelingPlan.totalCarbsGrams} g carbs total against a{" "}
                          {Math.round(fuelingPlan.carbTargetTotalGrams)} g Carb
                          Target.
                          {fuelingPlan.drinkMeetsCarbTarget
                            ? " The drink alone meets the Carb Target, so no gels are needed."
                            : ""}
                        </div>
                      )}
                    </div>

                    {fuelingPlan.timeline.length > 0 && (
                      <div>
                        <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-base-content/70">
                          Timeline
                        </div>
                        <ul className="menu bg-base-200 rounded-box w-full gap-1 p-2">
                          {fuelingPlan.timeline.map((entry) => (
                            <li key={entry.index}>
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-semibold">
                                  {entry.offsetLabel}
                                </span>
                                <span className="text-base-content/80">
                                  {entry.label}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

              {hydrationPlan !== null && (
                <div className="stat px-0">
                  <div className="stat-title">Fluid Target</div>
                  <div className="stat-value text-primary">
                    {hydrationPlan.fluidTargetMlPerHour} ml/h
                  </div>
                  <div className="stat-desc">
                    {drinkSelected
                      ? "Homemade Sports Drink to drink per hour on the Run"
                      : "water to drink per hour on the Run"}
                    {hydrationPlan.usedOverride
                      ? "; from your measured Sweat Rate, so Conditions are ignored"
                      : ""}
                  </div>
                </div>
              )}

              {hydrationPlan !== null && (
                <div className="flex flex-col gap-4">
                  <div className="rounded-box bg-base-200 p-4">
                    <div className="text-sm font-semibold uppercase tracking-wide text-base-content/70">
                      Fluid summary
                    </div>
                    <div className="mt-1 text-2xl font-bold text-primary">
                      {hydrationPlan.totalFluidMl} ml{" "}
                      {drinkSelected ? "Homemade Sports Drink" : "water"}
                    </div>
                    <div className="text-sm text-base-content/70">
                      Total to carry across the Run at{" "}
                      {hydrationPlan.fluidTargetMlPerHour} ml/h.
                      {drinkSelected
                        ? " Mixed to the recipe above; the sips are in the Timeline."
                        : ""}
                    </div>
                  </div>

                  {!drinkSelected && hydrationPlan.timeline.length > 0 && (
                    <div>
                      <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-base-content/70">
                        Drink reminders
                      </div>
                      <ul className="menu bg-base-200 rounded-box w-full gap-1 p-2">
                        {hydrationPlan.timeline.map((reminder) => (
                          <li key={reminder.index}>
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-semibold">
                                {reminder.offsetLabel}
                              </span>
                              <span className="text-base-content/80">
                                Drink ~{reminder.volumeMl} ml water
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
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
