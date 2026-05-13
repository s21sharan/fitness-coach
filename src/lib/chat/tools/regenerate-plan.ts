import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";
import { generateMultiWeekPlan } from "@/lib/training/generate-plan";
import { computeComplianceStats, formatComplianceForPrompt, type ComplianceInput } from "@/lib/training/compliance";
import { SPLIT_TYPES } from "@/lib/training/schemas";
import { getActiveBlock } from "@/lib/training/blocks";

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
            .select("date, session_type")
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
          const isCardioSession = (s: string) =>
            /run|ride|bike|swim|cardio|zone\s*2/i.test(s);

          const compInput: ComplianceInput = {
            planned: plannedRes.data.map((p) => ({
              date: p.date,
              session_type: p.session_type,
              is_cardio: isCardioSession(p.session_type),
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
      });

      // Format multi-week display for PlanProposalCard
      const weekLayouts = plan.weeks.map((week) => ({
        week_number: week.week_number,
        week_focus: week.week_focus,
        days: week.days.map((d) => {
          const parts: string[] = [];
          if (d.am_session) parts.push(d.am_session);
          if (d.pm_session) parts.push(d.pm_session);
          const session = d.is_rest ? "Rest" : parts.join(" + ") || "Rest";
          const notes = [d.am_rationale, d.pm_rationale].filter(Boolean).join("; ");
          return { day: d.day_label, session, notes: notes || null };
        }),
      }));

      return {
        success: true,
        proposed: true,
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
      };
    },
  });
}
