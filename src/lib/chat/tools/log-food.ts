import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";
import { parseNaturalNutrients } from "@/lib/nutrition/nutritionix";

export function logFoodTool(userId: string) {
  return tool({
    description:
      "Log food the user describes in natural language (e.g. '2 eggs and toast'). Parses macros via Nutritionix and inserts food log entries.",
    inputSchema: z.object({
      query: z.string().describe("Natural-language food description"),
      meal_slot: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
      logged_at: z.string().optional().describe("ISO timestamp; defaults to now"),
    }),
    execute: async ({ query, meal_slot, logged_at }) => {
      const supabase = createServerClient();
      const foods = await parseNaturalNutrients(query);
      if (foods.length === 0) return { logged: 0, totals: null };

      const rows = foods.map((f) => ({
        user_id: userId,
        logged_at: logged_at ?? new Date().toISOString(),
        meal_slot: meal_slot ?? null,
        food_id: null,
        description: f.food_name,
        servings: 1,
        calories: f.nf_calories,
        protein: f.nf_protein,
        carbs: f.nf_total_carbohydrate,
        fat: f.nf_total_fat,
        fiber: f.nf_dietary_fiber,
        sugar: f.nf_sugars,
        sodium: f.nf_sodium,
        source: "search" as const,
      }));

      const { error } = await supabase.from("food_log_entries").insert(rows);
      if (error) return { error: error.message };

      const totals = rows.reduce(
        (acc, r) => ({
          calories: acc.calories + (Number(r.calories) || 0),
          protein: acc.protein + (Number(r.protein) || 0),
          carbs: acc.carbs + (Number(r.carbs) || 0),
          fat: acc.fat + (Number(r.fat) || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );

      return { logged: rows.length, foods: rows.map((r) => r.description), totals };
    },
  });
}
