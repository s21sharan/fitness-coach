import { tool } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { generateMultiWeekPlan } from "@/lib/training/generate-plan";
import { getNextBlockType, blockTypeLabel } from "@/lib/training/phase-rules";
import { getActiveBlock, getBlockComplianceStats, getRecoveryTrends, createBlock } from "@/lib/training/blocks";

export function proposeNextBlockTool(userId: string) {
  return tool({
    description:
      "Propose the next training block when the current block is nearing its end. Generates a structured multi-week plan based on phase progression, compliance, and recovery.",
    inputSchema: z.object({
      user_request: z
        .string()
        .optional()
        .describe("Optional user-specific request for the next block"),
    }),
    execute: async ({ user_request }) => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );

      const [profileRes, goalsRes, planRes] = await Promise.all([
        supabase.from("user_profiles").select("*").eq("user_id", userId).single(),
        supabase.from("user_goals").select("*").eq("user_id", userId).single(),
        supabase.from("training_plans").select("*").eq("user_id", userId).eq("status", "active").single(),
      ]);

      const profile = profileRes.data;
      const goals = goalsRes.data;
      const plan = planRes.data;

      if (!plan) {
        return { success: false, error: "No active training plan found." };
      }

      const activeBlock = await getActiveBlock(plan.id);
      const currentBlockNumber = activeBlock?.block_number ?? 0;

      const nextBlockType = getNextBlockType({
        raceDate: goals?.race_date ?? null,
        currentBlockType: activeBlock?.block_type ?? null,
        blockNumber: currentBlockNumber,
      });

      // Get compliance from active block
      let complianceText: string | null = null;
      if (activeBlock) {
        const compliance = await getBlockComplianceStats(activeBlock.id);
        const recoveryTrends = await getRecoveryTrends(
          userId,
          activeBlock.start_date,
          activeBlock.end_date,
        );
        complianceText = [
          `Previous block: ${activeBlock.block_label} (${activeBlock.week_count} weeks)`,
          `Compliance: ${compliance.pct}% (${compliance.completed}/${compliance.total} sessions)`,
          compliance.skipped > 0 ? `Skipped: ${compliance.skipped} sessions` : null,
          recoveryTrends.avgHrv ? `Avg HRV during block: ${recoveryTrends.avgHrv}` : null,
          recoveryTrends.avgSleep ? `Avg sleep during block: ${recoveryTrends.avgSleep}h` : null,
        ]
          .filter(Boolean)
          .join("\n");
      }

      const suggestedWeeks =
        nextBlockType === "deload" ? 1 : nextBlockType === "taper" ? 2 : 4;

      const multiWeekPlan = await generateMultiWeekPlan({
        userId,
        profile: {
          age: profile?.age ?? null,
          height: profile?.height ?? null,
          weight: profile?.weight ?? null,
          sex: profile?.sex ?? null,
          training_experience: profile?.training_experience ?? null,
        },
        goals: {
          body_goal: goals?.body_goal ?? "general",
          emphasis: goals?.emphasis ?? null,
          days_per_week: goals?.days_per_week ?? 4,
          lifting_days: goals?.lifting_days ?? null,
          training_for_race: goals?.training_for_race ?? false,
          race_type: goals?.race_type ?? null,
          race_date: goals?.race_date ?? null,
          goal_time: goals?.goal_time ?? null,
          does_cardio: goals?.does_cardio ?? false,
          cardio_types: goals?.cardio_types ?? [],
        },
        weeks: suggestedWeeks,
        compliance: complianceText,
        userRequest: user_request
          ? `${user_request}. Recommended phase: ${blockTypeLabel(nextBlockType)}`
          : `Generate a ${blockTypeLabel(nextBlockType)} block.`,
      });

      // Calculate dates
      const nextMonday = getNextMonday();
      const actualWeeks = multiWeekPlan.weeks.length;
      const endDate = new Date(nextMonday);
      endDate.setDate(endDate.getDate() + actualWeeks * 7 - 1);

      const newBlock = await createBlock({
        planId: plan.id,
        blockNumber: currentBlockNumber + 1,
        blockType: nextBlockType,
        blockLabel: `${blockTypeLabel(nextBlockType)} — ${multiWeekPlan.narrative.slice(0, 60)}`,
        weekCount: actualWeeks,
        startDate: nextMonday.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        status: "proposed",
        generationContext: {
          phaseRule: nextBlockType,
          compliance: complianceText,
          userRequest: user_request || null,
        },
      });

      const weekLayouts = multiWeekPlan.weeks.map((week) => ({
        week_number: week.week_number,
        week_focus: week.week_focus,
        days: week.days.map((d) => ({
          day_label: d.day_label,
          am_session: d.am_session,
          pm_session: d.pm_session,
          is_rest: d.is_rest,
        })),
      }));

      return {
        success: true,
        block_id: newBlock.id,
        block_type: nextBlockType,
        block_label: newBlock.block_label,
        block_number: newBlock.block_number,
        week_count: actualWeeks,
        start_date: newBlock.start_date,
        end_date: newBlock.end_date,
        narrative: multiWeekPlan.narrative,
        risks: multiWeekPlan.risks,
        week_layouts: weekLayouts,
        raw_blocks: multiWeekPlan.weeks,
      };
    },
  });
}

function getNextMonday(): Date {
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysUntilMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
