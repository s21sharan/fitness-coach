# Hybrid Fitness Coach — Product MVP Design Spec

**Date:** 2026-04-25
**Status:** Approved
**Author:** Sharan + Claude

---

## 1. Overview

A web-based AI fitness coaching platform that connects users' existing fitness data sources (MacroFactor, Hevy, Strava, Garmin) into a unified intelligence layer. The app generates a personalized training split, auto-adjusts it weekly based on progress and recovery, and provides a 24/7 AI chatbot coach for food recommendations, accessory suggestions, and training guidance.

**Target user:** Serious fitness enthusiasts — anyone tracking macros and/or workouts who wants AI-powered coaching. This includes pure lifters, runners, hybrid athletes, and people training for races.

**Core value proposition:** The app doesn't replace your logging tools. It sits on top of them, sees everything, and coaches you.

**Monetization:** Free for MVP. Validate first, monetize later.

---

## 2. MVP Feature Set

### In Scope (v1)

1. User auth (Clerk)
2. Smart onboarding flow that determines goals, training split, and schedule
3. Connect MacroFactor, Hevy, Strava, Garmin accounts
4. Dashboard showing unified fitness data (nutrition, workouts, cardio, recovery)
5. AI-generated training split that auto-adjusts based on progress/recovery/goals
6. AI chatbot coach (Claude) that sees all user data and gives recommendations
7. Google Calendar integration (suggest schedule, user approves, sync to calendar)
8. Food and accessory exercise recommendations via the chatbot

### Out of Scope (post-MVP)

- DEXA scan import
- Bloodwork import + supplement recommendations
- HealthKit / Apple Watch integration
- Oura Ring integration
- Whoop integration
- Fine-tuned model for 24/7 chatbot
- Influencer videos / marketing content
- Mobile app (React Native rebuild)

---

## 3. System Architecture

```
+--------------------------------------------------+
|                    Frontend                       |
|               Next.js (Vercel)                    |
|   App Router + Server Actions + Vercel AI SDK     |
|            Auth: Clerk middleware                  |
+------------------------+-------------------------+
                         |
                         v
+--------------------------------------------------+
|                Backend API                        |
|           Express/Fastify (Railway)               |
|                                                   |
|   +-----------+  +-----------+  +-------------+   |
|   | AI Agent  |  |Integration|  | Plan Engine |   |
|   | (Claude)  |  |  Manager  |  | (split +    |   |
|   |           |  |           |  |  auto-adjust)|  |
|   +-----------+  +-----------+  +-------------+   |
|                                                   |
|   +-----------+  +-----------+  +-------------+   |
|   |   Sync    |  | Calendar  |  | Background  |   |
|   |  Workers  |  |  Service  |  | Jobs (cron) |   |
|   +-----------+  +-----------+  +-------------+   |
+------------------------+-------------------------+
                         |
                         v
+--------------------------------------------------+
|                  Data Layer                       |
|            Supabase (PostgreSQL)                  |
|      + Row Level Security + Realtime             |
+------------------------+-------------------------+
                         |
          +---------+----+------+-----------+
          v         v          v            v
     MacroFactor   Hevy     Strava      Garmin
     (MCP SDK)   (REST)   (OAuth)    (unofficial)
```

### Key Architectural Decisions

- **Separate backend on Railway:** Needed for long-running AI agent calls, OAuth token management, periodic data syncing (cron jobs), and the training plan engine. Next.js server actions can't handle these reliably.
- **Supabase over raw PostgreSQL:** Provides auth fallback, realtime subscriptions (for chat streaming), storage (for future DEXA uploads), and RLS for multi-user security out of the box.
- **Vercel AI SDK on frontend:** Handles chat UI streaming. Actual Claude calls go through the backend so the agent has access to all integration data.
- **Sync workers:** Periodic background jobs that pull latest data from each integration and normalize it into the database. The AI agent queries the DB, not the APIs directly (except for real-time requests).

### Tech Stack Summary

