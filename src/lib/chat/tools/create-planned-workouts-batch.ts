import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";
import { workoutContractSchema, type SessionContract, type SessionDay, type WeekBlock } from "@/lib/training/schemas";
import { assertDateNotPast } from "@/lib/training/date-guards";
import { createBlock, getLatestBlock } from "@/lib/training/blocks";
import type { BlockType } from "@/lib/training/phase-rules";
import type { WorkoutContractV1 } from "@/lib/training/workout-contract";

const BLOCK_TYPES = ["base", "build", "peak", "taper", "accumulation", "intensification", "deload"] as const;
const SLOTS = ["am", "pm", "full"] as const;
const SPORTS = ["run", "bike", "swim", "strength", "other"] as const;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type DayLabel = (typeof DAY_LABELS)[number];

const sessionInputSchema = z.object({
  date: z.string().describe("YYYY-MM-DD; must fall within [start_date, end_date]."),
  slot: z.enum(SLOTS),
  sport: z.enum(SPORTS),
  name: z.string().min(1).max(60),
  contract: workoutContractSchema,
  rationale: z.string().optional(),
});

export function createPlannedWorkoutsBatchTool(userId: string) {
  return tool({
    description:
      "Propose a batch of planned workouts to be added in one go (e.g. '4 weeks of base running'). Returns a BlockProposalCard payload that the user reviews and accepts in chat. On accept, every session is inserted into planned_workouts AND a `training_blocks` row is created as LOOSE metadata that powers the calendar's phase banner — the block row is NOT authoritative over the actual sessions. Sub-range deletes and modifies (via delete_planned_workouts / modify_planned_workouts / swap_planned_workouts) operate directly on planned_workouts and leave the block row intact, even if it ends up partially populated.",
    inputSchema: z.object({
      label: z.string().min(1).max(80).describe('Human-readable label, e.g. "Base running — May". Doubles as the calendar banner text.'),
      phase: z
        .enum(BLOCK_TYPES)
        .describe("Phase tag stored on the training_blocks row as loose context (base / build / peak / taper / accumulation / intensification / deload)."),
      start_date: z.string().describe("YYYY-MM-DD; first day of the batch. Must be today or later."),
      end_date: z.string().describe("YYYY-MM-DD; last day of the batch (inclusive)."),
      sessions: z
        .array(sessionInputSchema)
        .min(1)
        .max(60)
        .describe(
          "Every planned workout in the batch. Slot ('am'/'pm'/'full') drives calendar rendering; coach is responsible for fitting these into the user's availability windows unless they explicitly overrode.",
        ),
      narrative: z.string().optional().describe("One-paragraph rationale for the proposal card."),
      risks: z.array(z.string()).optional(),
      user_override_schedule: z.boolean().optional(),
    }),
    execute: async ({ label, phase, start_date, end_date, sessions, narrative, risks, user_override_schedule }) => {
      const startGuard = assertDateNotPast(start_date);
      if (!startGuard.ok) return { success: false, error: startGuard.error };
      if (end_date < start_date) {
        return { success: false, error: `end_date (${end_date}) must be on or after start_date (${start_date}).` };
      }
      for (const s of sessions) {
        if (s.date < start_date || s.date > end_date) {
          return {
            success: false,
            error: `Session date ${s.date} (${s.name}) falls outside the batch window ${start_date}..${end_date}.`,
          };
        }
      }

      const supabase = createServerClient();
      const { data: plan } = await supabase
        .from("training_plans")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .single();
      if (!plan) return { success: false, error: "No active training plan." };

      const latest = await getLatestBlock(plan.id);
      const nextBlockNumber = (latest?.block_number ?? 0) + 1;

      const startMonday = mondayOf(start_date);
      const weeks = bucketSessionsIntoWeeks(sessions, startMonday, end_date);
      const weekCount = weeks.length;
      if (weekCount === 0) return { success: false, error: "No sessions resolved to a valid week — check dates." };

      // training_blocks row is created in 'proposed' state and becomes loose
      // metadata once accepted. /api/block/accept flips it active + inserts the
      // planned_workouts; afterwards no tool here ever references it again.
      const newBlock = await createBlock({
        planId: plan.id,
        blockNumber: nextBlockNumber,
        blockType: phase as BlockType,
        blockLabel: label,
        weekCount,
        startDate: start_date,
        endDate: end_date,
        status: "proposed",
        generationContext: {
          source: "coach_batch_create",
          user_override_schedule: user_override_schedule ?? false,
        },
      });

      const week_layouts = weeks.map((w) => ({
        week_number: w.week_number,
        week_focus: w.week_focus,
        days: w.days.map((d) => ({
          day_label: d.day_label,
          am_session: d.am_session?.name ?? null,
          pm_session: d.pm_session?.name ?? null,
          is_rest: d.is_rest,
        })),
      }));

      return {
        success: true,
        proposed: true,
        committed: false,
        status: "PROPOSAL_ONLY_USER_MUST_ACCEPT_IN_UI",
        hint: "This is a PROPOSAL ONLY — NO planned_workouts have been inserted yet and the calendar is unchanged. A BlockProposalCard is shown to the user in chat; they must click 'Accept' for the sessions to land on the calendar. Do NOT tell the user the sessions are scheduled. Tell them to review and accept the card.",
        block_id: newBlock.id,
        block_type: newBlock.block_type,
        block_label: newBlock.block_label,
        block_number: newBlock.block_number,
        week_count: weekCount,
        start_date: newBlock.start_date,
        end_date: newBlock.end_date,
        narrative: narrative ?? `${label} — ${weekCount} week${weekCount === 1 ? "" : "s"}, ${sessions.length} session${sessions.length === 1 ? "" : "s"}.`,
        risks: risks ?? (user_override_schedule ? ["Some sessions sit outside your normal availability — confirm you can hit them."] : []),
        week_layouts,
        raw_blocks: weeks,
      };
    },
  });
}

