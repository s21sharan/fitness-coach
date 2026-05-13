import { createServerClient } from "@/lib/supabase/server";
import type { BlockType } from "./phase-rules";

export interface TrainingBlock {
  id: string;
  plan_id: string;
  block_number: number;
  block_type: BlockType;
  block_label: string;
  week_count: number;
  start_date: string;
  end_date: string;
  status: "proposed" | "active" | "completed";
  generation_context: Record<string, unknown> | null;
  created_at: string;
}

export interface BlockCompliance {
  total: number;
  completed: number;
  skipped: number;
  pct: number;
}

/** Get the active block for a plan */
export async function getActiveBlock(planId: string): Promise<TrainingBlock | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("training_blocks")
    .select("*")
    .eq("plan_id", planId)
    .eq("status", "active")
    .order("block_number", { ascending: false })
    .limit(1)
    .single();
  return data as TrainingBlock | null;
}

/** Get the latest block (any status) for a plan */
export async function getLatestBlock(planId: string): Promise<TrainingBlock | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("training_blocks")
    .select("*")
    .eq("plan_id", planId)
    .order("block_number", { ascending: false })
    .limit(1)
    .single();
  return data as TrainingBlock | null;
}

/** Create a new training block */
export async function createBlock(opts: {
  planId: string;
  blockNumber: number;
  blockType: BlockType;
  blockLabel: string;
  weekCount: number;
  startDate: string;
  endDate: string;
  status: "proposed" | "active";
  generationContext?: Record<string, unknown>;
}): Promise<TrainingBlock> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("training_blocks")
    .insert({
      plan_id: opts.planId,
      block_number: opts.blockNumber,
      block_type: opts.blockType,
      block_label: opts.blockLabel,
      week_count: opts.weekCount,
      start_date: opts.startDate,
      end_date: opts.endDate,
      status: opts.status,
      generation_context: opts.generationContext || null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`Failed to create block: ${error?.message}`);
  return data as TrainingBlock;
}

/** Mark a block as completed */
export async function completeBlock(blockId: string): Promise<void> {
  const supabase = createServerClient();
  await supabase
    .from("training_blocks")
    .update({ status: "completed" })
    .eq("id", blockId);
}

/** Activate a proposed block */
export async function activateBlock(blockId: string): Promise<void> {
  const supabase = createServerClient();
  await supabase
    .from("training_blocks")
    .update({ status: "active" })
    .eq("id", blockId);
}

/** Compute compliance stats from workout rows (pure function) */
export function computeBlockCompliance(
  workouts: Array<{ session_type: string; status: string }>
): BlockCompliance {
  const nonRest = workouts.filter((w) => w.session_type.toLowerCase() !== "rest");
  if (nonRest.length === 0) return { total: 0, completed: 0, skipped: 0, pct: 0 };
  const completed = nonRest.filter((w) => w.status === "completed").length;
  const skipped = nonRest.filter((w) => w.status === "skipped").length;
  return {
    total: nonRest.length,
    completed,
    skipped,
    pct: Math.round((completed / nonRest.length) * 100),
  };
}

/** Compute which week of the block a given date falls in (1-indexed) */
export function computeBlockWeekNumber(blockStartDate: string, currentDate: string): number {
  const start = new Date(blockStartDate);
  const current = new Date(currentDate);
  const diffMs = current.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  return Math.floor(diffDays / 7) + 1;
}

/** Fetch workouts for a block and compute compliance */
export async function getBlockComplianceStats(blockId: string): Promise<BlockCompliance> {
  const supabase = createServerClient();
  const { data: workouts } = await supabase
    .from("planned_workouts")
    .select("session_type, status")
    .eq("block_id", blockId);
  return computeBlockCompliance(workouts || []);
}

/** Fetch recovery trends (avg HRV, avg sleep) over a date range for a user */
export async function getRecoveryTrends(
  userId: string,
  startDate: string,
  endDate: string
): Promise<{ avgHrv: number | null; avgSleep: number | null }> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("recovery_logs")
    .select("hrv, sleep_hours")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate);

  const rows = data || [];
  const hrvRows = rows.filter((r) => r.hrv != null);
  const sleepRows = rows.filter((r) => r.sleep_hours != null);

  return {
    avgHrv:
      hrvRows.length > 0
        ? Math.round(hrvRows.reduce((s, r) => s + r.hrv, 0) / hrvRows.length)
        : null,
    avgSleep:
      sleepRows.length > 0
        ? Math.round(
            (sleepRows.reduce((s, r) => s + r.sleep_hours, 0) / sleepRows.length) * 10
          ) / 10
        : null,
  };
}
