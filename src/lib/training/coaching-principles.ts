/**
 * Dense, load-bearing coaching principles injected into the plan generator
 * and the chat coach's system prompts.
 *
 * Editing rules:
 * - Every line should change a decision the model would otherwise make.
 *   If a line is true-but-generic ("rest is important"), delete it.
 * - Prefer numbers over adjectives. "≥48h between heavy-leg sessions"
 *   beats "allow adequate recovery between leg days".
 * - When two schools disagree (e.g. polarized vs pyramidal), pick one and
 *   say why — model needs a default, not a debate.
 * - Keep total length under ~250 lines. This text is included verbatim in
 *   every plan-gen and coach request; bloat is expensive.
 */
export const COACHING_PRINCIPLES = `## Coaching Principles (apply these to every plan and every recommendation)

### 1. Periodization
- Block structure: 3 loading weeks + 1 deload (volume −35-40%, intensity preserved). Use 2:1 instead of 3:1 for masters athletes (>45y) or anyone with low HRV / sleep <6.5h trend.
- Phase ordering for an endurance goal: Base → Build → Peak → Taper → Race.
  - Base (6-12 wk): aerobic volume, strength foundations, no race-specific intensity.
  - Build (4-8 wk): introduce threshold + VO2max, sport-specific intervals; volume still high.
  - Peak (2-3 wk): race-pace work, volume −10-20%, intensity highest.
  - Taper (1-3 wk): volume −40-60%, intensity preserved (short, sharp sessions). 5K/10K taper 7-10d, half-mara 10-14d, marathon/70.3 14-21d, ironman 21d.
- Phase ordering for hypertrophy: Accumulation (high volume, RPE 6-8) → Intensification (lower volume, RPE 8-9, heavier loads) → Deload → repeat. 4-6 wk per phase.
- Never increase weekly volume by >10% over the prior week (10% rule). Exception: returning from a planned deload, where prior loading-week volume is the baseline.
- A real deload cuts sets/reps/distance — NOT just intensity. "Lighter weights, same volume" is not a deload.

### 2. Endurance intensity distribution
- Default: polarized 80/20. ~80% of weekly time at Zone 1-2 (conversational, < first lactate threshold), ~20% at Zone 4-5 (threshold + VO2max). Minimize "gray zone" Zone 3 — it is fatiguing without being adaptive enough to justify the cost.
- Easy must be EASY. If the athlete cannot nasal-breathe or hold conversation, the pace is wrong. Easy run HR < 75% max HR or below first ventilatory threshold.
- Hard must be HARD. Threshold work is ~1hr race-pace effort (RPE 7-8). VO2max intervals at 3-5 min reps, work:rest ≈ 1:1, RPE 9.
- Max two quality sessions per week for most athletes. Three only for advanced athletes (>60 mpw or equivalent) with strong recovery markers. A "quality session" = anything above Zone 2.
- Long run = 20-30% of weekly volume, never >35%. Cap absolute duration at 2.5-3h for marathoners (longer runs return less and cost more recovery).

### 3. Lifting volume and intensity
- Hypertrophy volume per muscle group per week (working sets to within ~2 reps of failure):
  - Beginner: 8-12 sets. Intermediate: 12-18. Advanced: 16-22. Above ~22 is rarely productive without elite recovery.
  - Distribute across ≥2 sessions/week per muscle (frequency 2 beats frequency 1 at equal volume).
- Strength (low-rep, heavy): 3-6 reps per set, RPE 7-9, 2-5 min rest. Use 1-3 main compound lifts per session, then accessories.
- RIR/RPE targets by phase:
  - Accumulation: RPE 6-8 (RIR 2-4). Bias toward more sets at lower RIR.
  - Intensification: RPE 8-9 (RIR 1-2). Bias toward heavier loads, fewer sets.
  - Peaking (powerlifting only): RPE 9-10 single/double work, sparingly.
- Compound lifts get 48-72h between heavy sessions for that pattern. Squat Mon + heavy deadlift Wed is fine; heavy squat Mon + heavy squat Wed is not.
- Progressive overload mechanisms (use ONE at a time, not all simultaneously): add reps → add a set → add load → reduce rest. When the simplest one stalls 2-3 sessions, change exercise variation before adding more complexity.

### 4. RPE & autoregulation
- RPE 10 = absolute failure, no more reps possible. RPE 9 = 1 left in the tank. RPE 8 = 2 left. Train accessories at 7-8; main lifts at 7-9 depending on phase.
- "RPE creep" within a session: if RPE jumps >2 between like-for-like sets (e.g. set 1 at 7, set 2 at 9 with same weight), the prescribed load is too heavy that day. Reduce, don't grind.
- Autoregulation override: if HRV is >10% below 7-day average AND sleep <6h, downshift the session by one tier (VO2max → threshold → tempo → easy → off). Never grind through both red flags.

### 5. Recovery, sequencing, interference
- Hard/easy alternation: no two consecutive hard days for the same system. Acceptable patterns: hard run / easy run / hard run / rest. Unacceptable: tempo run / threshold lift / long run.
- Concurrent training interference: when lifting and endurance happen the same day, separate by ≥6h if possible. If not, put the priority modality first. Endurance after lift > lift after endurance (lifting tax on the legs hurts the run more than the reverse).
- Heavy lower-body lift → never the day before a quality run. 48h gap is the safe default; 24h only with elite recovery.
- Two-a-days: only justified when (a) weekly volume requires it, AND (b) the athlete has time + recovery capacity. Priority session goes in the slot with more energy (usually AM for endurance, PM for lifting). Default to single-session days otherwise.
- Sleep debt is the dominant recovery variable. If average sleep is <7h, reduce planned volume by 10-15% before the athlete fails to comply.

### 6. Hybrid athlete tradeoffs
- Concurrent strength + endurance is a tradeoff, not a stack. Expect ~10-20% reduced gains in either modality vs single-focus training. This is fine — the goal is dual capability.
- When emphasis is endurance: protect the key cardio sessions (long run, intervals, threshold). Lift 2-3x/week, full-body or upper/lower, RPE 7-8, no heavy leg sessions within 48h of key runs.
- When emphasis is strength/hypertrophy: protect lifts (legs especially). Cap cardio at 2-3 short Zone 2 sessions/week (≤30 min each). Avoid HIIT during accumulation.
- When no emphasis: cap weekly hours at 8-10 for non-elite athletes. Above this, recovery debt accumulates faster than fitness gains. Watch HRV trend closely.

### 7. Sport-specific defaults
- 5K: 30-50 mpw base, then 4-6 wk of threshold (5x1km @ T-pace, 90s jog) + VO2max (5x3min @ I-pace). Long run 12-16 km. Taper 7-10 d.
- 10K: similar to 5K but +15-25% volume, more threshold (10K race pace = threshold pace for trained athletes).
- Half-marathon: 40-70 mpw, weekly long run progressing to 21-26 km, MP work (Marathon Pace) introduced in Build (e.g. 3 km warmup + 8-12 km @ MP + cooldown). Taper 10-14 d.
- Marathon: 50-90 mpw, long run 28-35 km, MP work in long runs (e.g. last 60-90 min @ MP), weekly threshold session. Taper 14-21 d.
- Triathlon (70.3): bike volume dominates (50-60% of weekly hours), run 25-30%, swim 15-20%. Brick workouts (bike→run) weekly in Build/Peak. Long ride builds to 4-5h; long run to 90-120 min.
- General hypertrophy: 4-6 sessions/week, upper/lower or PPL, each muscle 2x/week, 12-20 sets/muscle/week.

### 8. Recovery markers and gating (use BEFORE recommending today's session)
- HRV >15% below 7-day rolling average → downshift today (VO2max → threshold, threshold → easy, easy → rest).
- Sleep <6h → no quality work. Easy aerobic only, or rest.
- Resting HR >7-10 bpm above baseline for 2+ days → suspect overreaching or illness; recommend a deload week.
- Body Battery <30 → recommend rest regardless of plan.
- Two or more red flags simultaneously → unconditional rest day. Do not try to "salvage" with an easier session.

### 9. Common mistakes to actively avoid
- Generic session labels ("Upper Body", "Tempo Run"). Every session needs sets×reps×load OR distance×pace×HR-zone, plus a one-line rationale.
- Linear progression with no deloads. After 3-4 loading weeks, deload is non-negotiable.
- Stacking quality on consecutive days. Even if both fit the weekly plan, the sequencing destroys the second one.
- "More is better" in base phase. Base is volume, NOT intensity. Intensity belongs in Build/Peak.
- Tapering with reduced intensity. Taper cuts VOLUME and keeps INTENSITY (short, sharp sessions maintain neuromuscular sharpness).
- Treating planned vs actual as the same. When compliance is <70%, the plan is wrong for the athlete's life — simplify it, don't double down.
`;

/**
 * Returns the principles block prefixed with a separator so it can be
 * dropped into any larger system prompt without colliding with surrounding
 * structure.
 */
export function getPrinciplesBlock(): string {
  return `${COACHING_PRINCIPLES}\n`;
}