| Layer | Technology | Hosting |
|-------|-----------|---------|
| Frontend | Next.js (App Router) | Vercel |
| Auth | Clerk | Clerk Cloud |
| Backend API | Express or Fastify | Railway |
| Database | PostgreSQL | Supabase |
| AI | Claude API via Vercel AI SDK | Anthropic |
| Garmin microservice | Python (FastAPI) | Railway |
| Cron/jobs | Railway cron or BullMQ | Railway |

---

## 4. Data Model

### Core Entities

```sql
-- User identity (Clerk handles auth, this stores fitness profile)
User
  id                  -- Clerk user ID
  email
  created_at
  onboarding_completed

UserProfile
  user_id (FK)
  height
  weight
  age
  sex
  activity_level
  training_experience -- enum: beginner, intermediate, advanced
  timezone

UserGoals
  user_id (FK)
  body_goal           -- enum: gain_muscle, lose_weight, maintain, other
  body_goal_other     -- free text (if "other")
  emphasis            -- enum: shoulders, chest, back, arms, legs, glutes, none
  training_for_race   -- boolean
  race_type           -- enum: 5k, 10k, half_marathon, marathon, ultra,
                      --       sprint_tri, olympic_tri, half_ironman, ironman, other
  race_type_other     -- free text (if "other")
  race_date           -- date (optional)
  goal_time           -- string (optional, e.g. "sub 4:00")
  does_cardio         -- boolean (if not training for race)
  cardio_types        -- text[] (running, cycling, swimming)
  days_per_week       -- integer (3-7)
  lifting_days        -- integer

-- OAuth tokens and integration state
Integrations
  user_id (FK)
  provider            -- enum: macrofactor, hevy, strava, garmin, google_calendar
  access_token        -- encrypted
  refresh_token       -- encrypted
  provider_user_id
  last_synced_at
  status              -- enum: active, expired, error

-- Synced from MacroFactor
NutritionLog
  user_id, date
  calories, protein, carbs, fat
  fiber, sugar, sodium
  meals               -- JSONB (array of individual food entries)
  synced_at

-- Synced from Hevy
WorkoutLog
  user_id, date, workout_id
  name, duration_minutes
  exercises            -- JSONB (sets, reps, weight, RPE)
  synced_at

-- Synced from Strava
CardioLog
  user_id, date, activity_id
  type                 -- enum: run, bike, swim, other
  distance, duration, avg_hr, calories
  pace_or_speed, elevation
  synced_at

-- Synced from Garmin
RecoveryLog
  user_id, date
  resting_hr, hrv, sleep_hours, sleep_score
  body_battery, stress_level
  steps
  synced_at

-- The user's active training split
TrainingPlan
  user_id
  split_type           -- enum: full_body, upper_lower, ppl, arnold, phul,
                       --       bro_split, hybrid_upper_lower, hybrid_nick_bare
  body_goal
  race_type            -- nullable
  status               -- enum: active, paused, completed
  plan_config          -- JSONB (periodization settings, split details)
  last_adjusted_at
  created_at

-- Individual days in the plan
PlannedWorkout
  plan_id (FK)
  date
  day_of_week
  session_type         -- string: "Push", "Pull", "Legs", "Upper Body",
                       --         "Chest + Back", "Shoulders + Arms",
                       --         "Easy Run (Zone 2)", "Long Run",
                       --         "Intervals", "Rest", etc.
  ai_notes             -- text (optional: "keep it light, HRV was low")
  status               -- enum: scheduled, completed, skipped, moved
  calendar_event_id    -- Google Calendar event ID
  approved             -- boolean
  synced_at

-- Chat
ChatConversation
  user_id
  title
  created_at

ChatMessage
  conversation_id (FK)
  role                 -- enum: user, assistant
  content
  tool_calls           -- JSONB (what data the AI accessed)
  created_at

-- Weekly auto-adjustment records
WeeklyCheckIn
  user_id
  week_start_date
  weight_trend
  avg_calories
  training_volume
  training_compliance  -- percentage of planned sessions completed
  ai_summary           -- text (Claude's weekly analysis)
  plan_adjustments     -- JSONB (what changed and why)
  user_approved        -- boolean
  created_at
```

