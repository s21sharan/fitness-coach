# Phase 5: AI Chat Coach — Design Spec

## Goal

Build a 24/7 AI fitness coach powered by Claude that can answer questions about the user's nutrition, training, cardio, and recovery data, provide actionable coaching advice, and modify the training plan on request. The coach has a distinct personality — direct, data-driven, encouraging, and opinionated.

## Architecture

1. **Chat API** — Next.js route handler at `/api/chat` using Vercel AI SDK's `streamText`. Loads fresh user context into the system prompt on every request, attaches 7 tools for querying Supabase and modifying the plan.
2. **Chat UI** — Full-page chat at `/dashboard/chat` with message list, input bar, suggested prompts, and tool call indicators. Plus a floating launcher button on other dashboard pages that opens a slide-over chat panel.
3. **Chat Persistence** — Messages stored in existing `chat_conversations` and `chat_messages` tables. Single conversation per user for V1.

## Coach Personality

The AI coach is called **Coach**. The personality is built into the system prompt:

- **Direct and specific** — References actual data points. "Your HRV dropped to 38 and sleep was 5.9h — take a rest day" not "Make sure you're recovering well."
- **Encouraging but honest** — Celebrates wins with real numbers ("tempo pace down to 4:47/km, 8-second improvement") but doesn't sugarcoat ("you've missed 3 of 6 sessions this week").
- **Opinionated** — Has strong recommendations backed by data. Picks a side and explains why.
- **Concise** — Short, punchy responses. Uses bullet points for action items. No walls of text.
- **Context-aware** — Knows today's date, what session is planned, recovery status, what the user ate.

### System Prompt Structure

The system prompt is rebuilt on every request with fresh data:

```
You are Coach, a fitness coach for {name}.

Profile: {age}, {height}, {weight}, {sex}, {experience}
Goal: {body_goal}
Emphasis: {emphasis}
Current split: {split_type} — {weekly layout summary}
{Race: {race_type}, {date}, {goal_time}, {weeks_out} weeks out — {phase} phase}

Today: {date}, {day_of_week}
Today's planned session: {session_type}
Recovery: HRV {hrv}, Sleep {sleep_hours}h, RHR {resting_hr}, Body Battery {body_battery}
This week so far: {sessions_completed}/{sessions_planned} sessions, avg {calories} cal, {protein}g protein

Guidelines:
- Give specific, actionable advice based on their actual data
- Reference specific numbers ("your HRV dropped to 28 last night")
- When recommending food, consider their macro targets and what they've eaten today
- When suggesting training changes, consider their current split and recovery
- Flag recovery concerns proactively (poor sleep, high stress, low HRV)
- For race training, adjust advice based on proximity to race date
- Be concise — use bullet points, not paragraphs
- You can use tools to look up data you don't have in this context
- When modifying the plan, explain what you're changing and why
- Use emoji sparingly — you're a coach, not a chatbot
```

The dynamic fields are populated from Supabase on each request: user_profiles, user_goals, training_plans, planned_workouts (today), recovery_logs (today), nutrition_logs (today).

## Tools

Seven tools defined as Zod schemas, passed to `streamText`:

### Read Tools

**`get_nutrition`**
- Parameters: `{ start_date: string, end_date: string }`
- Queries: `nutrition_logs` for date range
- Returns: Array of `{ date, calories, protein, carbs, fat, fiber }`

**`get_workouts`**
- Parameters: `{ start_date: string, end_date: string }`
- Queries: `workout_logs` for date range
- Returns: Array of `{ date, name, duration_minutes, exercises: [{ name, sets: [{ weight_kg, reps, rpe }] }] }`

**`get_cardio`**
- Parameters: `{ start_date: string, end_date: string }`
- Queries: `cardio_logs` for date range
- Returns: Array of `{ date, type, distance, duration, avg_hr, pace_or_speed, calories, elevation }`

**`get_recovery`**
- Parameters: `{ start_date: string, end_date: string }`
- Queries: `recovery_logs` for date range
- Returns: Array of `{ date, hrv, sleep_hours, sleep_score, resting_hr, body_battery, stress_level, steps }`

**`get_weight_trend`**
- Parameters: `{ start_date: string, end_date: string }`
- Queries: `nutrition_logs` for weight field (MacroFactor stores weight in nutrition data)
- Returns: `{ entries: [{ date, weight_kg }], direction: "up" | "down" | "stable" }`
- Note: If weight isn't in nutrition_logs, fall back to user_profiles.weight as a single data point

