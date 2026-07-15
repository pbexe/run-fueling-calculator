"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  carbTargetForRunDuration,
  DISTANCE_PRESETS,
  formatRunDuration,
  paceToMinutesPerKm,
  runDurationMinutes,
} from "../planner/plan";
import { FUEL_SOURCES } from "../planner/fuel";
import type { FuelSourceId } from "../planner/fuel";
import { planFueling } from "../planner/fueling";
import {
  CAFFEINE_SLOT_MESSAGE,
  CAFFEINE_TOO_SHORT_MESSAGE,
  planCaffeine,
} from "../planner/caffeine";
import {
  CONDITIONS,
  planHydration,
  SWEAT_RATE_PRESETS,
} from "../planner/hydration";
import {
  CUSTOM_DISTANCE_ID,
  decodePlannerState,
  encodePlannerState,
  type PlannerState,
} from "../planner/urlState";

const HOMEMADE_DRINK_LABEL = "Homemade Sports Drink";

// How long to let field edits settle before pushing a new browser history
// entry, so a burst of keystrokes collapses into one entry rather than one
// per keystroke.
const URL_SYNC_DEBOUNCE_MS = 400;

// How long the copy-link button shows its confirmation (or error) feedback.
const COPY_FEEDBACK_DURATION_MS = 2000;

type CopyStatus = "idle" | "copied" | "error";

function PlannerFormInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Seed state from the URL's query params exactly once, on first render.
  const initialStateRef = useRef<PlannerState | null>(null);
  if (initialStateRef.current === null) {
    initialStateRef.current = decodePlannerState(searchParams);
  }
  const initialState = initialStateRef.current;

  const [distanceId, setDistanceId] = useState<string>(
    initialState.distanceId,
  );
  const [customKm, setCustomKm] = useState<string>(initialState.customKm);
  const [paceMinutes, setPaceMinutes] = useState<string>(
    initialState.paceMinutes,
  );
  const [paceSeconds, setPaceSeconds] = useState<string>(
    initialState.paceSeconds,
  );
  const [selectedSolidIds, setSelectedSolidIds] = useState<
    readonly FuelSourceId[]
  >(initialState.selectedSolidIds);
  const [drinkSelected, setDrinkSelected] = useState<boolean>(
    initialState.drinkSelected,
  );
  const [caffeineEnabled, setCaffeineEnabled] = useState<boolean>(
    initialState.caffeineEnabled,
  );

  const toggleSolid = (id: FuelSourceId) => {
    setSelectedSolidIds((current) =>
      current.includes(id)
        ? current.filter((selected) => selected !== id)
        : [...current, id],
    );
  };
  const [sweatRatePresetId, setSweatRatePresetId] = useState(
    initialState.sweatRatePresetId,
  );
  const [sweatRateOverride, setSweatRateOverride] = useState<string>(
    initialState.sweatRateOverride,
  );
  const [conditionsId, setConditionsId] = useState(initialState.conditionsId);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");

  const plannerState: PlannerState = useMemo(
    () => ({
      distanceId,
      customKm,
      paceMinutes,
      paceSeconds,
      selectedSolidIds,
      drinkSelected,
      sweatRatePresetId,
      sweatRateOverride,
      conditionsId,
      caffeineEnabled,
    }),
    [
      distanceId,
      customKm,
      paceMinutes,
      paceSeconds,
      selectedSolidIds,
      drinkSelected,
      sweatRatePresetId,
      sweatRateOverride,
      conditionsId,
      caffeineEnabled,
    ],
  );

  const encodedQuery = useMemo(
    () => encodePlannerState(plannerState).toString(),
    [plannerState],
  );

  // Tracks the query string this component last synced with (either one it
  // pushed itself, or one it just adopted from the URL), so it can tell its
  // own updates apart from external navigation (back/forward, a pasted link).
  const lastSyncedSearchRef = useRef(searchParams.toString());
  const didMountRef = useRef(false);

  // Adopt state from the URL when it changes from outside this component,
  // e.g. browser back/forward or a fresh navigation to a shared link.
  useEffect(() => {
    const currentSearch = searchParams.toString();
    if (currentSearch === lastSyncedSearchRef.current) {
      return;
    }
    lastSyncedSearchRef.current = currentSearch;

    const next = decodePlannerState(searchParams);
    setDistanceId(next.distanceId);
    setCustomKm(next.customKm);
    setPaceMinutes(next.paceMinutes);
    setPaceSeconds(next.paceSeconds);
    setSelectedSolidIds(next.selectedSolidIds);
    setDrinkSelected(next.drinkSelected);
    setSweatRatePresetId(next.sweatRatePresetId);
    setSweatRateOverride(next.sweatRateOverride);
    setConditionsId(next.conditionsId);
    setCaffeineEnabled(next.caffeineEnabled);
  }, [searchParams]);

  // Push local state changes to the URL (debounced) so the plan can be shared,
  // bookmarked, and navigated with browser back/forward. Skipped on mount so
  // loading a partial or malformed link doesn't immediately rewrite the URL.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (encodedQuery === searchParams.toString()) {
      return;
    }

    const timeout = window.setTimeout(() => {
      lastSyncedSearchRef.current = encodedQuery;
      router.push(`${pathname}?${encodedQuery}`, { scroll: false });
    }, URL_SYNC_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [encodedQuery, pathname, router, searchParams]);

  const handleCopyLink = async () => {
    const query = encodePlannerState(plannerState).toString();
    const shareUrl = `${window.location.origin}${window.location.pathname}?${query}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }

    window.setTimeout(() => setCopyStatus("idle"), COPY_FEEDBACK_DURATION_MS);
  };

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
      { solids: selectedSolidIds, drink: drinkSelected },
      {
        totalFluidMl: hydrationPlan?.totalFluidMl ?? 0,
        timeline: hydrationPlan?.timeline ?? [],
      },
    );
  }, [
    carbTarget,
    durationMinutes,
    selectedSolidIds,
    drinkSelected,
    hydrationPlan,
  ]);

  const caffeinePlan = useMemo(() => {
    if (durationMinutes === null || fuelingPlan === null) {
      return null;
    }
    return planCaffeine(fuelingPlan.timeline, durationMinutes);
  }, [durationMinutes, fuelingPlan]);

  return (
    <div className="grid w-full gap-6 md:grid-cols-2">
      <section className="card bg-base-100 shadow-xl">
        <div className="card-body gap-6 text-left">
          <div className="flex items-center justify-between gap-4">
            <h2 className="card-title">Your Run</h2>
            <div className="flex items-center gap-2">
              {copyStatus !== "idle" && (
                <span
                  role="status"
                  className={`text-sm ${
                    copyStatus === "copied"
                      ? "text-success"
                      : "text-error"
                  }`}
                >
                  {copyStatus === "copied" ? "Link copied!" : "Copy failed"}
                </span>
              )}
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => {
                  void handleCopyLink();
                }}
              >
                Copy link
              </button>
            </div>
          </div>

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
              {FUEL_SOURCES.map((source) => {
                const isSelected = selectedSolidIds.includes(source.id);
                return (
                  <button
                    key={source.id}
                    type="button"
                    className={`btn btn-sm ${
                      isSelected ? "btn-primary" : "btn-outline"
                    }`}
                    aria-pressed={isSelected}
                    onClick={() => toggleSolid(source.id)}
                  >
                    {source.label}
                  </button>
                );
              })}
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
              Target and its carbs count first; selected solids fill the rest.
            </span>
          </div>

          <div className="form-control">
            <span className="label-text mb-2 font-medium">Caffeine</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`btn btn-sm ${
                  caffeineEnabled ? "btn-primary" : "btn-outline"
                }`}
                aria-pressed={caffeineEnabled}
                onClick={() => setCaffeineEnabled((on) => !on)}
              >
                Suggest caffeine
              </button>
            </div>
            <span className="label-text-alt mt-2 text-base-content/60">
              {caffeineEnabled && caffeinePlan !== null && !caffeinePlan.eligible
                ? CAFFEINE_TOO_SHORT_MESSAGE
                : "Advisory only: marks a few gels in the final third of the Run as caffeinated. Gel counts and totals stay the same."}
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
                (fuelingPlan.solidAllocations.some(
                  (allocation) => allocation.count > 0,
                ) ||
                  fuelingPlan.drinkSelected) && (
                  <div className="flex flex-col gap-4">
                    <div className="rounded-box bg-base-200 p-4">
                      <div className="text-sm font-semibold uppercase tracking-wide text-base-content/70">
                        Shopping summary
                      </div>

                      {fuelingPlan.solidAllocations
                        .filter((allocation) => allocation.count > 0)
                        .map((allocation) => (
                          <div key={allocation.source.id} className="mt-3 first:mt-1">
                            <div className="text-2xl font-bold text-primary">
                              {allocation.count}{" "}
                              {allocation.count === 1
                                ? allocation.source.servingNoun
                                : allocation.source.servingNounPlural}
                            </div>
                            <div className="text-sm text-base-content/70">
                              About {allocation.source.carbsPerServingGrams} g
                              carbs each, {allocation.totalCarbsGrams} g from{" "}
                              {allocation.source.servingNounPlural}.
                              {allocation.source.piecesPerServing !==
                              undefined
                                ? ` Each ${allocation.source.servingNoun} is ${allocation.source.piecesPerServing} ${allocation.source.pieceNoun}s.`
                                : ""}
                            </div>
                          </div>
                        ))}

                      {fuelingPlan.recipe !== null && (
                        <div
                          className={
                            fuelingPlan.solidAllocations.some(
                              (allocation) => allocation.count > 0,
                            )
                              ? "mt-3"
                              : ""
                          }
                        >
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
                            ? " The drink alone meets the Carb Target, so no solids are needed."
                            : ""}
                        </div>
                      )}
                    </div>

                    {fuelingPlan.warnings.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {fuelingPlan.warnings.map((warning, index) => (
                          <div
                            key={index}
                            role="alert"
                            className="alert alert-warning text-sm"
                          >
                            <span>{warning.message}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {fuelingPlan.timeline.length > 0 && (
                      <div>
                        <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-base-content/70">
                          Timeline
                        </div>
                        <ul className="menu bg-base-200 rounded-box w-full gap-1 p-2">
                          {fuelingPlan.timeline.map((entry) => {
                            const caffeinated =
                              caffeineEnabled &&
                              caffeinePlan !== null &&
                              caffeinePlan.eligible &&
                              caffeinePlan.annotatedEntryIndexes.has(
                                entry.index,
                              );
                            return (
                              <li key={entry.index}>
                                <div className="flex flex-col">
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono font-semibold">
                                      {entry.offsetLabel}
                                    </span>
                                    <span className="text-base-content/80">
                                      {entry.label}
                                    </span>
                                  </div>
                                  {caffeinated && (
                                    <span className="text-sm text-secondary">
                                      {CAFFEINE_SLOT_MESSAGE}
                                    </span>
                                  )}
                                </div>
                              </li>
                            );
                          })}
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

export default function PlannerForm() {
  return (
    <Suspense fallback={null}>
      <PlannerFormInner />
    </Suspense>
  );
}
