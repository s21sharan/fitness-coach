import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { parseNaturalNutrients } from "@/lib/nutrition/nutritionix";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { query } = (await req.json()) as { query?: string };
  if (!query?.trim()) return NextResponse.json({ error: "query required" }, { status: 400 });

  try {
    const foods = await parseNaturalNutrients(query);
    const parsed = foods.map((f) => ({
      source: "nutritionix" as const,
      source_id: f.nix_item_id ?? null,
      name: f.food_name,
      brand: f.brand_name ?? null,
      serving_qty: f.serving_qty,
      serving_unit: f.serving_unit,
      serving_grams: f.serving_weight_grams,
      calories: f.nf_calories,
      protein: f.nf_protein,
      carbs: f.nf_total_carbohydrate,
      fat: f.nf_total_fat,
      fiber: f.nf_dietary_fiber,
      sugar: f.nf_sugars,
      sodium: f.nf_sodium,
    }));
    return NextResponse.json({ foods: parsed });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
