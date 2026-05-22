# Plan-quality evals

End-to-end evaluation of the AI coach's multi-week plan generator. Each scenario describes a realistic athlete; the eval generates a plan for that athlete, then asks an LLM judge to score it against a 5-criterion rubric.

## Why this exists

Without evals, every prompt tweak is guesswork — you can't tell if a change made plans better, worse, or the same. This harness gives every change a measurable delta.

## What it covers

The eight scenarios in `scenarios/` are chosen to expose the failure modes that matter most for plan quality:

| ID | Scenario | What it tests |
| -- | -- | -- |
| 01 | Marathon athlete, mid-build (14 wk out) | Long-run progression, MP work, deload cadence |
| 02 | 70.3 athlete, 2 wk out | Taper logic — volume cut, intensity preserved |
| 03 | Hypertrophy lifter, 6 days | Volume landmarks, frequency 2x/muscle, no cardio bleed |
| 04 | Hybrid 10K + hypertrophy | Concurrent training, sequencing, lift/run interference |
| 05 | Beginner runner, first 5K | Conservative progression, ≥80% easy, no VO2max |
| 06 | Patellar tendinopathy | Hard constraint adherence — zero running, no squats |
| 07 | Overreaching markers | Recognize low HRV / poor sleep → deload, not progress |
| 08 | Masters athlete cutting | 2:1 loading, preserved strength, reduced volume |

Add more scenarios by dropping a JSON file into `scenarios/` that matches `Scenario` in `src/types.ts`. The runner picks them up automatically.

## How to run

```bash
npm install                  # one-time, picks up tsx
ANTHROPIC_API_KEY=sk-... npm run evals
```

Run a single scenario:

```bash
npm run evals -- 03-hypertrophy-ppl
```

Run a subset:

```bash
npm run evals -- 01-marathon-build 02-70_3-taper
```

## What it costs

Per run: one Claude call per scenario (planner, Sonnet 4.6) + one Claude call per scenario (judge, Opus 4.7). With 8 scenarios that's ~16 calls. Rough cost: $1-3 per full run depending on plan size. Cheap enough to run on every meaningful prompt change.

## Concurrency & rate limits

Scenarios run **1 at a time by default** (sequential). This is deliberate: tier-1 Anthropic orgs cap Sonnet at 8,000 output tokens/min, and a single multi-week plan can consume most of that minute's budget. Anything above 1 breaches the rolling window, and the SDK's built-in retry only backs off ~6s — far short of the 60s reset (you'll see `429 ... output tokens per minute` errors).

The runner also wraps each scenario in a slow retry: on a rate-limit error it waits ~65s for the window to reset and tries again (up to 3 times), so even sequential back-to-back plans recover automatically.

A full sequential run of 8 scenarios takes ~15-25 min. If your org is on a higher tier, parallelize:

```bash
EVAL_CONCURRENCY=3 npm run evals
```

## Reading the output

```
Per-scenario breakdown:
  ID                                  Const Period Intens Specif Scenar  Avg  Flag
  ──────────────────────────────────  ───── ────── ────── ────── ──────  ───  ────
  01-marathon-build                   5     4      4      5      4       4.40
  06-knee-injury                      2     3      4      4      1       2.80  BLOCK
```

Five criteria, each 1-5:
- **Constraint adherence** — days/week, lifting_days, athlete facts, injuries, race date
- **Periodization** — phase appropriateness, deload cadence, 10% progression rule, taper timing
- **Intensity distribution** — polarized 80/20, hard/easy alternation, no stacking quality
- **Specificity** — concrete sets×reps×RPE or distance×pace×HR-zone (not generic labels)
- **Scenario fit** — every `must_have` addressed, every `must_not_have` avoided

`BLOCK` = hard constraint violated (wrong day count, injury pattern loaded, etc.). Treat blockers as bugs, not just low scores.

Full JSON results land in `results/<timestamp>.json` and `results/latest.json`. Use `jq` to drill into individual verdicts:

```bash
jq '.scenarios[] | select(.scenario_id == "01-marathon-build") | .verdict' evals/results/latest.json
```

## What this does NOT test

- The chat coach (system-prompt.ts) — that's a streaming/tool-use system and needs a separate harness with conversation transcripts.
- Tool-call correctness (swap, modify, batch). Add a separate eval if you change those.
- Real-world adherence — the rubric judges plan *quality* on paper. Whether athletes actually follow the plan is downstream.

## Adding scenarios

Use this as a template:

```json
{
  "id": "09-short-id",
  "name": "One-line human-readable name",
  "description": "1-2 sentences setting up the athlete's situation.",
  "profile": { "age": 30, "height": 178, "weight": 170, "sex": "male", "training_experience": "intermediate" },
  "goals": {
    "body_goal": "maintain",
    "emphasis": "endurance",
    "days_per_week": 5,
    "lifting_days": 2,
    "training_for_race": true,
    "race_type": "10k",
    "race_date": "2026-09-01",
    "goal_time": "45:00",
    "does_cardio": true,
    "cardio_types": ["run"]
  },
  "recentActivity": {
    "avgRunPaceMinKm": 5.2, "avgRunDistanceKm": 10, "avgRunHr": 155,
    "weeklyRunCount": 4, "weeklyLiftCount": 2, "avgLiftDurationMin": 50,
    "avgHrv": 60, "avgSleepHours": 7.5
  },
  "factsBlock": null,
  "weeks": 4,
  "must_have": ["specific testable claim", "another one"],
  "must_not_have": ["specific failure mode", "another one"]
}
```

Tip: `must_have` / `must_not_have` should be **specific and falsifiable**. "Good periodization" is useless. "One long run per week progressing from 12km to 18km" is testable.
