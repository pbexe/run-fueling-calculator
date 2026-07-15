// Pure, framework-free Homemade Sports Drink logic for a Run.
//
// The Homemade Sports Drink is the only Fuel Source that also counts toward the
// Fluid Target: mixed isotonic at ~6 g carbohydrate per 100 ml, it covers the
// whole Fluid Target and supplies carbs, sodium and fluid together. Its carbs
// are allocated against the Carb Target before any solids (see ADR-0002:
// drink-first isotonic allocation); the composing planner handles that split.
//
// This module has no React or Next.js dependencies so the concentration and
// recipe-scaling rules can be unit tested in isolation. Terms follow
// CONTEXT.md: the drink is a DIY mix of table sugar, sea salt and flavouring,
// and the site emits its recipe scaled to the plan's total volume.

// The drink is mixed isotonic at ~6 g carbohydrate per 100 ml. This is a
// physiological constraint, not a tuning knob: above roughly 8% gastric
// emptying slows and the drink net-dehydrates the runner (ADR-0002), so the
// strength is fixed and not something the runner chooses.
export const DRINK_CARBS_PER_100_ML = 6;

// Sodium the drink carries, in milligrams per litre. A running drink wants
// roughly 500 to 700 mg/l; we mix at the middle of that band.
export const DRINK_SODIUM_MG_PER_LITRE = 600;

// Sodium is about 39.3% of table or sea salt (sodium chloride) by mass, so a
// sodium target converts to a salt weight through this fraction.
export const SALT_SODIUM_FRACTION = 0.393;

// Table sugar (sucrose) is essentially all carbohydrate, so the grams of sugar
// to add equal the grams of carbohydrate the drink delivers.
export const SUGAR_CARBS_FRACTION = 1;

// Household spoon conversions, in grams per level teaspoon, so the recipe can
// offer a spoon measure alongside the weighed amount. One tablespoon is three
// teaspoons.
export const SUGAR_GRAMS_PER_TEASPOON = 4.2;
export const SALT_GRAMS_PER_TEASPOON = 6;
export const TEASPOONS_PER_TABLESPOON = 3;

// A household spoon measure for a weighed ingredient: an amount in either
// teaspoons or tablespoons, rounded to the nearest quarter spoon, plus a label
// for display.
export interface SpoonMeasure {
  readonly unit: "tsp" | "tbsp";
  readonly amount: number;
  readonly label: string;
}

// One weighed ingredient in the scaled recipe: grams to weigh out plus the
// equivalent household spoon measure.
export interface RecipeIngredient {
  readonly grams: number;
  readonly spoon: SpoonMeasure;
}

// The Homemade Sports Drink recipe scaled to a plan's total volume: how much
// sugar and salt to add, plus the carbs and sodium that delivers. Flavouring is
// an optional note, not a weighed amount.
export interface DrinkRecipe {
  // The total volume the recipe makes, in millilitres: the whole Fluid Target
  // across the Run.
  readonly totalVolumeMl: number;
  // Carbohydrate the drink delivers across that volume, in grams.
  readonly carbsGrams: number;
  // Sodium the drink delivers across that volume, in milligrams.
  readonly sodiumMg: number;
  // Table sugar to add.
  readonly sugar: RecipeIngredient;
  // Sea salt to add.
  readonly salt: RecipeIngredient;
  // Optional flavouring guidance; carries no carbs or sodium in the plan.
  readonly flavouringNote: string;
}

function roundToQuarter(value: number): number {
  return Math.round(value * 4) / 4;
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

// Express a weighed amount as a household spoon measure. Amounts under three
// teaspoons stay in teaspoons; larger amounts switch to tablespoons so the
// number stays small and pourable. Both are rounded to the nearest quarter
// spoon. String(amount) drops a trailing ".0", so 2 shows as "2" and 4.75 as
// "4.75".
export function spoonMeasure(
  grams: number,
  gramsPerTeaspoon: number,
): SpoonMeasure {
  const rawTeaspoons = grams / gramsPerTeaspoon;

  if (rawTeaspoons < TEASPOONS_PER_TABLESPOON) {
    const amount = roundToQuarter(rawTeaspoons);
    return { unit: "tsp", amount, label: `about ${amount} tsp` };
  }

  const amount = roundToQuarter(rawTeaspoons / TEASPOONS_PER_TABLESPOON);
  return { unit: "tbsp", amount, label: `about ${amount} tbsp` };
}

// The carbohydrate the drink delivers across a volume, in grams: the ~6% mix
// held over the whole volume.
export function drinkCarbsGrams(totalVolumeMl: number): number {
  return (Math.max(0, totalVolumeMl) * DRINK_CARBS_PER_100_ML) / 100;
}

// The sodium the drink delivers across a volume, in milligrams.
export function drinkSodiumMg(totalVolumeMl: number): number {
  return (Math.max(0, totalVolumeMl) * DRINK_SODIUM_MG_PER_LITRE) / 1000;
}

// Build the Homemade Sports Drink recipe scaled to a plan's total volume.
//
// Sugar is weighed to hit ~6 g carbohydrate per 100 ml (sugar being all carb),
// and salt to hit ~600 mg sodium per litre. Each ingredient is given both in
// grams and as a household spoon measure.
export function drinkRecipe(totalVolumeMl: number): DrinkRecipe {
  const volume = Math.max(0, totalVolumeMl);
  const carbsGrams = drinkCarbsGrams(volume);
  const sodiumMg = drinkSodiumMg(volume);

  const sugarGrams = carbsGrams / SUGAR_CARBS_FRACTION;
  const saltGrams = sodiumMg / 1000 / SALT_SODIUM_FRACTION;

  return {
    totalVolumeMl: volume,
    carbsGrams: roundToTenth(carbsGrams),
    sodiumMg: Math.round(sodiumMg),
    sugar: {
      grams: roundToTenth(sugarGrams),
      spoon: spoonMeasure(sugarGrams, SUGAR_GRAMS_PER_TEASPOON),
    },
    salt: {
      grams: roundToTenth(saltGrams),
      spoon: spoonMeasure(saltGrams, SALT_GRAMS_PER_TEASPOON),
    },
    flavouringNote:
      "Add sugar-free squash or a squeeze of citrus to taste (optional).",
  };
}
