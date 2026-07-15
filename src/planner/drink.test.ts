import { describe, expect, it } from "vitest";

import {
  DRINK_CARBS_PER_100_ML,
  DRINK_SODIUM_MG_PER_LITRE,
  drinkCarbsGrams,
  drinkRecipe,
  drinkSodiumMg,
  spoonMeasure,
  SUGAR_GRAMS_PER_TEASPOON,
  SALT_GRAMS_PER_TEASPOON,
} from "./drink";

describe("drink concentration", () => {
  it("mixes at roughly 6 g carbohydrate per 100 ml", () => {
    expect(DRINK_CARBS_PER_100_ML).toBe(6);
  });

  it("carries 500 to 700 mg sodium per litre", () => {
    expect(DRINK_SODIUM_MG_PER_LITRE).toBeGreaterThanOrEqual(500);
    expect(DRINK_SODIUM_MG_PER_LITRE).toBeLessThanOrEqual(700);
  });
});

describe("drinkCarbsGrams", () => {
  it("delivers 6 g of carbohydrate per 100 ml", () => {
    expect(drinkCarbsGrams(100)).toBe(6);
    expect(drinkCarbsGrams(1000)).toBe(60);
    expect(drinkCarbsGrams(750)).toBe(45);
  });

  it("never returns negative carbs for a non-positive volume", () => {
    expect(drinkCarbsGrams(0)).toBe(0);
    expect(drinkCarbsGrams(-500)).toBe(0);
  });
});

describe("drinkSodiumMg", () => {
  it("delivers the sodium target per litre", () => {
    expect(drinkSodiumMg(1000)).toBe(DRINK_SODIUM_MG_PER_LITRE);
    expect(drinkSodiumMg(500)).toBe(DRINK_SODIUM_MG_PER_LITRE / 2);
  });
});

describe("spoonMeasure", () => {
  it("expresses small amounts in teaspoons rounded to a quarter", () => {
    // 1.5 g of salt at 6 g per teaspoon is 0.25 tsp.
    const measure = spoonMeasure(1.5, SALT_GRAMS_PER_TEASPOON);
    expect(measure.unit).toBe("tsp");
    expect(measure.amount).toBe(0.25);
    expect(measure.label).toBe("about 0.25 tsp");
  });

  it("switches to tablespoons at three teaspoons or more", () => {
    // 60 g of sugar at 4.2 g per teaspoon is 14.3 tsp, i.e. ~4.75 tbsp.
    const measure = spoonMeasure(60, SUGAR_GRAMS_PER_TEASPOON);
    expect(measure.unit).toBe("tbsp");
    expect(measure.amount).toBe(4.75);
    expect(measure.label).toBe("about 4.75 tbsp");
  });
});

describe("drinkRecipe", () => {
  it("scales sugar to the 6% carb concentration for the total volume", () => {
    const recipe = drinkRecipe(1000);
    // Sugar is all carbohydrate, so grams of sugar equal grams of carbs.
    expect(recipe.carbsGrams).toBe(60);
    expect(recipe.sugar.grams).toBe(60);
    expect(recipe.sugar.spoon.unit).toBe("tbsp");
  });

  it("scales salt to the sodium target with a spoon measure", () => {
    const recipe = drinkRecipe(1000);
    expect(recipe.sodiumMg).toBe(600);
    // 600 mg sodium is ~1.5 g of salt at 39.3% sodium.
    expect(recipe.salt.grams).toBeCloseTo(1.5, 1);
    expect(recipe.salt.spoon.unit).toBe("tsp");
    expect(recipe.salt.spoon.amount).toBe(0.25);
  });

  it("scales linearly with the total volume", () => {
    const recipe = drinkRecipe(500);
    expect(recipe.carbsGrams).toBe(30);
    expect(recipe.sugar.grams).toBe(30);
    expect(recipe.sodiumMg).toBe(300);
    expect(recipe.totalVolumeMl).toBe(500);
  });

  it("offers optional flavouring rather than a weighed amount", () => {
    const recipe = drinkRecipe(1000);
    expect(recipe.flavouringNote.toLowerCase()).toContain("optional");
  });
});
