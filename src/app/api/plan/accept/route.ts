import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generatePlannedWorkouts } from "@/lib/training/generate-plan";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { split_type, body_goal, race_type, plan_config, weekly_layout } = await request.json();

  if (!split_type || !weekly_layout) {
    return NextResponse.json({ error: "Missing plan data" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Deactivate existing active plan
  await supabase
    .from("training_plans")
    .update({ status: "completed" })
    .eq("user_id", userId)
    .eq("status", "active");

  // Create new plan
  const { data: newPlan, error: planError } = await supabase
    .from("training_plans")
    .insert({
      user_id: userId,
      split_type,
      body_goal: body_goal || "general_fitness",
      race_type: race_type || null,
      status: "active",
      plan_config: plan_config || {},
    })
    .select("id")
    .single();

  if (planError || !newPlan) {
    return NextResponse.json({ error: "Failed to create plan" }, { status: 500 });
  }

  // Generate 2 weeks starting next Monday
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);

  const workouts = generatePlannedWorkouts(newPlan.id, weekly_layout, nextMonday, 2);

  const { error: workoutsError } = await supabase
    .from("planned_workouts")
    .insert(workouts);

  if (workoutsError) {
    return NextResponse.json({ error: "Failed to create workouts" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    plan_id: newPlan.id,
    weeks_generated: 2,
    starts: nextMonday.toISOString().slice(0, 10),
  });
}
