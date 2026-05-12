import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getLLMProvider, isLLMConfigured } from "@/lib/llm";
import type {
  AthleteContextProfile,
  PlanPreviewDay,
  PlanPreviewWeek,
} from "@/lib/onboarding/types";
import { computeAllScores } from "@/lib/onboarding/scoring";

const PreviewRequestSchema = z.object({
  profile: z.unknown(),
});

const PlanPreviewSchema = z.object({
  narrative: z.string().min(1),
  risks: z.array(z.string()).default([]),
  first_week: z
    .array(
      z.object({
        day_label: z.string(),
        session: z.string(),
        rationale: z.string(),
      })
    )
    .length(7),
});

const SYSTEM_PROMPT = `You are an expert hybrid-athlete coach. Given an athlete's full context profile, produce:
1. A short narrative (3-5 sentences) summarizing what the first training block should focus on.
2. A list of 1-5 key risks tailored to the athlete.
3. A 7-day starting week (Mon-Sun) with one session per day and a one-line rationale per day.

Be specific to the athlete's primary goal, sport priorities, lifting/cardio interference, body goal, and any constraints in chat_notes. Days the athlete is unavailable should be "Rest". Always protect their primary sport's key sessions.`;

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

  if (!profile || typeof profile !== "object") {
    return NextResponse.json({ error: "Missing profile" }, { status: 400 });
  }

  const scores = safeScores(profile);

  let preview: PlanPreviewWeek;
  if (!isLLMConfigured()) {
    preview = heuristicPreview(profile);
  } else {
    try {
      const llm = getLLMProvider();
      const result = await llm.extractJSON({
        system: SYSTEM_PROMPT,
        prompt: buildPrompt(profile, scores),
        schema: PlanPreviewSchema,
        schemaName: "FirstWeekPreview",
        schemaDescription: "First training week preview",
        temperature: 0.4,
      });
      preview = {
        narrative: result.narrative,
        risks: result.risks,
        first_week: result.first_week as PlanPreviewDay[],
      };
    } catch (err) {
      console.error("Preview plan LLM error:", err);
      preview = heuristicPreview(profile);
    }
  }

  return NextResponse.json({ preview, scores });
}

function buildPrompt(profile: AthleteContextProfile, scores: ReturnType<typeof safeScores>) {
  const summary = {
    identity: profile.athlete_identity,
    sports_planned: Object.values(profile.sports)
      .filter((s) => s.is_planned)
      .map((s) => ({
        sport: s.sport,
        is_primary: s.is_primary,
        is_limiter: s.is_limiter,
        priority: s.priority,
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

  return `Athlete profile:\n${JSON.stringify(summary, null, 2)}\n\nReturn a JSON object with: narrative (string), risks (string[]), first_week (array of exactly 7 objects with day_label, session, rationale).
Day labels must be exactly: "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun" in order.`;
}

function safeScores(profile: AthleteContextProfile) {
  try {
    return computeAllScores(profile);
  } catch {
    return null;
  }
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function heuristicPreview(profile: AthleteContextProfile): PlanPreviewWeek {
  const lifting = profile.sports.lift.is_planned;
  const running = profile.sports.run.is_planned;
  const cycling = profile.sports.bike.is_planned;
  const swimming = profile.sports.swim.is_planned;
  const longSessionWeekend = (profile.availability_rules ?? []).some(
    (r) => r.rule_key === "long_run_weekend"
  );

  const sessions: PlanPreviewDay[] = DAYS.map((day, i) => {
    let session = "Rest";
    let rationale = "Recovery day";

    if (running && i === 0) {
      session = "Threshold run + optional upper body";
      rationale = "Quality run early in the week with fresh legs";
    } else if (cycling && i === 1) {
      session = "Easy bike (Zone 2)";
      rationale = "Aerobic accumulation";
    } else if (lifting && i === 2) {
      session = "Lower body lift";
      rationale = "Strength with enough recovery before weekend";
    } else if (swimming && i === 3) {
      session = "Swim technique";
      rationale = "Low-impact CNS reset";
    } else if (lifting && i === 4) {
      session = "Upper body lift";
      rationale = "Push/pull strength";
    } else if (running && i === 5 && longSessionWeekend) {
      session = "Easy run + accessory work";
      rationale = "Set up Sunday long";
    } else if (running && i === 6 && longSessionWeekend) {
      session = "Long run";
      rationale = "Weekly aerobic anchor";
    } else if (running && i === 6) {
      session = "Long run";
      rationale = "Weekly aerobic anchor";
    } else if (cycling && i === 5) {
      session = "Long ride";
      rationale = "Weekly aerobic anchor";
    }

    return { day_label: day, session, rationale };
  });

  const risks: string[] = [];
  const scores = safeScores(profile);
  if (scores?.ramp_risk === "high" || scores?.ramp_risk === "very_high") {
    risks.push("Volume ramp is ambitious — expect cutback weeks");
  }
  if (scores?.goal_conflict === "moderate" || scores?.goal_conflict === "severe") {
    risks.push("Body goal competes with performance goal — recovery may suffer");
  }
  if (scores?.interference_score === "high") {
    risks.push("Heavy lower-body lifting may interfere with key cardio sessions");
  }
  if (profile.injuries.length > 0) {
    risks.push("Injury history flagged — we'll keep ramp gentle");
  }

  const narrative = `${describeFocus(profile)}. The first week balances quality work with recovery. We'll keep weekend sessions for your longest cardio efforts and place heavy legs away from key run/bike days.`;

  return { narrative, risks, first_week: sessions };
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
