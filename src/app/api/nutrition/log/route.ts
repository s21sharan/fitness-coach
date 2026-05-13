import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

interface LogPayload {
  logged_at?: string;
  meal_slot?: "breakfast" | "lunch" | "dinner" | "snack";
  description?: string;
  servings?: number;
  source?: "search" | "manual" | "quick";
  // Either reference a cached food...
  food_id?: string;
  // ...or cache a new one inline from a parse result
  food?: {
    source: "nutritionix" | "manual" | "custom";
    source_id?: string | null;
    name: string;
    brand?: string | null;
    serving_qty?: number | null;
    serving_unit?: string | null;
    serving_grams?: number | null;
    calories?: number | null;
    protein?: number | null;
    carbs?: number | null;
    fat?: number | null;
    fiber?: number | null;
    sugar?: number | null;
    sodium?: number | null;
  };
  // Explicit macros (override food values)
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { entries?: LogPayload[] } | LogPayload;
  const entries: LogPayload[] = Array.isArray((body as { entries?: LogPayload[] }).entries)
    ? (body as { entries: LogPayload[] }).entries
    : [body as LogPayload];

  const supabase = createServerClient();
  const inserts = [];

  for (const e of entries) {
    let foodId = e.food_id ?? null;

    if (!foodId && e.food) {
      const upsert = {
        source: e.food.source,
        source_id: e.food.source_id ?? null,
        name: e.food.name,
        brand: e.food.brand ?? null,
        serving_qty: e.food.serving_qty ?? null,
        serving_unit: e.food.serving_unit ?? null,
        serving_grams: e.food.serving_grams ?? null,
        calories: e.food.calories ?? null,
        protein: e.food.protein ?? null,
        carbs: e.food.carbs ?? null,
        fat: e.food.fat ?? null,
        fiber: e.food.fiber ?? null,
        sugar: e.food.sugar ?? null,
        sodium: e.food.sodium ?? null,
      };
      const { data, error } = await supabase
        .from("foods")
        .upsert(upsert, { onConflict: "source,source_id" })
        .select("id")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      foodId = data?.id ?? null;
    }

    const servings = e.servings ?? 1;
    const macros = e.food ?? {};
    inserts.push({
      user_id: userId,
      logged_at: e.logged_at ?? new Date().toISOString(),
      meal_slot: e.meal_slot ?? null,
      food_id: foodId,
      description: e.description ?? null,
      servings,
      calories: e.calories ?? (macros.calories != null ? Number(macros.calories) * servings : null),
      protein: e.protein ?? (macros.protein != null ? Number(macros.protein) * servings : null),
      carbs: e.carbs ?? (macros.carbs != null ? Number(macros.carbs) * servings : null),
      fat: e.fat ?? (macros.fat != null ? Number(macros.fat) * servings : null),
      fiber: e.fiber ?? (macros.fiber != null ? Number(macros.fiber) * servings : null),
      sugar: e.sugar ?? (macros.sugar != null ? Number(macros.sugar) * servings : null),
      sodium: e.sodium ?? (macros.sodium != null ? Number(macros.sodium) * servings : null),
      source: e.source ?? (e.food ? "search" : "manual"),
    });
  }

  const { data, error } = await supabase.from("food_log_entries").insert(inserts).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ids: data?.map((r) => r.id) ?? [] });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = createServerClient();
  const { error } = await supabase
    .from("food_log_entries")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
