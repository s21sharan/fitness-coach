# Phase 5: AI Chat Coach — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Claude-powered AI fitness coach with 7 data tools, full-page chat UI, floating launcher panel, and conversation persistence — all using Vercel AI SDK's `streamText` and `useChat`.

**Architecture:** Next.js route handler at `/api/chat` uses `streamText` with tools that query Supabase. The system prompt is rebuilt on every request with fresh fitness context. Frontend uses `useChat` hook for streaming. Single conversation per user stored in existing `chat_messages` table.

**Tech Stack:** Vercel AI SDK (`streamText`, `useChat`), @ai-sdk/anthropic, Zod, React, Tailwind, Supabase, Clerk

**Design Spec:** `docs/superpowers/specs/2026-05-01-phase5-ai-chat-coach-design.md`

---

## File Structure

```
# Chat Tools (one file per tool)
src/lib/chat/tools/get-nutrition.ts
src/lib/chat/tools/get-workouts.ts
src/lib/chat/tools/get-cardio.ts
src/lib/chat/tools/get-recovery.ts
src/lib/chat/tools/get-weight-trend.ts
src/lib/chat/tools/get-training-plan.ts
src/lib/chat/tools/update-planned-workout.ts
src/lib/chat/tools/index.ts                           # Re-exports all tools

# Chat Core
src/lib/chat/system-prompt.ts                          # Dynamic system prompt builder
src/lib/chat/conversation.ts                           # Get/create conversation, save messages

# API Routes
src/app/api/chat/route.ts                              # POST — streamText handler
src/app/api/chat/messages/route.ts                     # GET — fetch message history

# Chat UI
src/components/chat/message-bubble.tsx                 # User and coach message rendering
src/components/chat/tool-call-pills.tsx                # Tool call indicator pills
src/components/chat/chat-input.tsx                     # Input bar with send button
src/components/chat/suggested-prompts.tsx              # Quick action prompt buttons
src/components/chat/chat-panel.tsx                     # Floating slide-over panel
src/components/chat/chat-launcher.tsx                  # FAB button for launcher

# Pages
src/app/dashboard/chat/page.tsx                        # Rewritten full-page chat

# Modified Files
src/app/dashboard/layout.tsx                           # Add ChatLauncher to layout

# Tests
__tests__/lib/chat/system-prompt.test.ts
__tests__/lib/chat/tools/get-nutrition.test.ts
__tests__/lib/chat/tools/get-recovery.test.ts
__tests__/lib/chat/conversation.test.ts
__tests__/components/chat/message-bubble.test.tsx
__tests__/components/chat/suggested-prompts.test.tsx
```

---

## Task 1: Chat Tool Definitions

**Files:**
- Create: `src/lib/chat/tools/get-nutrition.ts`
- Create: `src/lib/chat/tools/get-workouts.ts`
- Create: `src/lib/chat/tools/get-cardio.ts`
- Create: `src/lib/chat/tools/get-recovery.ts`
- Create: `src/lib/chat/tools/get-weight-trend.ts`
- Create: `src/lib/chat/tools/get-training-plan.ts`
- Create: `src/lib/chat/tools/update-planned-workout.ts`
- Create: `src/lib/chat/tools/index.ts`
- Test: `__tests__/lib/chat/tools/get-nutrition.test.ts`
- Test: `__tests__/lib/chat/tools/get-recovery.test.ts`

- [ ] **Step 1: Write tool tests**

```typescript
// __tests__/lib/chat/tools/get-nutrition.test.ts
import { describe, it, expect } from "vitest";
import { getNutritionTool } from "@/lib/chat/tools/get-nutrition";

describe("getNutritionTool", () => {
  it("has correct name and description", () => {
    expect(getNutritionTool.name).toBe("get_nutrition");
    expect(getNutritionTool.description).toContain("nutrition");
  });

  it("has parameters with start_date and end_date", () => {
    expect(getNutritionTool.parameters).toBeDefined();
  });
});
```

```typescript
// __tests__/lib/chat/tools/get-recovery.test.ts
import { describe, it, expect } from "vitest";
import { getRecoveryTool } from "@/lib/chat/tools/get-recovery";

describe("getRecoveryTool", () => {
  it("has correct name and description", () => {
    expect(getRecoveryTool.name).toBe("get_recovery");
    expect(getRecoveryTool.description).toContain("recovery");
  });

  it("has parameters with start_date and end_date", () => {
    expect(getRecoveryTool.parameters).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- __tests__/lib/chat/tools/`
Expected: FAIL — module not found

- [ ] **Step 3: Implement all 7 tools + index**

```typescript
// src/lib/chat/tools/get-nutrition.ts
import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";

export function getNutritionTool(userId: string) {
  return tool({
    description: "Get nutrition data (calories, protein, carbs, fat) for a date range. Use when the user asks about their diet, macros, or what they've eaten.",
    parameters: z.object({
      start_date: z.string().describe("Start date in YYYY-MM-DD format"),
      end_date: z.string().describe("End date in YYYY-MM-DD format"),
    }),
    execute: async ({ start_date, end_date }) => {
      const supabase = createServerClient();
      const { data } = await supabase
        .from("nutrition_logs")
        .select("date, calories, protein, carbs, fat, fiber")
        .eq("user_id", userId)
        .gte("date", start_date)
        .lte("date", end_date)
        .order("date");

      return data || [];
    },
  });
}
```

