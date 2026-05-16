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
import { sessionContractSchema, type SessionContract } from "@/lib/training/schemas";

const PreviewRequestSchema = z.object({
  profile: z.unknown(),
  weeks: z.number().int().min(1).max(4).default(1),
  feedback: z.string().optional(),       // free-form user feedback to refine the plan
  prior_preview: z.unknown().optional(), // previous PlanPreviewWeek for context
});

const PlanDaySchema = z.object({
  day_label: z.string(),
  am_session: sessionContractSchema.nullable(),
  pm_session: sessionContractSchema.nullable(),
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
   - 7 days (Mon..Sun), each with am_session and pm_session structured objects (may be null).

Rules:
- Honor the athlete's availability_windows: only schedule sessions where the day/block is enabled. session_count=2 on a block means two sessions in that block; place both.
- Place long sessions (long run / long ride) on days flagged with "all-day" availability or as availability_rules indicate (weekends).
- Place key cardio sessions away from heavy lower-body lifting when leg_interference suggests it.
- If a day has no availability, set is_rest=true and leave both sessions null.

## Structured Session Format
am_session and pm_session are STRUCTURED OBJECTS (not strings):
{
  "sport": "run" | "bike" | "swim" | "strength",
  "name": short display label (≤60 chars), e.g. "Easy Z2 run",
  "rationale": one sentence explaining why this session is placed here and now,
  "contract": {
    "version": 1,
    "sport": same as outer,
    "name": same short label,
    "slot": "am" | "pm" | "full",
    "source": "onboarding_preview",
    "steps": [ ...ContractStep[] ]
  }
}

ContractStep fields:
- type: "warmup" | "work" | "recovery" | "cooldown" | "rest" | "repeat"
- label: short text
- duration_sec: integer seconds (use this for time-based steps)
- distance_m: meters (for runs / bikes / swims)
- target_hr_zone: 1..5
- pace_sec_per_km: running pace target in seconds per km
- ftp_percent: 30..150 for cycling power
- exercise_name / sets / reps / weight_kg / rpe: for strength steps
- repeats + steps (nested): for interval blocks

Emission rules:
- ALWAYS set version=1, source="onboarding_preview", correct sport.
- Cardio: include at least one work step with duration_sec or distance_m + target_hr_zone or pace_sec_per_km when known.
- Strength: when split is specific (e.g. "Upper body — push/pull"), emit a single work step with a label and duration_sec is fine. Detailed per-exercise breakdowns are optional.
- Granularity matches the athlete's level of detail.

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

function makeSession(opts: {
  sport: "run" | "bike" | "swim" | "strength";
  name: string;
  rationale: string;
  slot: "am" | "pm" | "full";
  durationSec: number;
  hrZone?: 1 | 2 | 3 | 4 | 5;
}): SessionContract {
  const { sport, name, rationale, slot, durationSec, hrZone } = opts;
  return {
    sport,
    name,
    rationale,
    contract: {
      version: 1,
      sport,
      name,
      slot,
      source: "onboarding_preview",
      steps: [
        {
          type: "work",
          label: name,
          duration_sec: durationSec,
          target_hr_zone: hrZone,
        },
      ],
    },
  };
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

    let am_session: SessionContract | null = null;
    let pm_session: SessionContract | null = null;
    let isRest = false;

    if (allDay) {
      if (longRunWeekend) {
        pm_session = makeSession({ sport: "run", name: "Long run", rationale: "Weekly aerobic anchor; use weekend availability", slot: "full", durationSec: 5400, hrZone: 2 });
      } else if (longRideWeekend) {
        pm_session = makeSession({ sport: "bike", name: "Long ride", rationale: "Weekly aerobic anchor; use weekend availability", slot: "full", durationSec: 7200, hrZone: 2 });
      } else if (running) {
        pm_session = makeSession({ sport: "run", name: "Easy run + accessory work", rationale: "Build aerobic base", slot: "full", durationSec: 3600, hrZone: 2 });
      }
    } else if (windows.length === 0) {
      isRest = true;
    } else {
      if (am) {
        if (i === 0 && running) {
          am_session = makeSession({ sport: "run", name: "Threshold run", rationale: "Quality run early in the week with fresh legs", slot: "am", durationSec: 2700, hrZone: 4 });
        } else if (i === 3 && swimming) {
          am_session = makeSession({ sport: "swim", name: "Swim technique", rationale: "Low-impact CNS reset", slot: "am", durationSec: 2400, hrZone: 2 });
        } else if (running && i % 2 === 0) {
          am_session = makeSession({ sport: "run", name: "Easy run", rationale: "Aerobic accumulation", slot: "am", durationSec: 2400, hrZone: 2 });
        } else if (cycling) {
          am_session = makeSession({ sport: "bike", name: "Easy bike (Zone 2)", rationale: "Aerobic accumulation", slot: "am", durationSec: 3600, hrZone: 2 });
        }
      }
      if (pm) {
        if (lifting && (i === 2 || i === 4)) {
          pm_session = makeSession({
            sport: "strength",
            name: i === 2 ? "Lower body lift" : "Upper body lift",
            rationale: i === 2 ? "Strength with recovery before weekend" : "Push/pull strength",
            slot: "pm",
            durationSec: 3600,
            hrZone: 3,
          });
        } else if (running && i === 5) {
          pm_session = makeSession({ sport: "run", name: "Easy run", rationale: "Set up Sunday long", slot: "pm", durationSec: 2400, hrZone: 2 });
        }
      }
    }

    if (!am_session && !pm_session && !isRest) {
      isRest = true;
    }

    return {
      day_label: day,
      am_session,
      pm_session,
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
