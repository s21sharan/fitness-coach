import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";
import { assertDateNotPast, todayYmdLocal } from "@/lib/training/date-guards";
import { workoutContractSchema } from "@/lib/training/schemas";
import { estimateDurationMin, type WorkoutContractV1 } from "@/lib/training/workout-contract";

const SPORTS = ["run", "bike", "swim", "strength", "other"] as const;
const STATUSES = ["scheduled", "moved", "skipped"] as const;

const changesSchema = z.object({
  rename_to: z.string().min(1).max(60).optional().describe("New session_type/display label for all matched rows."),
  shift_days: z.number().int().min(-180).max(180).optional().describe("Shift matched rows forward (+) or backward (-) by this many days. Rows landing in the past after the shift are dropped from the change set."),
  set_status: z.enum(STATUSES).optional().describe("New status to apply to matched rows."),
  set_ai_notes: z.string().optional().describe("Replace ai_notes on matched rows with this string."),
  set_contract: workoutContractSchema.optional().describe("Replace the structured contract on matched rows."),
});

export function modifyPlannedWorkoutsRangeTool(userId: string) {
  return tool({
    description:
      "Modify multiple planned workouts at once, by date range with optional filters. Two-call flow with explicit user confirmation: (1) call WITHOUT `confirmed: true` to get a preview of which rows would change and how — relay this to the user in chat; (2) call AGAIN with `confirmed: true` and the same arguments to commit. Use for bulk edits like \"rename all my Tuesday sessions\" or \"shift weeks 2-4 forward by 3 days\". For a single-row tweak prefer update_planned_workout. The training_blocks table is loose metadata and is never touched by this tool.",
    inputSchema: z.object({
      start_date: z.string().describe("Inclusive lower bound (YYYY-MM-DD). Past dates are clamped up to today."),
      end_date: z.string().describe("Inclusive upper bound (YYYY-MM-DD). Must be on or after start_date."),
      sports: z.array(z.enum(SPORTS)).optional().describe("Optional sport filter on targets.contract.sport."),
      session_type_includes: z.string().optional().describe("Optional case-insensitive substring filter on session_type."),
      changes: changesSchema.describe("The uniform changes to apply across all matched rows. At least one field required."),
      confirmed: z
        .boolean()
        .optional()
        .describe(
          "If true, the change is committed. If false/omitted, returns a preview-only payload (no DB write) — use this first to show the user, then re-call with confirmed=true after they agree.",
        ),
    }),
    execute: async ({ start_date, end_date, sports, session_type_includes, changes, confirmed }) => {
      if (end_date < start_date) {
        return { success: false, error: `end_date (${end_date}) must be on or after start_date (${start_date}).` };
      }
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
      const effectiveStart = start_date < today ? today : start_date;

      const { data: candidates, error: fetchErr } = await supabase
        .from("planned_workouts")
        .select("id, date, session_type, ai_notes, targets, status")
        .eq("plan_id", plan.id)
        .gte("date", effectiveStart)
        .lte("date", end_date);
      if (fetchErr) return { success: false, error: fetchErr.message };

      const needle = session_type_includes?.toLowerCase() ?? null;
      const sportSet = sports && sports.length > 0 ? new Set(sports) : null;
      const matches = (candidates ?? []).filter((row) => {
        if (needle && !String(row.session_type ?? "").toLowerCase().includes(needle)) return false;
        if (sportSet) {
          const targets = row.targets as { contract?: { sport?: string } } | null;
          const sport = targets?.contract?.sport ?? null;
          if (!sport || !sportSet.has(sport as typeof SPORTS[number])) return false;
        }
        return true;
      });

      if (matches.length === 0) {
        return {
          success: true,
          preview: true,
          confirmed: false,
          match_count: 0,
          message: "No matching planned workouts in that range. Nothing to change.",
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
          match_count: matches.length,
          applicable_count: applicable.length,
          dropped_count: patches.length - applicable.length,
          changes_preview: patches,
          range: { start: effectiveStart, end: end_date },
          hint: "Summarize this for the user and ask them to confirm. Then call again with the same arguments + confirmed:true to commit.",
        };
      }

      // Confirmed — commit. We issue one update per row because date+other changes can differ per row (shift creates row-specific new dates).
      let updatedCount = 0;
      const failures: Array<{ id: string; error: string }> = [];
      for (const p of applicable) {
        // assert each new date isn't past (defensive — already filtered above).
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
        failures: failures.length > 0 ? failures : undefined,
        range: { start: effectiveStart, end: end_date },
      };
    },
  });
}