### Key Data Decisions

- **JSONB for flexible data:** Workout exercises, meal breakdowns, and plan configs vary too much for rigid schemas. JSONB keeps the model simple while still being queryable.
- **Synced data is denormalized:** We store a copy of data from each provider rather than querying live. The app works even when APIs are down, and the AI queries everything from one place.
- **WeeklyCheckIn as audit trail:** Records why the plan changed, what data drove the decision, and whether the user approved.
- **PlannedWorkout.session_type is a simple string:** "Push Day", "Legs", "Easy Run (Zone 2)" — not exercise-level detail.

---

## 5. Integration Layer

### MacroFactor (Nutrition)

- **Method:** `@sjawhar/macrofactor-mcp` package — use the underlying API client programmatically
- **Auth:** Username/password stored encrypted, Firebase token handled by the library
- **Sync:** Cron job every 6 hours — pulls food log, nutrition summaries, weight entries
- **Data:** Daily calories/macros, individual food entries, weight log

### Hevy (Strength Training)

- **Method:** Official REST API v1
- **Auth:** API key (user generates from Hevy app, requires Pro subscription)
- **Sync:** Cron job every 6 hours
- **Data:** Workout history, exercises, sets/reps/weight, PRs
- **Note:** Hevy Pro required — must communicate this clearly to users during onboarding

### Strava (Cardio)

- **Method:** Official OAuth 2.0 API
- **Auth:** OAuth flow — user clicks "Connect Strava", redirect, store tokens
- **Sync:** Webhooks (Strava pushes new activities) + daily cron as fallback
- **Data:** Activities (run/bike/swim), distance, duration, heart rate, pace
- **Rate limit:** 200 requests per 15 minutes — webhooks help stay under this

### Garmin (Recovery / Wearable)

- **Method:** Unofficial Python libraries (`garminconnect` + `garth`)
- **Auth:** Username/password, session tokens
- **Sync:** Cron job every 12 hours (conservative to avoid rate limiting)
- **Data:** Resting HR, HRV, sleep, body battery, stress, steps
- **Risk:** Unofficial API, can break. Needs error handling and user notification if sync fails.
- **Implementation:** Small Python FastAPI microservice on Railway that the Node backend calls.

### Google Calendar

- **Method:** Official Google Calendar API
- **Auth:** OAuth 2.0
- **Read:** Pull user's events to determine availability windows
- **Write:** Create workout events after user approves the suggested schedule
- **Sync:** On-demand when generating or adjusting the weekly plan

### Sync Architecture

```
+------------------------------------------+
|         Sync Scheduler (cron)            |
|                                          |
|  Every 6h:  MacroFactor, Hevy            |
|  Every 12h: Garmin                       |
|  Webhook:   Strava (real-time)           |
|  On-demand: Google Calendar              |
+------------------+-----------------------+
                   |
                   v
+------------------------------------------+
|        Integration Manager               |
|                                          |
|  - Fetches raw data from each provider   |
|  - Normalizes into unified schema        |
|  - Handles token refresh                 |
|  - Retries on failure                    |
|  - Updates last_synced_at               |
|  - Logs sync errors per user/provider    |
+------------------+-----------------------+
                   |
                   v
           Supabase (PostgreSQL)
```

### Key Integration Decisions

- **Garmin as a Python microservice:** The only reliable Garmin libraries are Python. A small FastAPI service with one job: authenticate and return Garmin data as JSON.
- **Webhooks for Strava, cron for everything else:** Strava has good webhook support. The others don't, so we poll on reasonable intervals.
- **Token refresh handled centrally:** The Integration Manager checks token expiry before each sync and refreshes automatically. If refresh fails, marks integration as `error` and notifies the user in the dashboard.

---

## 6. Onboarding Flow

### Step-by-Step