function mondayOf(ymd: string): Date {
  const d = new Date(ymd + "T00:00:00");
  const jsDow = d.getDay();
  const back = jsDow === 0 ? 6 : jsDow - 1;
  d.setDate(d.getDate() - back);
  d.setHours(0, 0, 0, 0);
  return d;
}

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayLabelFor(d: Date): DayLabel {
  const idx = (d.getDay() + 6) % 7;
  return DAY_LABELS[idx];
}

interface SessionInput {
  date: string;
  slot: "am" | "pm" | "full";
  sport: "run" | "bike" | "swim" | "strength" | "other";
  name: string;
  contract: z.infer<typeof workoutContractSchema>;
  rationale?: string;
}

function toSessionContract(s: SessionInput, slot: "am" | "pm" | "full"): SessionContract {
  const normalized: WorkoutContractV1 = {
    ...(s.contract as unknown as WorkoutContractV1),
    source: "coach",
    sport: s.sport,
    name: s.name,
    slot,
  };
  return {
    sport: s.sport,
    name: s.name,
    rationale: s.rationale ?? null,
    contract: normalized,
  };
}

function bucketSessionsIntoWeeks(
  sessions: SessionInput[],
  startMonday: Date,
  endDate: string,
): WeekBlock[] {
  const endD = new Date(endDate + "T00:00:00");
  const weekCount = Math.max(
    1,
    Math.ceil((endD.getTime() - startMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) +
      (endD.getDay() === 0 ? 1 : 0),
  );
  const cappedWeeks = Math.min(6, weekCount);

  const weeks: WeekBlock[] = [];
  for (let w = 0; w < cappedWeeks; w++) {
    const days: SessionDay[] = DAY_LABELS.map((label) => ({
      day_label: label,
      am_session: null,
      pm_session: null,
      is_rest: true,
      notes: null,
    }));
    weeks.push({ week_number: w + 1, week_focus: `Week ${w + 1}`, days });
  }

  for (const s of sessions) {
    const sDate = new Date(s.date + "T00:00:00");
    const diffDays = Math.floor((sDate.getTime() - startMonday.getTime()) / (24 * 60 * 60 * 1000));
    const weekIdx = Math.floor(diffDays / 7);
    if (weekIdx < 0 || weekIdx >= weeks.length) continue;

    const dayLabel = dayLabelFor(sDate);
    const day = weeks[weekIdx].days.find((d) => d.day_label === dayLabel);
    if (!day) continue;

    const sc = toSessionContract(s, s.slot);
    if (s.slot === "am") day.am_session = sc;
    else if (s.slot === "pm") day.pm_session = sc;
    else day.am_session = sc;
    day.is_rest = false;
  }

  while (weeks.length > 1 && weeks[weeks.length - 1].days.every((d) => d.is_rest)) {
    const lastMonday = new Date(startMonday);
    lastMonday.setDate(startMonday.getDate() + (weeks.length - 1) * 7);
    if (ymdLocal(lastMonday) > endDate) weeks.pop();
    else break;
  }

  return weeks;
}