**`get_training_plan`**
- Parameters: none
- Queries: `training_plans` (active) + `planned_workouts` (current and next week)
- Returns: `{ split_type, body_goal, race_type, plan_config, this_week: [...], next_week: [...] }`

### Write Tool

**`update_planned_workout`**
- Parameters: `{ date: string, session_type?: string, ai_notes?: string, status?: "scheduled" | "moved" }`
- Updates: `planned_workouts` row for the given date in the active plan
- Returns: `{ success: boolean, updated: { date, session_type, ai_notes } }`
- Used for: swapping sessions, adding rest days, annotating upcoming workouts

## Chat API

### Route: `POST /api/chat`

Request body:
```typescript
{
  messages: Array<{ role: "user" | "assistant", content: string }>
}
```

The route handler:
1. Authenticates via Clerk `auth()`
2. Gets or creates the user's single conversation (`chat_conversations`)
3. Saves the new user message to `chat_messages`
4. Loads fresh context from Supabase for the system prompt:
   - `user_profiles` — age, height, weight, sex, experience
   - `user_goals` — body_goal, emphasis, race info, availability
   - `training_plans` (active) — split_type, plan_config
   - `planned_workouts` (today) — today's session
   - `recovery_logs` (today) — HRV, sleep, RHR
   - `nutrition_logs` (today) — calories, protein so far
5. Builds the system prompt with fresh context
6. Fetches last 20 messages from `chat_messages` for conversation history
7. Calls `streamText` with:
   - `model: anthropic("claude-sonnet-4-20250514")`
   - `system: dynamicSystemPrompt`
   - `messages: conversationHistory`
   - `tools: { get_nutrition, get_workouts, get_cardio, get_recovery, get_weight_trend, get_training_plan, update_planned_workout }`
   - `maxSteps: 5` (allows multi-tool chains)
8. Saves the assistant response + tool_calls to `chat_messages`
9. Returns the AI SDK stream response

### Route: `GET /api/chat/messages`

Returns the last 50 messages for the user's conversation. Used on page load.

## Chat UI

### Full-Page: `/dashboard/chat`

**Layout:**
- Suggested prompts bar at top (4 quick actions)
- Scrollable message list
- Fixed input bar at bottom with text input + send button

**Message types:**
- **User messages** — Dark bubble, right-aligned
- **Coach messages** — White bubble with border, left-aligned, purple "C" avatar
- **Tool call pills** — Small gray pills between messages showing which tools were called (e.g., "📊 get_recovery", "📋 get_training_plan"). Green pill for write operations.
- **Streaming** — Coach messages stream in word by word via AI SDK's `useChat` hook

**Suggested prompts:**
- "What should I eat for dinner?"
- "How's my recovery?"
- "Should I train today?"
- "Swap today's session"

These are pre-filled into the input and sent on click.

### Floating Launcher

On all `/dashboard/*` pages except `/dashboard/chat`:

- **Closed state:** Purple gradient FAB (floating action button) in bottom-right corner with "C" icon
- **Open state:** Slide-over panel from right edge (320px wide), compact version of the chat with smaller messages, same conversation
- **"Open full →"** link in panel header navigates to `/dashboard/chat`
- Panel state (open/closed) persisted in localStorage

### Client-Side

Uses Vercel AI SDK's `useChat` hook:
```typescript
const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
  api: "/api/chat",
});
```

The hook handles streaming, message state, and the request/response cycle. Messages from the API include tool call metadata rendered as pills.

## Database

### Existing Tables (Phase 1)

**`chat_conversations`:**
- `id` uuid PK
- `user_id` text FK → users
- `title` text (nullable — auto-generated from first message)
- `created_at` timestamptz

**`chat_messages`:**
- `id` uuid PK
- `conversation_id` uuid FK → chat_conversations
- `role` text ("user" | "assistant")
- `content` text
- `tool_calls` jsonb (array of tool call objects)
- `created_at` timestamptz

No new migration needed — these tables already exist with RLS policies.

## Tech Stack

- **AI:** Vercel AI SDK `streamText` + `@ai-sdk/anthropic`
- **Frontend:** `useChat` hook, React components, Tailwind
- **Database:** Supabase (existing chat tables + querying all synced data tables)
- **Auth:** Clerk

## What This Phase Does NOT Include

- Multiple conversations (V1 is single-conversation)
- Voice input/output
- Image/file attachments
- Proactive notifications ("your HRV is low today") — coach only responds when asked
- Chat in the Express backend (runs in Next.js)