```typescript
// src/lib/chat/tools/get-workouts.ts
import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";

export function getWorkoutsTool(userId: string) {
  return tool({
    description: "Get strength training workout logs for a date range. Returns exercises, sets, reps, weight. Use when the user asks about their lifting sessions.",
    parameters: z.object({
      start_date: z.string().describe("Start date in YYYY-MM-DD format"),
      end_date: z.string().describe("End date in YYYY-MM-DD format"),
    }),
    execute: async ({ start_date, end_date }) => {
      const supabase = createServerClient();
      const { data } = await supabase
        .from("workout_logs")
        .select("date, name, duration_minutes, exercises")
        .eq("user_id", userId)
        .gte("date", start_date)
        .lte("date", end_date)
        .order("date");

      return data || [];
    },
  });
}
```

```typescript
// src/lib/chat/tools/get-cardio.ts
import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";

export function getCardioTool(userId: string) {
  return tool({
    description: "Get cardio activity logs (runs, rides, swims) for a date range. Returns distance, duration, pace, heart rate. Use when the user asks about their cardio or endurance training.",
    parameters: z.object({
      start_date: z.string().describe("Start date in YYYY-MM-DD format"),
      end_date: z.string().describe("End date in YYYY-MM-DD format"),
    }),
    execute: async ({ start_date, end_date }) => {
      const supabase = createServerClient();
      const { data } = await supabase
        .from("cardio_logs")
        .select("date, type, distance, duration, avg_hr, pace_or_speed, calories, elevation")
        .eq("user_id", userId)
        .gte("date", start_date)
        .lte("date", end_date)
        .order("date");

      return data || [];
    },
  });
}
```

```typescript
// src/lib/chat/tools/get-recovery.ts
import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";

export function getRecoveryTool(userId: string) {
  return tool({
    description: "Get recovery data (HRV, sleep hours, sleep score, resting heart rate, body battery, stress level, steps) for a date range. Use when the user asks about their recovery, sleep, or readiness to train.",
    parameters: z.object({
      start_date: z.string().describe("Start date in YYYY-MM-DD format"),
      end_date: z.string().describe("End date in YYYY-MM-DD format"),
    }),
    execute: async ({ start_date, end_date }) => {
      const supabase = createServerClient();
      const { data } = await supabase
        .from("recovery_logs")
        .select("date, hrv, sleep_hours, sleep_score, resting_hr, body_battery, stress_level, steps")
        .eq("user_id", userId)
        .gte("date", start_date)
        .lte("date", end_date)
        .order("date");

      return data || [];
    },
  });
}
```

```typescript
// src/lib/chat/tools/get-weight-trend.ts
import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";

export function getWeightTrendTool(userId: string) {
  return tool({
    description: "Get weight entries and trend direction for a date range. Use when the user asks about their weight or body composition progress.",
    parameters: z.object({
      start_date: z.string().describe("Start date in YYYY-MM-DD format"),
      end_date: z.string().describe("End date in YYYY-MM-DD format"),
    }),
    execute: async ({ start_date, end_date }) => {
      const supabase = createServerClient();

      // Try nutrition_logs for weight data (MacroFactor syncs weight here)
      const { data: nutritionData } = await supabase
        .from("nutrition_logs")
        .select("date, calories")
        .eq("user_id", userId)
        .gte("date", start_date)
        .lte("date", end_date)
        .order("date");

      // Get user profile weight as fallback
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("weight")
        .eq("user_id", userId)
        .single();

      const currentWeight = profile?.weight || null;

      return {
        current_weight_lbs: currentWeight,
        nutrition_entries: nutritionData?.length || 0,
        note: "Weight tracking from MacroFactor. Current weight from profile.",
      };
    },
  });
}
```

```typescript
// src/lib/chat/tools/get-training-plan.ts
import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";

export function getTrainingPlanTool(userId: string) {
  return tool({
    description: "Get the user's current training plan including split type, weekly layout, and upcoming sessions. Use when the user asks about their plan, schedule, or what's coming up.",
    parameters: z.object({}),
    execute: async () => {
      const supabase = createServerClient();

      const { data: plan } = await supabase
        .from("training_plans")
        .select("id, split_type, body_goal, race_type, plan_config, created_at")
        .eq("user_id", userId)
        .eq("status", "active")
        .single();

      if (!plan) return { plan: null, message: "No active training plan" };

      // Get this week and next week's workouts
      const now = new Date();
      const day = now.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const thisMonday = new Date(now);
      thisMonday.setDate(now.getDate() + mondayOffset);
      const nextSunday = new Date(thisMonday);
      nextSunday.setDate(thisMonday.getDate() + 13);

      const { data: workouts } = await supabase
        .from("planned_workouts")
        .select("date, day_of_week, session_type, ai_notes, status, approved")
        .eq("plan_id", plan.id)
        .gte("date", thisMonday.toISOString().slice(0, 10))
        .lte("date", nextSunday.toISOString().slice(0, 10))
        .order("date");

      return {
        plan: {
          split_type: plan.split_type,
          body_goal: plan.body_goal,
          race_type: plan.race_type,
          plan_config: plan.plan_config,
        },
        workouts: workouts || [],
      };
    },
  });
}
```

