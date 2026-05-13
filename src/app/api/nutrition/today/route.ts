import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const dayStart = `${date}T00:00:00Z`;
  const dayEnd = `${date}T23:59:59Z`;

  const supabase = createServerClient();

  const [entriesRes, expRes] = await Promise.all([
    supabase
      .from("food_log_entries")
      .select("id, logged_at, meal_slot, description, servings, calories, protein, carbs, fat, fiber, food_id")
      .eq("user_id", userId)
      .gte("logged_at", dayStart)
      .lte("logged_at", dayEnd)
      .order("logged_at"),
    supabase
      .from("expenditure_daily")
      .select("wearable_kcal, estimated_kcal, tdee_kcal, correction_k, source")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle(),
  ]);

  const entries = entriesRes.data ?? [];
  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + (Number(e.calories) || 0),
      protein: acc.protein + (Number(e.protein) || 0),
      carbs: acc.carbs + (Number(e.carbs) || 0),
      fat: acc.fat + (Number(e.fat) || 0),
      fiber: acc.fiber + (Number(e.fiber) || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );

  const expenditure = expRes.data ?? null;
  const tdee = expenditure?.tdee_kcal ?? expenditure?.wearable_kcal ?? expenditure?.estimated_kcal ?? null;

  return NextResponse.json({
    date,
    entries,
    totals,
    expenditure,
    energy_balance: tdee != null ? totals.calories - Number(tdee) : null,
  });
}