```
Step 1: Profile
  -> Height, weight, age, sex

Step 2: Body Goal (pick one)
  -> Gain muscle
  -> Lose weight
  -> Maintain / recomp
  -> Other (free text -> AI interprets)

Step 3: Body Emphasis (if gain muscle or maintain)
  -> Any areas you want to emphasize?
     Shoulders / Chest / Back / Arms / Legs / Glutes / None (balanced)

Step 4: Are you training for a race? (yes / no)

Step 5a: (if yes to race)
  -> Race type:
       Running:   5K / 10K / Half Marathon / Marathon / Ultra
       Triathlon: Sprint Triathlon / Olympic Triathlon /
                  Half Ironman (70.3) / Ironman (140.6)
       Other:     (free text)
  -> Race date (optional)
  -> Do you have a goal time? (yes -> input / no)

Step 5b: (if no to race)
  -> Do you do any cardio? (yes / no)
  -> If yes: what type? (running / cycling / swimming / multiple)

Step 6: Training Experience
  -> Beginner (< 1 year consistent lifting)
  -> Intermediate (1-3 years)
  -> Advanced (3+ years)

Step 7: Availability
  -> How many days per week can you train? (3 / 4 / 5 / 6 / 7)
  -> How many of those for lifting? (auto-suggests based on answers)

Step 8: Connect Integrations (at least one required)
  -> MacroFactor, Hevy, Strava, Garmin, Google Calendar

Step 9: Your Split (AI-generated)
  -> Shows recommended weekly split with reasoning
  -> User approves or chats with AI to adjust
```

### Goals Are Independent

Body goal and race training are two separate axes. A user can be training for an Ironman AND wanting to gain muscle. The AI accounts for both.

```
                        No Race              Training for Race
                   +------------------+----------------------------+
Gain Muscle        | Pure lifting     | Hybrid: lift + race        |
                   | split            | prep, surplus calories     |
                   +------------------+----------------------------+
Lose Weight        | Lifting split    | Hybrid: lift + race        |
                   | + optional       | prep, calorie deficit      |
                   | cardio           |                            |
                   +------------------+----------------------------+
Maintain / Recomp  | Lifting split    | Hybrid: lift + race        |
                   | at maintenance   | prep, maintenance cals     |
                   +------------------+----------------------------+
```

---

## 7. Training Split Selection

### Available Splits

| Split | Days | Best For | Extra Emphasis |
|-------|------|----------|----------------|
| Full Body | 3 | Beginners, limited schedule | Balanced, high frequency per muscle |
| Upper / Lower | 4 | Intermediates, balanced schedule | Balanced, 2x frequency |
| PPL (Push/Pull/Legs) | 3 or 6 | General muscle growth, any level | Balanced across push/pull/legs |
| Arnold (Chest+Back / Shoulders+Arms / Legs) | 6 | Shoulder and arm emphasis | Shoulders and arms get dedicated day |
| PHUL (Power Hypertrophy Upper Lower) | 4 | Strength + size | Heavy compounds + hypertrophy accessories |
| Bro Split (one group/day) | 5-6 | Advanced, max volume on weak points | Whatever group gets its own day |
| Hybrid: Upper/Lower + Cardio | 5-6 | Race training + maintaining strength | 3 lift + 2-3 cardio |
| Hybrid: Nick Bare style (AM/PM) | 6 | Serious hybrid, high volume tolerance | Both strength and endurance daily |

### Decision Tree

```
Goal = Training for race?
  + maintain/gain strength -> Hybrid Upper/Lower + Cardio (or Nick Bare if advanced)
  + no lifting focus       -> Cardio-focused plan with 2 maintenance lift days

Goal = Gaining muscle (no race)?
  3 days available           -> Full Body
  4 days available           -> Upper/Lower (beginner/intermediate) or PHUL (advanced)
  5-6 days, no emphasis      -> PPL
  5-6 days, shoulder/arm     -> Arnold
  5-6 days, specific weak pt -> Bro Split variant

Goal = Losing weight (no race)?
  Same split logic as muscle gain (preserve muscle while cutting)
  AI adjusts volume down slightly, keeps intensity high

Goal = Maintaining (no race)?
  Minimum effective volume version of whatever split fits their schedule

Goal = Other?
  AI agent conversation to determine the right split
```