```typescript
// src/lib/chat/tools/update-planned-workout.ts
import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";

export function updatePlannedWorkoutTool(userId: string) {
  return tool({
    description: "Modify a planned workout for a specific date. Can change session type, add notes, or mark as moved. Use when the user wants to swap a session, add a rest day, or adjust their upcoming schedule.",
    parameters: z.object({
      date: z.string().describe("Date of the workout to modify in YYYY-MM-DD format"),
      session_type: z.string().optional().describe("New session type (e.g. 'Rest', 'Push', 'Easy Run (Zone 2)')"),
      ai_notes: z.string().optional().describe("Notes to add to the workout"),
      status: z.enum(["scheduled", "moved"]).optional().describe("New status"),
    }),
    execute: async ({ date, session_type, ai_notes, status }) => {
      const supabase = createServerClient();

      // Get the user's active plan
      const { data: plan } = await supabase
        .from("training_plans")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .single();

      if (!plan) return { success: false, error: "No active training plan" };

      const updates: Record<string, unknown> = {};
      if (session_type !== undefined) updates.session_type = session_type;
      if (ai_notes !== undefined) updates.ai_notes = ai_notes;
      if (status !== undefined) updates.status = status;

      if (Object.keys(updates).length === 0) {
        return { success: false, error: "No changes specified" };
      }

      const { data, error } = await supabase
        .from("planned_workouts")
        .update(updates)
        .eq("plan_id", plan.id)
        .eq("date", date)
        .select("date, session_type, ai_notes, status")
        .single();

      if (error) return { success: false, error: error.message };

      return { success: true, updated: data };
    },
  });
}
```

```typescript
// src/lib/chat/tools/index.ts
export { getNutritionTool } from "./get-nutrition";
export { getWorkoutsTool } from "./get-workouts";
export { getCardioTool } from "./get-cardio";
export { getRecoveryTool } from "./get-recovery";
export { getWeightTrendTool } from "./get-weight-trend";
export { getTrainingPlanTool } from "./get-training-plan";
export { updatePlannedWorkoutTool } from "./update-planned-workout";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- __tests__/lib/chat/tools/`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/chat/tools/ __tests__/lib/chat/tools/
git commit -m "feat: add 7 AI chat tools for querying fitness data and modifying plans"
```

---

## Task 2: System Prompt Builder

**Files:**
- Create: `src/lib/chat/system-prompt.ts`
- Test: `__tests__/lib/chat/system-prompt.test.ts`

- [ ] **Step 1: Write system prompt tests**

```typescript
// __tests__/lib/chat/system-prompt.test.ts
import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";

