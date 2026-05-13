import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getLLMProvider, isLLMConfigured } from "@/lib/llm";
import type {
  AthleteContextProfile,
  PlanPreviewDay,
  PlanPreviewWeek,
  PlanPreviewWeekBlock,
  AvailabilityWindow,
} from "@/lib/onboarding/types";
import { computeAllScores } from "@/lib/onboarding/scoring";

const PreviewRequestSchema = z.object({
  profile: z.unknown(),
  weeks: z.number().int().min(1).max(4).default(1),
  feedback: z.string().optional(),       // free-form user feedback to refine the plan
  prior_preview: z.unknown().optional(), // previous PlanPreviewWeek for context
});

const PlanDaySchema = z.object({
  day_label: z.string(),
  am_session: z.string().nullable(),
  am_rationale: z.string().nullable(),
  pm_session: z.string().nullable(),
  pm_rationale: z.string().nullable(),
  is_rest: z.boolean(),
  notes: z.string().nullable(),
});

const PlanWeekSchema = z.object({
  week_number: z.number().int(),
  week_focus: z.string(),
  days: z.array(PlanDaySchema).length(7),
});

const PlanPreviewSchema = z.object({
  narrative: z.string().min(1),
  risks: z.array(z.string()).default([]),
  weeks: z.array(PlanWeekSchema).min(1).max(4),
});

const SYSTEM_PROMPT = `You are an expert hybrid-athlete coach. You produce week-by-week training schedules tailored to a specific athlete.

You output:
1. A short narrative (3-5 sentences) summarizing the block focus.
2. 1-5 key risks tailored to the athlete.
3. N weeks (where N is requested), each with:
   - week_number (1..N)
   - week_focus (1-2 sentence rationale for the week)
   - 7 days (Mon..Sun) each with AM and PM session strings (may be null).

Rules:
- Honor the athlete's availability_windows: only schedule sessions where the day/block is enabled. session_count=2 on a block means two sessions in that block; place both.
- Place long sessions (long run / long ride) on days flagged with "all-day" availability or as availability_rules indicate (weekends).
- Place key cardio sessions away from heavy lower-body lifting when leg_interference suggests it.
- If a day has no availability, set is_rest=true and leave sessions null.
- am_session / pm_session must be short, specific strings: "Threshold run 5x1km @ 6:30/mi" or "Lower body lift". Not generic.
- am_rationale / pm_rationale: one short line explaining why that session, that day.
- Use empty string rather than null for unused fields if your client requires it, otherwise null.

If the user provides feedback in the prompt, fully incorporate it. Move sessions, swap days, drop volume — whatever they ask for.`;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PreviewRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const profile = parsed.data.profile as AthleteContextProfile;
  const weeks = parsed.data.weeks ?? 1;
  const feedback = parsed.data.feedback ?? null;
  const priorPreview = parsed.data.prior_preview as PlanPreviewWeek | null | undefined;

  if (!profile || typeof profile !== "object") {
    return NextResponse.json({ error: "Missing profile" }, { status: 400 });
  }

  const scores = safeScores(profile);

  let preview: PlanPreviewWeek;
  if (!isLLMConfigured()) {
    preview = heuristicPreview(profile, weeks);
  } else {
    try {
      const llm = getLLMProvider();
      const result = await llm.extractJSON({
        system: SYSTEM_PROMPT,
        prompt: buildPrompt(profile, scores, weeks, feedback, priorPreview),
        schema: PlanPreviewSchema,
        schemaName: "MultiWeekPreview",
        schemaDescription: "Multi-week training plan preview",
        temperature: 0.4,
      });
      preview = {
        narrative: result.narrative,
        risks: result.risks,
        weeks: result.weeks as PlanPreviewWeekBlock[],
      };
    } catch (err) {
      console.error("Preview plan LLM error:", err);
      preview = heuristicPreview(profile, weeks);
    }
  }

  return NextResponse.json({ preview, scores });
}

function buildPrompt(
  profile: AthleteContextProfile,
  scores: ReturnType<typeof safeScores>,
  weeks: number,
  feedback: string | null,
  prior: PlanPreviewWeek | null | undefined
) {
  const summary = {
    identity: profile.athlete_identity,
    sports_planned: Object.values(profile.sports)
      .filter((s) => s.is_planned)
      .map((s) => ({
        sport: s.sport,
        current_volume: s.current_volume,
        target_peak: s.target_peak,
        sport_specific: s.sport_specific,
      })),
    primary_goal: profile.primary_optimization,
    goals_ranked: profile.goal_rank,
    aggressiveness: profile.aggressiveness,
    events: profile.events,
    body_nutrition: profile.body_nutrition,
    availability_windows: profile.availability_windows,
    availability_rules: profile.availability_rules,
    injuries: profile.injuries,
    recovery: profile.recovery,
    coach: profile.coach,
    chat_notes: profile.chat_notes,
    derived_scores: scores,
  };

  let prompt = `Athlete profile:\n${JSON.stringify(summary, null, 2)}\n\n`;
  prompt += `Generate exactly ${weeks} week(s) of training (week_number 1..${weeks}). Day labels must be exactly: "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun" in order.\n`;
  if (prior) {
    prompt += `\nPrevious plan:\n${JSON.stringify(prior, null, 2)}\n`;
  }
  if (feedback) {
    prompt += `\nUser feedback — apply this verbatim and rewrite the plan accordingly:\n"""${feedback}"""\n`;
  }
  return prompt;
}

