/**
 * Nutritionix client — used from Next.js API routes (server-side only).
 * Docs: https://docx.syndigo.com/developers/docs/natural-language-for-nutrients
 */

const BASE = "https://trackapi.nutritionix.com/v2";

export interface NutritionixFood {
  food_name: string;
  brand_name?: string | null;
  serving_qty: number;
  serving_unit: string;
  serving_weight_grams: number | null;
  nf_calories: number | null;
  nf_protein: number | null;
  nf_total_carbohydrate: number | null;
  nf_total_fat: number | null;
  nf_dietary_fiber: number | null;
  nf_sugars: number | null;
  nf_sodium: number | null;
  nix_item_id?: string | null;
}

function headers() {
  const appId = process.env.NUTRITIONIX_APP_ID;
  const apiKey = process.env.NUTRITIONIX_API_KEY;
  if (!appId || !apiKey) {
    throw new Error("NUTRITIONIX_APP_ID / NUTRITIONIX_API_KEY are not configured");
  }
  return {
    "x-app-id": appId,
    "x-app-key": apiKey,
    "Content-Type": "application/json",
  };
}

export async function parseNaturalNutrients(query: string): Promise<NutritionixFood[]> {
  const res = await fetch(`${BASE}/natural/nutrients`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Nutritionix /natural/nutrients ${res.status}`);
  const json = (await res.json()) as { foods: NutritionixFood[] };
  return json.foods ?? [];
}

export interface NutritionixSuggestion {
  food_name: string;
  brand_name?: string;
  serving_unit?: string;
  serving_qty?: number;
  nf_calories?: number;
  nix_item_id?: string;
}

export async function instantSearch(query: string): Promise<{
  common: NutritionixSuggestion[];
  branded: NutritionixSuggestion[];
}> {
  const res = await fetch(`${BASE}/search/instant?query=${encodeURIComponent(query)}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Nutritionix /search/instant ${res.status}`);
  return res.json();
}