describe("buildSystemPrompt", () => {
  it("includes user profile data", () => {
    const prompt = buildSystemPrompt({
      profile: { age: 28, height: 180, weight: 185, sex: "male", training_experience: "intermediate" },
      goals: { body_goal: "gain_muscle", emphasis: "shoulders", days_per_week: 6, training_for_race: false, race_type: null, race_date: null, goal_time: null },
      plan: { split_type: "ppl", plan_config: null },
      todaySession: "Push",
      recovery: { hrv: 52, sleep_hours: 7.8, resting_hr: 58, body_battery: 75 },
      todayNutrition: { calories: 1800, protein: 142 },
      weekStats: { sessionsCompleted: 3, sessionsPlanned: 6 },
    });

    expect(prompt).toContain("28");
    expect(prompt).toContain("180");
    expect(prompt).toContain("185");
    expect(prompt).toContain("shoulders");
    expect(prompt).toContain("Push");
    expect(prompt).toContain("52");
    expect(prompt).toContain("7.8");
  });

  it("includes race info when training for race", () => {
    const prompt = buildSystemPrompt({
      profile: { age: 30, height: 175, weight: 170, sex: "male", training_experience: "advanced" },
      goals: { body_goal: "gain_muscle", emphasis: null, days_per_week: 6, training_for_race: true, race_type: "half_ironman", race_date: "2026-09-15", goal_time: "5:30:00" },
      plan: { split_type: "hybrid_upper_lower", plan_config: { periodization_phase: "build", race_weeks_out: 20 } },
      todaySession: "Upper Body + Easy Run (Zone 2)",
      recovery: null,
      todayNutrition: null,
      weekStats: { sessionsCompleted: 4, sessionsPlanned: 6 },
    });

    expect(prompt).toContain("Half Ironman");
    expect(prompt).toContain("2026-09-15");
    expect(prompt).toContain("5:30:00");
    expect(prompt).toContain("Build");
    expect(prompt).toContain("20 weeks");
  });

  it("includes coaching personality guidelines", () => {
    const prompt = buildSystemPrompt({
      profile: { age: 25, height: 170, weight: 150, sex: "female", training_experience: "beginner" },
      goals: { body_goal: "lose_weight", emphasis: null, days_per_week: 4, training_for_race: false, race_type: null, race_date: null, goal_time: null },
      plan: null,
      todaySession: null,
      recovery: null,
      todayNutrition: null,
      weekStats: null,
    });

    expect(prompt).toContain("Coach");
    expect(prompt).toContain("specific, actionable advice");
    expect(prompt).toContain("concise");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- __tests__/lib/chat/system-prompt.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement system prompt builder**

```typescript
// src/lib/chat/system-prompt.ts

interface SystemPromptInput {
  profile: {
    age: number | null;
    height: number | null; // cm
    weight: number | null; // lbs
    sex: string | null;
    training_experience: string | null;
  };
  goals: {
    body_goal: string;
    emphasis: string | null;
    days_per_week: number;
    training_for_race: boolean;
    race_type: string | null;
    race_date: string | null;
    goal_time: string | null;
  };
  plan: {
    split_type: string;
    plan_config: Record<string, unknown> | null;
  } | null;
  todaySession: string | null;
  recovery: {
    hrv: number | null;
    sleep_hours: number | null;
    resting_hr: number | null;
    body_battery: number | null;
  } | null;
  todayNutrition: {
    calories: number;
    protein: number;
  } | null;
  weekStats: {
    sessionsCompleted: number;
    sessionsPlanned: number;
  } | null;
}

const RACE_LABELS: Record<string, string> = {
  "5k": "5K",
  "10k": "10K",
  half_marathon: "Half Marathon",
  marathon: "Marathon",
  ultra: "Ultra Marathon",
  sprint_tri: "Sprint Triathlon",
  olympic_tri: "Olympic Triathlon",
  half_ironman: "Half Ironman (70.3)",
  ironman: "Full Ironman (140.6)",
};

const SPLIT_LABELS: Record<string, string> = {
  ppl: "Push / Pull / Legs",
  arnold: "Arnold Split",
  upper_lower: "Upper / Lower",
  full_body: "Full Body",
  phul: "PHUL",
  bro_split: "Bro Split",
  hybrid_upper_lower: "Upper/Lower + Race Prep",
  hybrid_nick_bare: "Hybrid (Nick Bare Style)",
};

export function buildSystemPrompt(input: SystemPromptInput): string {
  const { profile, goals, plan, todaySession, recovery, todayNutrition, weekStats } = input;

  const lines: string[] = [];

  lines.push("You are Coach, a fitness coach. You are direct, specific, encouraging but honest, opinionated, and concise.");
  lines.push("");

  // Profile
  const profileParts: string[] = [];
  if (profile.age) profileParts.push(`${profile.age}yo`);
  if (profile.sex) profileParts.push(profile.sex);
  if (profile.height) profileParts.push(`${profile.height}cm`);
  if (profile.weight) profileParts.push(`${profile.weight}lbs`);
  if (profile.training_experience) profileParts.push(profile.training_experience);
  if (profileParts.length > 0) {
    lines.push(`Profile: ${profileParts.join(", ")}`);
  }

  // Goals
  lines.push(`Goal: ${formatGoal(goals.body_goal)}`);
  if (goals.emphasis && goals.emphasis !== "none") {
    lines.push(`Emphasis: ${goals.emphasis}`);
  }
  lines.push(`Training ${goals.days_per_week} days/week`);

  // Race
  if (goals.training_for_race && goals.race_type) {
    const raceName = RACE_LABELS[goals.race_type] || goals.race_type;
    lines.push(`Race: ${raceName}`);
    if (goals.race_date) lines.push(`Race date: ${goals.race_date}`);
    if (goals.goal_time) lines.push(`Goal time: ${goals.goal_time}`);
  }

  // Plan
  if (plan) {
    const splitName = SPLIT_LABELS[plan.split_type] || plan.split_type;
    lines.push(`Current split: ${splitName}`);
    if (plan.plan_config?.periodization_phase) {
      const phase = plan.plan_config.periodization_phase as string;
      lines.push(`Phase: ${phase.charAt(0).toUpperCase() + phase.slice(1)}`);
    }
    if (plan.plan_config?.race_weeks_out) {
      lines.push(`Race in ${plan.plan_config.race_weeks_out} weeks`);
    }
  }
  lines.push("");

  // Today
  const today = new Date();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  lines.push(`Today: ${today.toISOString().slice(0, 10)} (${dayNames[today.getDay()]})`);

  if (todaySession) {
    lines.push(`Today's session: ${todaySession}`);
  }

  if (recovery) {
    const parts: string[] = [];
    if (recovery.hrv !== null) parts.push(`HRV ${recovery.hrv}`);
    if (recovery.sleep_hours !== null) parts.push(`Sleep ${recovery.sleep_hours}h`);
    if (recovery.resting_hr !== null) parts.push(`RHR ${recovery.resting_hr}`);
    if (recovery.body_battery !== null) parts.push(`Body Battery ${recovery.body_battery}`);
    if (parts.length > 0) lines.push(`Recovery: ${parts.join(", ")}`);
  }

  if (todayNutrition) {
    lines.push(`Today so far: ${todayNutrition.calories} cal, ${todayNutrition.protein}g protein`);
  }

  if (weekStats) {
    lines.push(`This week: ${weekStats.sessionsCompleted}/${weekStats.sessionsPlanned} sessions completed`);
  }
  lines.push("");

  // Guidelines
  lines.push("Guidelines:");
  lines.push("- Give specific, actionable advice based on their actual data");
  lines.push("- Reference specific numbers (\"your HRV dropped to 28 last night\")");
  lines.push("- When recommending food, consider their macro targets and what they've eaten today");
  lines.push("- When suggesting training changes, consider their current split and recovery");
  lines.push("- Flag recovery concerns proactively (poor sleep, high stress, low HRV)");
  lines.push("- For race training, adjust advice based on proximity to race date");
  lines.push("- Be concise — use bullet points, not paragraphs");
  lines.push("- You can use tools to look up data you don't have in this context");
  lines.push("- When modifying the plan, explain what you're changing and why");

  return lines.join("\n");
}

function formatGoal(goal: string): string {
  const map: Record<string, string> = {
    gain_muscle: "Gain muscle",
    lose_weight: "Lose weight / cut",
    maintain: "Maintain / recomp",
    other: "General fitness",
  };
  return map[goal] || goal;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- __tests__/lib/chat/system-prompt.test.ts`
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/chat/system-prompt.ts __tests__/lib/chat/system-prompt.test.ts
git commit -m "feat: add dynamic system prompt builder for AI coach"
```

---

## Task 3: Conversation Persistence

**Files:**
- Create: `src/lib/chat/conversation.ts`
- Test: `__tests__/lib/chat/conversation.test.ts`

- [ ] **Step 1: Write conversation tests**

```typescript
// __tests__/lib/chat/conversation.test.ts
import { describe, it, expect } from "vitest";
import { formatMessagesForAI } from "@/lib/chat/conversation";

describe("conversation", () => {
  describe("formatMessagesForAI", () => {
    it("formats DB messages for AI SDK", () => {
      const dbMessages = [
        { id: "1", role: "user", content: "Hello", tool_calls: null, created_at: "2026-05-01T10:00:00Z" },
        { id: "2", role: "assistant", content: "Hi! How can I help?", tool_calls: null, created_at: "2026-05-01T10:00:05Z" },
      ];

      const formatted = formatMessagesForAI(dbMessages);
      expect(formatted).toHaveLength(2);
      expect(formatted[0]).toEqual({ role: "user", content: "Hello" });
      expect(formatted[1]).toEqual({ role: "assistant", content: "Hi! How can I help?" });
    });

    it("returns empty array for no messages", () => {
      expect(formatMessagesForAI([])).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL. Then implement:**

```typescript
// src/lib/chat/conversation.ts
import { createServerClient } from "@/lib/supabase/server";

interface DBMessage {
  id: string;
  role: string;
  content: string;
  tool_calls: unknown;
  created_at: string;
}

export function formatMessagesForAI(messages: DBMessage[]): Array<{ role: "user" | "assistant"; content: string }> {
  return messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
}

export async function getOrCreateConversation(userId: string): Promise<string> {
  const supabase = createServerClient();

  // Check for existing conversation
  const { data: existing } = await supabase
    .from("chat_conversations")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existing) return existing.id;

  // Create new conversation
  const { data: created, error } = await supabase
    .from("chat_conversations")
    .insert({ user_id: userId, title: "Coach" })
    .select("id")
    .single();

  if (error || !created) throw new Error("Failed to create conversation");
  return created.id;
}

export async function getRecentMessages(conversationId: string, limit = 20): Promise<DBMessage[]> {
  const supabase = createServerClient();

  const { data } = await supabase
    .from("chat_messages")
    .select("id, role, content, tool_calls, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  // Reverse so oldest first
  return (data || []).reverse();
}

export async function saveMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  toolCalls?: unknown,
): Promise<void> {
  const supabase = createServerClient();

  await supabase.from("chat_messages").insert({
    conversation_id: conversationId,
    role,
    content,
    tool_calls: toolCalls || null,
  });
}
```

- [ ] **Step 3: Run tests — expect PASS**

Run: `npm test -- __tests__/lib/chat/conversation.test.ts`
Expected: 2 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/chat/conversation.ts __tests__/lib/chat/conversation.test.ts
git commit -m "feat: add chat conversation persistence layer"
```

---

## Task 4: Chat API Route

**Files:**
- Create: `src/app/api/chat/route.ts`
- Create: `src/app/api/chat/messages/route.ts`

- [ ] **Step 1: Create chat streaming route**

```typescript
// src/app/api/chat/route.ts
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";
import { getOrCreateConversation, getRecentMessages, saveMessage, formatMessagesForAI } from "@/lib/chat/conversation";
import {
  getNutritionTool,
  getWorkoutsTool,
  getCardioTool,
  getRecoveryTool,
  getWeightTrendTool,
  getTrainingPlanTool,
  updatePlannedWorkoutTool,
} from "@/lib/chat/tools";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages } = await request.json();
  const lastUserMessage = messages[messages.length - 1];

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Get or create conversation
  const conversationId = await getOrCreateConversation(userId);

  // Save user message
  await saveMessage(conversationId, "user", lastUserMessage.content);

  // Load context for system prompt
  const [profileRes, goalsRes, planRes, todayRecoveryRes, todayNutritionRes] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("user_id", userId).single(),
    supabase.from("user_goals").select("*").eq("user_id", userId).single(),
    supabase.from("training_plans").select("*").eq("user_id", userId).eq("status", "active").single(),
    supabase.from("recovery_logs").select("hrv, sleep_hours, resting_hr, body_battery").eq("user_id", userId).eq("date", new Date().toISOString().slice(0, 10)).single(),
    supabase.from("nutrition_logs").select("calories, protein").eq("user_id", userId).eq("date", new Date().toISOString().slice(0, 10)).single(),
  ]);

  const profile = profileRes.data;
  const goals = goalsRes.data;
  const plan = planRes.data;
  const recovery = todayRecoveryRes.data;
  const todayNutrition = todayNutritionRes.data;

  // Get today's planned session
  let todaySession: string | null = null;
  if (plan) {
    const { data: todayWorkout } = await supabase
      .from("planned_workouts")
      .select("session_type")
      .eq("plan_id", plan.id)
      .eq("date", new Date().toISOString().slice(0, 10))
      .single();
    todaySession = todayWorkout?.session_type || null;
  }

  // Get week stats
  let weekStats: { sessionsCompleted: number; sessionsPlanned: number } | null = null;
  if (plan) {
    const now = new Date();
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const mondayStr = monday.toISOString().slice(0, 10);
    const todayStr = now.toISOString().slice(0, 10);

    const { data: weekWorkouts } = await supabase
      .from("planned_workouts")
      .select("session_type, status")
      .eq("plan_id", plan.id)
      .gte("date", mondayStr)
      .lte("date", todayStr);

    if (weekWorkouts) {
      const nonRest = weekWorkouts.filter((w) => w.session_type !== "Rest");
      weekStats = {
        sessionsPlanned: nonRest.length,
        sessionsCompleted: nonRest.filter((w) => w.status === "completed").length,
      };
    }
  }

  const systemPrompt = buildSystemPrompt({
    profile: profile ? {
      age: profile.age,
      height: profile.height,
      weight: profile.weight,
      sex: profile.sex,
      training_experience: profile.training_experience,
    } : { age: null, height: null, weight: null, sex: null, training_experience: null },
    goals: goals ? {
      body_goal: goals.body_goal,
      emphasis: goals.emphasis,
      days_per_week: goals.days_per_week,
      training_for_race: goals.training_for_race,
      race_type: goals.race_type,
      race_date: goals.race_date,
      goal_time: goals.goal_time,
    } : { body_goal: "general", emphasis: null, days_per_week: 4, training_for_race: false, race_type: null, race_date: null, goal_time: null },
    plan: plan ? { split_type: plan.split_type, plan_config: plan.plan_config as Record<string, unknown> } : null,
    todaySession,
    recovery,
    todayNutrition,
    weekStats,
  });

  // Get conversation history
  const recentMessages = await getRecentMessages(conversationId, 20);
  const history = formatMessagesForAI(recentMessages);

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: systemPrompt,
    messages: [...history, { role: "user" as const, content: lastUserMessage.content }],
    tools: {
      get_nutrition: getNutritionTool(userId),
      get_workouts: getWorkoutsTool(userId),
      get_cardio: getCardioTool(userId),
      get_recovery: getRecoveryTool(userId),
      get_weight_trend: getWeightTrendTool(userId),
      get_training_plan: getTrainingPlanTool(userId),
      update_planned_workout: updatePlannedWorkoutTool(userId),
    },
    maxSteps: 5,
    onFinish: async ({ text, toolCalls }) => {
      if (text) {
        await saveMessage(conversationId, "assistant", text, toolCalls);
      }
    },
  });

  return result.toDataStreamResponse();
}
```

- [ ] **Step 2: Create messages history route**

```typescript
// src/app/api/chat/messages/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Get user's conversation
  const { data: conversation } = await supabase
    .from("chat_conversations")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!conversation) {
    return NextResponse.json({ messages: [] });
  }

  // Get last 50 messages
  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, role, content, tool_calls, created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .limit(50);

  return NextResponse.json({ messages: messages || [] });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/chat/route.ts src/app/api/chat/messages/route.ts
git commit -m "feat: add chat streaming API route with 7 tools and message history endpoint"
```

---

## Task 5: Chat UI Components

**Files:**
- Create: `src/components/chat/message-bubble.tsx`
- Create: `src/components/chat/tool-call-pills.tsx`
- Create: `src/components/chat/chat-input.tsx`
- Create: `src/components/chat/suggested-prompts.tsx`
- Test: `__tests__/components/chat/message-bubble.test.tsx`
- Test: `__tests__/components/chat/suggested-prompts.test.tsx`

- [ ] **Step 1: Write message bubble tests**

```typescript
// __tests__/components/chat/message-bubble.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageBubble } from "@/components/chat/message-bubble";

describe("MessageBubble", () => {
  it("renders user message right-aligned", () => {
    render(<MessageBubble role="user" content="Should I train today?" />);
    expect(screen.getByText("Should I train today?")).toBeDefined();
  });

  it("renders assistant message with Coach avatar", () => {
    render(<MessageBubble role="assistant" content="Let me check your recovery data." />);
    expect(screen.getByText("Let me check your recovery data.")).toBeDefined();
    expect(screen.getByText("C")).toBeDefined();
  });
});
```

- [ ] **Step 2: Write suggested prompts tests**

```typescript
// __tests__/components/chat/suggested-prompts.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SuggestedPrompts } from "@/components/chat/suggested-prompts";

describe("SuggestedPrompts", () => {
  it("renders 4 prompt buttons", () => {
    render(<SuggestedPrompts onSelect={() => {}} />);
    expect(screen.getByText("What should I eat for dinner?")).toBeDefined();
    expect(screen.getByText("How's my recovery?")).toBeDefined();
    expect(screen.getByText("Should I train today?")).toBeDefined();
    expect(screen.getByText("Swap today's session")).toBeDefined();
  });

  it("calls onSelect with prompt text when clicked", () => {
    const onSelect = vi.fn();
    render(<SuggestedPrompts onSelect={onSelect} />);
    fireEvent.click(screen.getByText("How's my recovery?"));
    expect(onSelect).toHaveBeenCalledWith("How's my recovery?");
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL. Then implement all components:**

```tsx
// src/components/chat/message-bubble.tsx
"use client";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[70%] rounded-2xl rounded-br-sm bg-black px-4 py-2.5 text-sm text-white">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 items-start">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500">
        <span className="text-sm font-bold text-white">C</span>
      </div>
      <div className="max-w-[75%] rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-4 py-2.5 text-sm leading-relaxed text-gray-700">
        <div dangerouslySetInnerHTML={{ __html: formatContent(content) }} />
      </div>
    </div>
  );
}

