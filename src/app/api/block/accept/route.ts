import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { expandBlocksToWorkouts } from "@/lib/training/generate-plan";
import type { WeekBlock } from "@/lib/training/schemas";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { block_id, raw_blocks } = body;

  if (!block_id) {
    return NextResponse.json({ error: "block_id required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Fetch the proposed block
  const { data: block, error: blockErr } = await supabase
    .from("training_blocks")
    .select("*")
    .eq("id", block_id)
    .single();

  if (blockErr || !block) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }

  if (block.status !== "proposed") {
    return NextResponse.json({ error: "Block is not in proposed status" }, { status: 400 });
  }

  // Complete the previous active block for this plan
  await supabase
    .from("training_blocks")
    .update({ status: "completed" })
    .eq("plan_id", block.plan_id)
    .eq("status", "active");

  // Activate the proposed block
  await supabase
    .from("training_blocks")
    .update({ status: "active" })
    .eq("id", block_id);

  // Create planned workouts from raw_blocks if provided
  if (raw_blocks && Array.isArray(raw_blocks) && raw_blocks.length > 0) {
    const startDate = new Date(block.start_date);
    const workouts = expandBlocksToWorkouts(block.plan_id, raw_blocks as WeekBlock[], startDate);
    const workoutsWithBlock = workouts.map((w) => ({ ...w, block_id }));

    const { error: insertErr } = await supabase
      .from("planned_workouts")
      .insert(workoutsWithBlock);

    if (insertErr) {
      return NextResponse.json({ error: "Failed to create workouts" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, block_id });
}