function safeScores(profile: AthleteContextProfile) {
  try {
    return computeAllScores(profile);
  } catch {
    return null;
  }
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function heuristicPreview(profile: AthleteContextProfile, weeks: number): PlanPreviewWeek {
  const allWeeks: PlanPreviewWeekBlock[] = [];
  for (let i = 1; i <= weeks; i++) {
    allWeeks.push({
      week_number: i,
      week_focus: weekFocus(i, weeks),
      days: heuristicWeekDays(profile),
    });
  }

  const risks: string[] = [];
  const scores = safeScores(profile);
  if (scores?.ramp_risk === "high" || scores?.ramp_risk === "very_high") {
    risks.push("Volume ramp is ambitious — expect a cutback week before peak");
  }
  if (scores?.goal_conflict === "moderate" || scores?.goal_conflict === "severe") {
    risks.push("Body goal competes with performance goal — recovery may suffer");
  }
  if (scores?.interference_score === "high") {
    risks.push("Heavy lower-body lifting may interfere with key cardio sessions");
  }
  if (profile.injuries.length > 0) {
    risks.push("Injury history flagged — we'll keep ramp gentle on those areas");
  }

  const narrative = `${describeFocus(profile)}. Across these ${weeks} week(s) we balance quality work with recovery, place long sessions on weekend availability, and keep heavy legs away from key cardio days.`;

  return { narrative, risks, weeks: allWeeks };
}

function weekFocus(i: number, total: number): string {
  if (total === 1) return "Establish rhythm and confirm volume.";
  if (i === total) return "Slight cutback to consolidate.";
  if (i === 1) return "Ease in; calibrate effort.";
  return "Progress slightly while protecting recovery.";
}

function heuristicWeekDays(profile: AthleteContextProfile): PlanPreviewDay[] {
  const lifting = profile.sports.lift.is_planned;
  const running = profile.sports.run.is_planned;
  const cycling = profile.sports.bike.is_planned;
  const swimming = profile.sports.swim.is_planned;

  return DAYS.map((day, i) => {
    const windows = (profile.availability_windows ?? []).filter((w) => w.day_of_week === i);
    const am = windows.find((w) => isAM(w));
    const pm = windows.find((w) => isPM(w));
    const allDay = windows.find((w) => isAllDay(w));
    const isWeekend = i >= 5;
    const longRideWeekend = isWeekend && cycling;
    const longRunWeekend = isWeekend && running;

    let am_session: string | null = null;
    let am_rationale: string | null = null;
    let pm_session: string | null = null;
    let pm_rationale: string | null = null;
    let isRest = false;

    if (allDay) {
      if (longRunWeekend) {
        pm_session = "Long run";
        pm_rationale = "Weekly aerobic anchor; use weekend availability";
      } else if (longRideWeekend) {
        pm_session = "Long ride";
        pm_rationale = "Weekly aerobic anchor; use weekend availability";
      } else if (running) {
        pm_session = "Easy run + accessory work";
        pm_rationale = "Build aerobic base";
      }
    } else if (windows.length === 0) {
      isRest = true;
    } else {
      if (am) {
        if (i === 0 && running) {
          am_session = "Threshold run";
          am_rationale = "Quality run early in the week with fresh legs";
        } else if (i === 3 && swimming) {
          am_session = "Swim technique";
          am_rationale = "Low-impact CNS reset";
        } else if (running && i % 2 === 0) {
          am_session = "Easy run";
          am_rationale = "Aerobic accumulation";
        } else if (cycling) {
          am_session = "Easy bike (Zone 2)";
          am_rationale = "Aerobic accumulation";
        }
      }
      if (pm) {
        if (lifting && (i === 2 || i === 4)) {
          pm_session = i === 2 ? "Lower body lift" : "Upper body lift";
          pm_rationale = i === 2 ? "Strength with recovery before weekend" : "Push/pull strength";
        } else if (running && i === 5) {
          pm_session = "Easy run";
          pm_rationale = "Set up Sunday long";
        }
      }
    }

    if (!am_session && !pm_session && !isRest) {
      isRest = true;
    }

    return {
      day_label: day,
      am_session,
      am_rationale,
      pm_session,
      pm_rationale,
      is_rest: isRest,
      notes: null,
    };
  });
}

function isAM(w: AvailabilityWindow): boolean {
  return w.start_time === "06:00";
}
function isPM(w: AvailabilityWindow): boolean {
  return w.start_time === "16:00";
}
function isAllDay(w: AvailabilityWindow): boolean {
  return w.start_time === "08:00";
}

function describeFocus(p: AthleteContextProfile): string {
  if (p.events.find((e) => e.priority === "A")) {
    return "Build durability toward your A-priority event";
  }
  if (p.primary_optimization === "muscle_gain") return "Hypertrophy-first block with sustainable cardio";
  if (p.primary_optimization === "fat_loss") return "Fat-loss block while protecting strength";
  if (p.primary_optimization === "race_performance") return "Race-performance block";
  if (p.primary_optimization === "strength") return "Strength-first block";
  return "Balanced base-building block";
}