### Plan Day Labels (Not Exercise-Level)

The plan tells users what TYPE of session to do, not specific exercises:

**PPL example:**
```
Monday:    Push
Tuesday:   Pull
Wednesday: Legs
Thursday:  Rest
Friday:    Push
Saturday:  Pull
Sunday:    Rest
```

**Arnold example:**
```
Monday:    Chest + Back
Tuesday:   Shoulders + Arms
Wednesday: Legs
Thursday:  Chest + Back
Friday:    Shoulders + Arms
Saturday:  Legs
Sunday:    Rest
```

**Hybrid (Half Ironman + Gain Muscle) example:**
```
Monday:    Upper Body + Easy Run (Zone 2)
Tuesday:   Intervals / Tempo Run
Wednesday: Lower Body
Thursday:  Easy Run (Zone 2) + Swim
Friday:    Upper Body
Saturday:  Long Run / Long Ride (brick)
Sunday:    Rest
```

Users log actual exercises in Hevy and actual cardio in Strava. The app just tells them what type of session today is.

---

## 8. AI Agent & Training Plan Engine

### AI Chatbot Coach

The chatbot is a Claude-powered agent with access to the user's full fitness context. When a user sends a message, the backend:

1. Loads a system prompt with the user's profile, goals, and current plan
2. Attaches tool definitions that let Claude query the database
3. Streams the response back via Vercel AI SDK

**Tools available to the AI agent:**

```
get_nutrition(date_range)      -> calories, macros, meal breakdown
get_workouts(date_range)       -> strength sessions, exercises, volume
get_cardio(date_range)         -> runs/rides/swims, distance, pace, HR
get_recovery(date_range)       -> sleep, HRV, resting HR, body battery
get_training_plan()            -> current split, upcoming sessions
get_weight_trend(date_range)   -> weight entries + trend line
get_calendar(date_range)       -> upcoming availability windows
update_planned_workout()       -> modify a session in the plan
```

**System prompt structure:**

```
You are a fitness coach for {name}.

Profile: {age, height, weight, goals, experience, emphasis}
Current split: {split type, weekly layout}
Race: {race type, date, goal time} (if applicable)
This week so far: {quick stats: calories avg, sessions completed, sleep avg}

Guidelines:
- Give specific, actionable advice based on their actual data
- Reference specific numbers ("your HRV dropped to 28 last night")
- When recommending food, consider their macro targets and what they've eaten today
- When suggesting accessories, consider their current split and weak points
- Flag recovery concerns proactively (poor sleep, high stress, low HRV)
- For race training, adjust advice based on proximity to race date
```

**Example interactions:**
- "What should I eat for dinner?" -> checks today's macros, sees 80g protein remaining, suggests high-protein meals
- "I feel beat up, should I train today?" -> checks HRV, sleep, recent training volume, recommends rest or deload
- "Add a swim session this week" -> checks calendar availability, proposes a slot, asks for approval
- "My shoulders are lagging" -> suggests switching from PPL to Arnold split, or adding lateral raise volume

### Training Plan Engine

**Plan generation:**

1. User completes onboarding — goals, experience, emphasis, availability, race info
2. Claude generates a split recommendation using structured output:
   - Split type selection with reasoning
   - Weekly layout (which days are which session type)
   - If race: periodized cardio progression toward race date
   - Calendar-aware: considers user's Google Calendar for scheduling
3. User reviews and approves (or asks AI to adjust)
4. Plan stored as PlannedWorkout rows in the database

**Weekly auto-adjustment (WeeklyCheckIn cron):**

```
1. Gather last 7 days of data:
   - Training compliance (completed vs planned sessions)
   - Nutrition compliance (actual vs targets)
   - Recovery trends (HRV, sleep, resting HR)
   - Performance trends (PRs, pace improvements, volume)
   - Weight trend vs goal
   - Race proximity (if applicable)

2. Send to Claude with structured output:
   - Assessment: what went well, what didn't
   - Adjustments: what to change next week and why
   - Risk flags: overtraining, undereating, poor recovery

3. Apply adjustments:
   - Modify upcoming PlannedWorkouts
   - Update plan_config if needed (e.g. extend deload, shift race taper)
   - Store the analysis in WeeklyCheckIn table

4. Notify user:
   - "Your plan was adjusted - tap to review"
   - User can approve, modify, or reject changes
```

