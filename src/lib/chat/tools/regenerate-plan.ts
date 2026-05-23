import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";
import { generateMultiWeekPlan } from "@/lib/training/generate-plan";
import { computeComplianceStats, formatComplianceForPrompt, isCardioPlanned, type ComplianceInput } from "@/lib/training/compliance";
import { SPLIT_TYPES } from "@/lib/training/schemas";
import { getActiveBlock } from "@/lib/training/blocks";
import type { PlannedWorkoutTargets } from "@/lib/training/workout-contract";
import { fetchActiveFacts } from "@/lib/athlete-context/facts";
import { formatFactsForPlanPrompt } from "@/lib/athlete-context/format";
import { ensureActiveSpec, specToPayload } from "@/lib/training/spec/store";
import { checkPlanAgainstSpec } from "@/lib/training/spec/check-plan";

export function regeneratePlanTool(userId: string) {
  return tool({
    description:
      "Generate a proposed multi-week training plan based on the user's request. Returns a proposal for the user to review and approve — does NOT save to database. Use when the user wants to change their training split, restructure their week, or create a new plan.",
    inputSchema: z.object({
      user_request: z
        .string()
        .describe("The user's full description of what they want their training plan to look like"),
      split_type: z
        .enum(SPLIT_TYPES)
        .describe("The closest matching split type for the new plan"),
      days_per_week: z
        .number()
        .min(3)
        .max(7)
        .describe("Total training days per week"),
    }),
    execute: async ({ user_request, split_type, days_per_week }) => {
      const supabase = createServerClient();

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      const { data: goals } = await supabase
        .from("user_goals")
        .select("*")
        .eq("user_id", userId)
        .single();

      const { data: activePlan } = await supabase
        .from("training_plans")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .single();

      const activeBlock = activePlan ? await getActiveBlock(activePlan.id) : null;

      // Build compliance stats from the active block's date range, or last 2 weeks as fallback
      let complianceText: string | null = null;
      if (activePlan) {
        const sinceStr = activeBlock
          ? activeBlock.start_date
          : (() => {
              const twoWeeksAgo = new Date();
              twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
              return twoWeeksAgo.toISOString().slice(0, 10);
            })();
        const untilStr = activeBlock
          ? activeBlock.end_date
          : new Date().toISOString().slice(0, 10);

        const [plannedRes, liftRes, cardioRes] = await Promise.all([
          supabase.from("planned_workouts")
            .select("date, session_type, targets, status, skip_reason")
            .eq("plan_id", activePlan.id)
            .gte("date", sinceStr)
            .lte("date", untilStr),
          supabase.from("workout_logs")
            .select("date, name")
            .eq("user_id", userId)
            .eq("is_suppressed", false)
            .gte("date", sinceStr)
            .order("date", { ascending: false }),
          supabase.from("cardio_logs")
            .select("date, type, distance")
            .eq("user_id", userId)
            .eq("is_suppressed", false)
            .gte("date", sinceStr)
            .order("date", { ascending: false }),
        ]);

        if (plannedRes.data && plannedRes.data.length > 0) {
          const compInput: ComplianceInput = {
            planned: plannedRes.data.map((p) => ({
              date: p.date,
              session_type: p.session_type,
              is_cardio: isCardioPlanned({
                session_type: p.session_type,
                targets: (p as { targets?: PlannedWorkoutTargets | null }).targets ?? null,
              }),
              status: (p as { status?: string | null }).status ?? null,
              skip_reason: (p as { skip_reason?: string | null }).skip_reason ?? null,
            })),
            actualLifting: (liftRes.data || []).map((l) => ({ date: l.date, name: l.name })),
            actualCardio: (cardioRes.data || []).map((c) => ({ date: c.date, type: c.type, distance: c.distance })),
          };

          const stats = computeComplianceStats(compInput);
          if (stats.totalPlanned > 0) {
            complianceText = formatComplianceForPrompt(stats);
          }
        }
      }

      const activeFacts = await fetchActiveFacts(userId);
      const factsBlock = formatFactsForPlanPrompt(activeFacts);

      // Per-athlete constraint spec: injected into the planner + enforced via a
      // bounded repair loop inside generateMultiWeekPlan. Lazily backfilled for
      // athletes who onboarded before specs existed.
      const spec = await ensureActiveSpec(userId);
      const specPayload = spec ? specToPayload(spec) : null;

      const plan = await generateMultiWeekPlan({
        userId,
        profile: {
          age: profile?.age ?? null,
          height: profile?.height ?? null,
          weight: profile?.weight ?? null,
          sex: profile?.sex ?? null,
          training_experience: profile?.training_experience ?? null,
        },
        goals: {
          body_goal: goals?.body_goal || "general_fitness",
          emphasis: goals?.emphasis ?? null,
          days_per_week: days_per_week,
          lifting_days: goals?.lifting_days ?? null,
          training_for_race: goals?.training_for_race ?? false,
          race_type: goals?.race_type ?? null,
          race_date: goals?.race_date ?? null,
          goal_time: goals?.goal_time ?? null,
          does_cardio: goals?.does_cardio ?? false,
          cardio_types: goals?.cardio_types ?? [],
        },
        weeks: activeBlock?.week_count ?? 2,
        compliance: complianceText,
        userRequest: user_request,
        factsBlock,
        spec: specPayload,
      });

      // Re-check the final plan and surface any residual blocker the repair loop
      // couldn't resolve. Per the design, we escalate (flag a possibly-stale
      // constraint) rather than silently loosening the spec during generation.
      const residual = specPayload
        ? checkPlanAgainstSpec(plan, specPayload.constraints).filter((v) => v.severity === "blocker")
        : [];

      // Format multi-week display for PlanProposalCard
      const weekLayouts = plan.weeks.map((week) => ({
        week_number: week.week_number,
        week_focus: week.week_focus,
        days: week.days.map((d) => {
          const parts: string[] = [];
          if (d.am_session) parts.push(d.am_session.name);
          if (d.pm_session) parts.push(d.pm_session.name);
          const session = d.is_rest ? "Rest" : parts.join(" + ") || "Rest";
          const notes = [d.am_session?.rationale, d.pm_session?.rationale].filter(Boolean).join("; ");
          return { day: d.day_label, session, notes: notes || null };
        }),
      }));

      return {
        success: true,
        proposed: true,
        committed: false,
        status: "PROPOSAL_ONLY_USER_MUST_ACCEPT_IN_UI",
        hint: "This is a PROPOSAL ONLY — NO DATABASE WRITE HAS HAPPENED and the calendar is unchanged. The proposal is shown to the user as a card in the chat. They must click 'Accept plan' in the UI for the new sessions to land on the calendar. Do NOT tell the user the change is done. Tell them to review the card and accept it. After they accept, re-read the 'Sessions on your calendar' block in your context (it will refresh on the next message) to verify.",
        split_type: plan.split_type,
        reasoning: plan.narrative,
        risks: plan.risks,
        weekly_layout: weekLayouts[0]?.days || [],
        week_layouts: weekLayouts,
        raw_blocks: plan.weeks,
        plan_config: plan.plan_config,
        body_goal: goals?.body_goal || "general_fitness",
        race_type: goals?.race_type || null,
        block_id: activeBlock?.id ?? null,
        constraint_violations: residual.map((v) => v.detail),
        constraint_escalation:
          residual.length > 0
            ? "This plan could not fully satisfy the athlete's hard constraints. Do NOT silently ignore this. Either revise, or if you believe a constraint is now stale (the athlete's situation changed), tell the athlete and use update_constraints with a grounded justification — never loosen a constraint just to make the plan pass."
            : null,
      };
    },
  });
}