function formatContent(content: string): string {
  // Convert markdown-ish formatting to HTML
  return content
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n- /g, "<br>• ")
    .replace(/\n/g, "<br>");
}
```

```tsx
// src/components/chat/tool-call-pills.tsx
"use client";

interface ToolCallPillsProps {
  toolCalls: Array<{ toolName: string }> | undefined;
}

const TOOL_ICONS: Record<string, string> = {
  get_nutrition: "🍽️",
  get_workouts: "🏋️",
  get_cardio: "🏃",
  get_recovery: "📊",
  get_weight_trend: "⚖️",
  get_training_plan: "📋",
  update_planned_workout: "✏️",
};

const TOOL_LABELS: Record<string, string> = {
  get_nutrition: "get_nutrition",
  get_workouts: "get_workouts",
  get_cardio: "get_cardio",
  get_recovery: "get_recovery",
  get_weight_trend: "get_weight_trend",
  get_training_plan: "get_training_plan",
  update_planned_workout: "update_planned_workout",
};

export function ToolCallPills({ toolCalls }: ToolCallPillsProps) {
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="flex gap-1.5 pl-10">
      {toolCalls.map((tc, i) => {
        const isWrite = tc.toolName === "update_planned_workout";
        return (
          <span
            key={i}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              isWrite ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            }`}
          >
            {TOOL_ICONS[tc.toolName] || "🔧"} {TOOL_LABELS[tc.toolName] || tc.toolName}
          </span>
        );
      })}
    </div>
  );
}
```

```tsx
// src/components/chat/chat-input.tsx
"use client";

import { type FormEvent } from "react";

interface ChatInputProps {
  input: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: FormEvent) => void;
  isLoading: boolean;
}

export function ChatInput({ input, onChange, onSubmit, isLoading }: ChatInputProps) {
  return (
    <div className="border-t bg-white px-5 py-3">
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={onChange}
          placeholder="Ask your coach anything..."
          className="flex-1 rounded-full border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-gray-400"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white disabled:opacity-40"
        >
          {isLoading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <span className="text-lg">↑</span>
          )}
        </button>
      </form>
    </div>
  );
}
```

```tsx
// src/components/chat/suggested-prompts.tsx
"use client";

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
}

const PROMPTS = [
  "What should I eat for dinner?",
  "How's my recovery?",
  "Should I train today?",
  "Swap today's session",
];

export function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <div className="flex flex-wrap gap-2 border-b px-5 py-3">
      {PROMPTS.map((prompt) => (
        <button
          key={prompt}
          type="button"
          onClick={() => onSelect(prompt)}
          className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- __tests__/components/chat/`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/ __tests__/components/chat/
git commit -m "feat: add chat UI components (message bubbles, tool pills, input, suggested prompts)"
```

---

## Task 6: Full-Page Chat Page

**Files:**
- Modify: `src/app/dashboard/chat/page.tsx`

- [ ] **Step 1: Read existing file, then replace entirely with:**

```tsx
// src/app/dashboard/chat/page.tsx
"use client";

import { useChat } from "ai/react";
import { useEffect, useRef, useState } from "react";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ToolCallPills } from "@/components/chat/tool-call-pills";
import { ChatInput } from "@/components/chat/chat-input";
import { SuggestedPrompts } from "@/components/chat/suggested-prompts";

interface HistoryMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tool_calls: unknown;
  created_at: string;
}

export default function ChatPage() {
  const [initialMessages, setInitialMessages] = useState<Array<{ id: string; role: "user" | "assistant"; content: string }>>([]);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load message history on mount
  useEffect(() => {
    async function loadHistory() {
      const res = await fetch("/api/chat/messages");
      if (res.ok) {
        const data = await res.json();
        const msgs = (data.messages as HistoryMessage[]).map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
        }));
        setInitialMessages(msgs);
      }
      setLoaded(true);
    }
    loadHistory();
  }, []);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput } = useChat({
    api: "/api/chat",
    initialMessages,
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt);
  };

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col -m-6">
      <SuggestedPrompts onSelect={handleSuggestedPrompt} />

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500">
              <span className="text-2xl font-bold text-white">C</span>
            </div>
            <h2 className="mt-4 text-lg font-semibold">Hey! I'm your Coach.</h2>
            <p className="mt-1 text-sm text-gray-500">
              Ask me about your nutrition, training, recovery — or just what to eat for dinner.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m) => (
              <div key={m.id}>
                {m.role === "assistant" && (m as any).toolInvocations && (
                  <ToolCallPills
                    toolCalls={(m as any).toolInvocations?.map((t: any) => ({ toolName: t.toolName }))}
                  />
                )}
                <MessageBubble role={m.role as "user" | "assistant"} content={m.content} />
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2.5 items-start">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500">
                  <span className="text-sm font-bold text-white">C</span>
                </div>
                <div className="rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-4 py-3">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: "0ms" }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: "150ms" }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ChatInput
        input={input}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  );
}
```

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/chat/page.tsx
git commit -m "feat: rewrite chat page with streaming AI coach, tool calls, and message history"
```