**Adjustment examples:**
- Missed 2 of 4 sessions -> reduce frequency next week, keep intensity
- HRV trending down + poor sleep -> insert extra rest day, reduce volume 20%
- Hit all lifts + weight trending toward goal -> progress as planned
- 4 weeks out from race -> begin taper, reduce lifting volume, sharpen cardio
- User asked to emphasize shoulders -> suggest switching from PPL to Arnold

### Key AI Decisions

- **Claude generates plans, not a rules engine:** Periodization has too many variables for rigid rules. Claude with good context and structured output handles the nuance.
- **Weekly adjustment cadence:** Daily is too noisy, biweekly is too slow. Weekly matches how most training programs work.
- **User approves all adjustments:** The AI suggests, the user decides. No silent changes.
- **Split-level, not exercise-level:** The plan says "Push Day", not "Bench 4x8". Users choose their own exercises in Hevy.

---

## 9. Google Calendar Integration

### Flow

```
1. User connects Google Calendar during onboarding (OAuth)
2. When generating/adjusting the weekly plan:
   a. Read user's calendar for the upcoming week
   b. Identify available time slots
   c. Map planned sessions to available slots
   d. Present the schedule: "Push Day - Monday 6:00 AM"
3. User reviews and approves
4. Approved sessions are created as Google Calendar events
5. If user reschedules in Google Calendar, next sync picks up the change
```

### Calendar Event Format

```
Title:       "[App Name] Push Day"
Description: "AI-suggested session. Log your workout in Hevy."
Duration:    60-90 min (configurable)
```

---

## 10. Frontend Pages

### 1. Landing Page
- Value proposition, feature overview, sign-up CTA
- No auth required

### 2. Onboarding (9 steps — see Section 6)
- Progressive disclosure — only show relevant steps based on previous answers
- At least one integration required to proceed
- Ends with AI-generated split recommendation

### 3. Dashboard (Home)
- **Today card:** Session type for today ("Push Day" / "Rest Day" / "Long Run") with optional AI note ("keep it light, HRV was low")
- **This week:** 7-day strip showing each day's session type + status (scheduled / completed / skipped) — synced from Hevy and Strava
- **Quick stats:** Calories today vs target, weight trend sparkline, sleep/HRV snapshot from Garmin
- **Sync status:** Last synced time per integration, error indicators
- **Quick actions:** "Chat with coach", "View plan", "Check in"

### 4. My Plan
- Weekly view showing the split laid out across the week
- Tap a day to see session type + any AI notes
- Calendar overlay showing Google Calendar events alongside planned sessions
- Status per session: scheduled / completed / skipped (auto-detected from Hevy/Strava sync)
- "Suggest changes" button triggers AI re-evaluation
- Pending suggestions banner when weekly check-in has proposed changes

### 5. Chat (Coach)
- Persistent chat interface
- Multiple conversations, saved history
- AI has full context of all synced data via tools
- Suggested prompts: "What should I eat for dinner?", "How's my recovery?", "Swap today's session", "Change my split"
- This is where users get food recommendations, accessory suggestions, split changes, and detailed guidance

### 6. Weekly Review
- AI-generated summary of the week
- Compliance: planned vs completed sessions
- Nutrition: average calories/macros vs targets
- Recovery trends: sleep, HRV, resting HR
- Performance highlights (PRs, pace improvements)
- Plan adjustments with reasoning -> approve / reject / modify
- Historical check-ins for trend tracking

### 7. Settings
- Profile editing
- Integration management (connect / disconnect / re-auth)
- Goal editing (triggers plan re-evaluation)
- Notification preferences
- Account management

### Key Frontend Decisions

