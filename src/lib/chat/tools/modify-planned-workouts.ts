import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";
import { assertDateNotPast, todayYmdLocal } from "@/lib/training/date-guards";
import { workoutContractSchema } from "@/lib/training/schemas";
import { estimateDurationMin, type WorkoutContractV1 } from "@/lib/training/workout-contract";

const STATUSES = ["scheduled", "moved", "skipped"] as const;

const changesSchema = z.object({
  rename_to: z.string().min(1).max(60).optional().describe("New session_type/display label for all matched rows."),
  shift_days: z.number().int().min(-180).max(180).optional().describe("Shift matched rows forward (+) or backward (-) by this many days. Rows landing in the past after the shift are dropped from the change set."),
  set_status: z.enum(STATUSES).optional().describe("New status to apply to matched rows."),
  set_ai_notes: z.string().optional().describe("Replace ai_notes on matched rows with this string."),
  set_contract: workoutContractSchema.optional().describe("Replace the structured contract on matched rows. Use sparingly across many rows — generally only when every targeted session should adopt the SAME contract."),
});

export function modifyPlannedWorkoutsTool(userId: string) {
  return tool({
    description:
      "Modify an arbitrary set of planned workouts identified by their ids. Two-call confirmation flow: (1) call WITHOUT `confirmed: true` to get a preview of which rows would change and how — relay this to the user in chat; (2) call AGAIN with `confirmed: true` and the same arguments to commit. Use this whenever the user wants any group of sessions tweaked (\"rename all my Tuesday sessions\", \"shift the next two lifts forward 1 day\"). To get ids, call get_training_plan first — every row comes back with an `id`. For a single-row tweak prefer update_planned_workout. The training_blocks table is loose metadata and is never touched by this tool.",
    inputSchema: z.object({
      workout_ids: z
        .array(z.string().uuid())
        .min(1)
        .max(60)
        .describe("Explicit list of planned_workouts.id values to modify. Get them from get_training_plan."),
      changes: changesSchema.describe("The uniform changes to apply across all matched rows. At least one field required."),
      confirmed: z
        .boolean()
        .optional()
        .describe(
          "If true, the change is committed. If false/omitted, returns a preview-only payload (no DB write) — use this first to show the user, then re-call with confirmed=true after they agree.",
        ),
    }),
    execute: async ({ workout_ids, changes, confirmed }) => {
      if (
        changes.rename_to === undefined &&
        changes.shift_days === undefined &&
        changes.set_status === undefined &&
        changes.set_ai_notes === undefined &&
        changes.set_contract === undefined
      ) {
        return { success: false, error: "No changes specified — provide at least one field in `changes`." };
      }
      if (changes.shift_days !== undefined && changes.shift_days === 0) {
        return { success: false, error: "shift_days must be non-zero (or omit it)." };
      }

      const supabase = createServerClient();
      const { data: plan } = await supabase
        .from("training_plans")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .single();
      if (!plan) return { success: false, error: "No active training plan." };

      const today = todayYmdLocal();

      const { data: candidates, error: fetchErr } = await supabase
        .from("planned_workouts")
        .select("id, date, session_type, ai_notes, targets, status")
        .eq("plan_id", plan.id)
        .in("id", workout_ids);
      if (fetchErr) return { success: false, error: fetchErr.message };

      const fetched = candidates ?? [];
      const missing = workout_ids.filter((id) => !fetched.some((r) => String(r.id) === id));

      // Filter out past-dated rows defensively — planned_workouts before today are immutable history.
      const matches = fetched.filter((row) => String(row.date) >= today);
      const droppedPast = fetched.length - matches.length;

      if (matches.length === 0) {
        return {
          success: true,
          preview: true,
          confirmed: false,
          match_count: 0,
          missing_ids: missing,
          dropped_past_count: droppedPast,
          message:
            droppedPast > 0
              ? "All targeted workouts are in the past — past sessions are immutable history. Nothing to change."
              : "No matching planned workouts. Nothing to change.",
        };
      }

      // Compute the per-row patch up front so preview and commit see the same set.
      type PatchRow = {
        id: string;
        from: { date: string; session_type: string; status: string | null };
        to: Partial<{ date: string; session_type: string; status: string; ai_notes: string | null; targets: Record<string, unknown> }>;
        drop_reason?: string;
      };
      const patches: PatchRow[] = [];
      for (const row of matches) {
        const to: PatchRow["to"] = {};
        let dropReason: string | undefined;

        if (changes.shift_days !== undefined) {
          const original = new Date(String(row.date) + "T00:00:00");
          original.setDate(original.getDate() + changes.shift_days);
          const newDate = original.toISOString().slice(0, 10);
          if (newDate < today) {
            dropReason = `shifted to ${newDate}, which is in the past`;
          } else {
            to.date = newDate;
          }
        }
        if (changes.rename_to !== undefined) to.session_type = changes.rename_to;
        if (changes.set_status !== undefined) to.status = changes.set_status;
        if (changes.set_ai_notes !== undefined) to.ai_notes = changes.set_ai_notes;
        if (changes.set_contract !== undefined) {
          const prev = (row.targets as Record<string, unknown> | null) ?? {};
          const normalized: WorkoutContractV1 = {
            ...(changes.set_contract as unknown as WorkoutContractV1),
            source: "coach",
          };
          to.targets = {
            ...prev,
            contract: normalized,
            target_duration_min: estimateDurationMin(normalized.steps),
          };
        }

        patches.push({
          id: String(row.id),
          from: {
            date: String(row.date),
            session_type: String(row.session_type ?? ""),
            status: (row.status as string | null) ?? null,
          },
          to,
          drop_reason: dropReason,
        });
      }

      const applicable = patches.filter((p) => !p.drop_reason);

      if (!confirmed) {
        return {
          success: true,
          preview: true,
          confirmed: false,
          committed: false,
          status: "PREVIEW_ONLY_NOT_COMMITTED",
          match_count: matches.length,
          applicable_count: applicable.length,
          dropped_count: patches.length - applicable.length,
          dropped_past_count: droppedPast,
          missing_ids: missing,
          changes_preview: patches,
          hint: "THIS IS A PREVIEW — NO DATABASE WRITE HAS HAPPENED. The calendar is unchanged. Summarize for the user, get their confirmation, then call this tool AGAIN with identical arguments PLUS confirmed:true to actually commit. Do NOT tell the user the change is done until you have made the second call and received a response with confirmed:true.",
        };
      }

      // Confirmed — commit. One update per row because date+other changes can differ per row (shift creates row-specific new dates).
      let updatedCount = 0;
      const failures: Array<{ id: string; error: string }> = [];
      for (const p of applicable) {
        if (p.to.date) {
          const guard = assertDateNotPast(p.to.date);
          if (!guard.ok) {
            failures.push({ id: p.id, error: guard.error });
            continue;
          }
        }
        const { error } = await supabase
          .from("planned_workouts")
          .update(p.to as Record<string, unknown>)
          .eq("id", p.id);
        if (error) failures.push({ id: p.id, error: error.message });
        else updatedCount++;
      }

      return {
        success: failures.length === 0,
        confirmed: true,
        updated_count: updatedCount,
        dropped_count: patches.length - applicable.length,
        dropped_past_count: droppedPast,
        missing_ids: missing,
        failures: failures.length > 0 ? failures : undefined,
      };
    },
  });
}