---

## Task 7: Floating Chat Launcher + Panel

**Files:**
- Create: `src/components/chat/chat-launcher.tsx`
- Create: `src/components/chat/chat-panel.tsx`
- Modify: `src/app/dashboard/layout.tsx`

- [ ] **Step 1: Create chat panel (slide-over)**

```tsx
// src/components/chat/chat-panel.tsx
"use client";

import { useChat } from "ai/react";
import { useEffect, useRef } from "react";
import { MessageBubble } from "./message-bubble";
import { ChatInput } from "./chat-input";
import Link from "next/link";

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
}

export function ChatPanel({ open, onClose }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput } = useChat({
    api: "/api/chat",
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!open) return null;

  return (
    <div className="fixed right-0 top-0 bottom-0 z-40 flex w-80 flex-col border-l bg-white shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500">
            <span className="text-[10px] font-bold text-white">C</span>
          </div>
          <span className="text-sm font-semibold">Coach</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/chat" className="text-xs text-indigo-600 hover:underline">
            Open full →
          </Link>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">
            ×
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-gray-400">Ask Coach anything...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <MessageBubble key={m.id} role={m.role as "user" | "assistant"} content={m.content} />
            ))}
            {isLoading && (
              <div className="flex gap-2 items-start">
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500">
                  <span className="text-[8px] font-bold text-white">C</span>
                </div>
                <div className="rounded-xl border bg-white px-3 py-2">
                  <div className="flex gap-1">
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300" />
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: "150ms" }} />
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t px-3 py-2">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Ask Coach..."
            className="flex-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-white text-xs disabled:opacity-40"
          >
            ↑
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create chat launcher (FAB)**

```tsx
// src/components/chat/chat-launcher.tsx
"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { ChatPanel } from "./chat-panel";