- **No data entry in the app:** Users log in MacroFactor, Hevy, Strava. The app only displays and analyzes.
- **Dashboard is glanceable:** One screen, today's session, quick stats. The chat is where deep interaction happens.
- **Weekly review is a first-class page:** This is where the auto-adjustment value lives. Not buried in the chat.
- **Plan is split-level:** "Push Day" not "Bench 4x8, OHP 3x10..."

---

## 11. Error Handling & Edge Cases

### Integration Failures
- If a sync fails, mark integration as `error`, show in dashboard
- AI coach continues working with available data, notes which sources are stale
- User gets a notification: "Garmin sync failed — reconnect in settings"

### No Data Yet
- New users with freshly connected integrations: AI generates plan from onboarding data alone
- First sync backfills historical data (past 30 days where APIs allow)
- Dashboard shows "waiting for first sync" state

### Conflicting Goals
- User wants to gain muscle AND train for Ironman: AI flags this is challenging, sets realistic expectations in the plan reasoning, suggests caloric surplus with high training volume
- User has 3 days available but wants Arnold split (needs 6): AI recommends Full Body or Upper/Lower instead, explains why

### Stale Data
- If a user hasn't logged in Hevy for 5+ days, AI notes low compliance in weekly check-in
- If weight data is missing for 7+ days, AI can't assess weight trend — flags this to the user

---

## 12. Future Roadmap (Post-MVP)

In priority order:

1. **DEXA scan import** — upload scan results, AI tracks body composition changes over time
2. **Bloodwork import** — input lab results, AI provides supplement recommendations based on deficiencies
3. **HealthKit / Apple Watch** — passive sync of steps, HR, workouts
4. **Oura Ring** — sleep and readiness scores for better recovery tracking
5. **Whoop** — strain and recovery scores
6. **Fine-tuned model** — custom model trained on fitness coaching data for better recommendations
7. **Influencer content** — video library, marketing partnerships
8. **Mobile app** — React Native rebuild for iOS and Android

---

## 13. References

### Training Split Research

- [The BEST Workout Split to Build Muscle (Built With Science)](https://builtwithscience.com/fitness-tips/best-workout-split-2025/)
- [Arnold Split: Full 6-Day Workout Plan (Endomondo)](https://www.endomondo.com/workouts/arnold-split)
- [Arnold Split vs PPL (Fitness Drum)](https://fitnessdrum.com/arnold-split-vs-ppl/)
- [Upper Lower vs PPL (Boostcamp)](https://www.boostcamp.app/blogs/upper-lower-split-vs-push-pull-legs-routine)
- [The 6 Best Workout Splits (StrengthLog)](https://www.strengthlog.com/best-workout-splits/)
- [Workout Splits Explained (Hevy)](https://www.hevyapp.com/workout-splits/)
- [Best Workout Splits for Every Goal (Gymshark)](https://row.gymshark.com/blog/article/the-best-workout-splits-for-every-goal)

### Hybrid Athlete Training

- [Nick Bare: Training for Hybrid Athletes](https://www.nickbare.com/training/)
- [Nick Bare's Complete Hybrid Training Program (Generation Iron)](https://generationiron.com/nick-bare-hybrid-training-program/)
- [Fergus Crawley's Concurrent Training (TrainingPeaks)](https://www.trainingpeaks.com/coach-blog/hybrid-athlete-fergus-crawley-concurrent-training/)
- [12 Week Hybrid Athlete Training Program (Set For Set)](https://www.setforset.com/blogs/news/hybrid-athlete-training-program)
- [What is a Hybrid Athlete (Bare Performance Nutrition)](https://www.bareperformancenutrition.com/blogs/content/what-is-a-hybrid-athlete-the-full-guide-to-strength-and-endurance)

### Integration APIs

- MacroFactor: `@sjawhar/macrofactor-mcp` npm package (Firebase auth, unofficial)
- Hevy: Official API v1, API key auth, requires Pro subscription
- Strava: Official OAuth 2.0 API, webhooks, rate-limited (200/15min)
- Garmin: No public API, `garminconnect` + `garth` Python libraries (unofficial)
- Google Calendar: Official Google Calendar API, OAuth 2.0