export function ChatLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Load persisted state
  useEffect(() => {
    const saved = localStorage.getItem("hybro-chat-panel-open");
    if (saved === "true") setOpen(true);
  }, []);

  // Persist state
  useEffect(() => {
    localStorage.setItem("hybro-chat-panel-open", String(open));
  }, [open]);

  // Don't show on the chat page itself
  if (pathname === "/dashboard/chat") return null;

  return (
    <>
      <ChatPanel open={open} onClose={() => setOpen(false)} />

      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/40 hover:shadow-xl hover:shadow-indigo-500/50 transition-shadow"
        >
          <span className="text-lg font-bold text-white">C</span>
        </button>
      )}
    </>
  );
}
```

- [ ] **Step 3: Add ChatLauncher to dashboard layout**

Read `src/app/dashboard/layout.tsx` and add the ChatLauncher. Add this import at the top:

```typescript
import { ChatLauncher } from "@/components/chat/chat-launcher";
```

Add `<ChatLauncher />` just before the closing `</div>` of the root element (after `</main>`'s parent div):

The modified return should look like:
```tsx
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
      <ChatLauncher />
    </div>
  );
```

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/chat-launcher.tsx src/components/chat/chat-panel.tsx src/app/dashboard/layout.tsx
git commit -m "feat: add floating chat launcher and slide-over panel on dashboard pages"
```

---

## Task 8: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all frontend tests**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 2: Run all server tests**

Run: `cd /Users/sharans/Desktop/projects/macrofactor-agent/server && npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Verify git status is clean**

Run: `git status`
Expected: Nothing to commit

- [ ] **Step 4: Final commit if needed**

```bash
git add -A && git commit -m "chore: Phase 5 cleanup" || echo "Nothing to commit"
```
