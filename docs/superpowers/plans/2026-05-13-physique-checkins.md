# Physique Check-ins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add weekly physique check-in photos to the Coach chat — upload front/side/back poses, review progress in a timeline scrubber, and compare two dates side-by-side.

**Architecture:** CheckInCard appears inline in chat (like PlanProposalCard). Photos upload to Supabase Storage via an API route. PhysiqueReviewModal opens from a dropdown on the chat input bar with timeline scrubbing and comparison mode. Coach tools let the AI decide when to prompt for check-ins.

**Tech Stack:** Next.js App Router, Supabase Storage + PostgreSQL, Clerk auth, React inline styles, Vitest

**Spec:** `docs/superpowers/specs/2026-05-13-physique-checkins-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/014_physique_checkins.sql` | Create | Table + RLS |
| `src/lib/checkin-preferences.ts` | Create | localStorage get/save for check-in settings |
| `src/lib/image-resize.ts` | Create | Client-side image resize before upload |
| `src/components/chat/pose-silhouettes.tsx` | Create | 3 SVG anatomical pose guides |
| `src/app/api/checkins/upload/route.ts` | Create | Upload endpoint (Supabase Storage + DB) |
| `src/app/api/checkins/route.ts` | Create | List all check-ins for user |
| `src/app/api/checkins/latest/route.ts` | Create | Most recent check-in date |
| `src/components/chat/checkin-card.tsx` | Create | Upload card in chat stream |
| `src/lib/chat/tools/get-checkin-history.ts` | Create | Coach tool: check last check-in |
| `src/lib/chat/tools/prompt-checkin.ts` | Create | Coach tool: trigger check-in card |
| `src/components/chat/physique-review-modal.tsx` | Create | Timeline scrubber + comparison modal |
| `src/components/chat/chat-input-dropdown.tsx` | Create | Dropdown menu for chat input bar |
| `src/components/chat/chat-input.tsx` | Modify | Add dropdown button |
| `src/app/dashboard/settings/page.tsx` | Modify | Add check-in toggle/frequency to Preferences |
| `src/app/dashboard/coach/page.tsx` | Modify | Wire CheckInCard + PhysiqueReviewModal + dropdown |
| `src/app/api/chat/route.ts` | Modify | Register new tools |
| `src/lib/chat/system-prompt.ts` | Modify | Add check-in prompting guideline |

---

### Task 1: Database migration + preferences utility

**Files:**
- Create: `supabase/migrations/014_physique_checkins.sql`
- Create: `src/lib/checkin-preferences.ts`
- Create: `__tests__/lib/checkin-preferences.test.ts`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/014_physique_checkins.sql`:

```sql
-- Physique check-in photos
create table if not exists physique_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  date date not null,
  front_url text,
  side_url text,
  back_url text,
  notes text,
  created_at timestamptz not null default now(),
  unique(user_id, date)
);

alter table physique_checkins enable row level security;

create policy "Users can read own check-ins"
  on physique_checkins for select
  using (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

create policy "Users can insert own check-ins"
  on physique_checkins for insert
  with check (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
```

- [ ] **Step 2: Write failing tests for preferences utility**

Create `__tests__/lib/checkin-preferences.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getCheckinPreferences, saveCheckinPreferences, type CheckinPreferences } from "@/lib/checkin-preferences";

describe("checkin-preferences", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns defaults when nothing saved", () => {
    const prefs = getCheckinPreferences();
    expect(prefs).toEqual({ enabled: true, frequencyWeeks: 1 });
  });

  it("saves and retrieves preferences", () => {
    const prefs: CheckinPreferences = { enabled: false, frequencyWeeks: 4 };
    saveCheckinPreferences(prefs);
    expect(getCheckinPreferences()).toEqual(prefs);
  });

  it("merges partial saved data with defaults", () => {
    localStorage.setItem("trainer-checkin-preferences", JSON.stringify({ enabled: false }));
    const prefs = getCheckinPreferences();
    expect(prefs.enabled).toBe(false);
    expect(prefs.frequencyWeeks).toBe(1);
  });

  it("returns defaults on invalid JSON", () => {
    localStorage.setItem("trainer-checkin-preferences", "not-json");
    const prefs = getCheckinPreferences();
    expect(prefs).toEqual({ enabled: true, frequencyWeeks: 1 });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run __tests__/lib/checkin-preferences.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement preferences utility**

Create `src/lib/checkin-preferences.ts`:

```typescript
export interface CheckinPreferences {
  enabled: boolean;
  frequencyWeeks: number;
}

const STORAGE_KEY = "trainer-checkin-preferences";

const DEFAULTS: CheckinPreferences = {
  enabled: true,
  frequencyWeeks: 1,
};

export function getCheckinPreferences(): CheckinPreferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
  } catch {}
  return DEFAULTS;
}

export function saveCheckinPreferences(prefs: CheckinPreferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run __tests__/lib/checkin-preferences.test.ts`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/014_physique_checkins.sql src/lib/checkin-preferences.ts __tests__/lib/checkin-preferences.test.ts
git commit -m "feat: add physique_checkins migration and preferences utility"
```

---

### Task 2: Image resize utility

**Files:**
- Create: `src/lib/image-resize.ts`

- [ ] **Step 1: Create image resize utility**

Create `src/lib/image-resize.ts`:

```typescript
/**
 * Resize an image file client-side before upload.
 * Returns a Blob (JPEG, 85% quality) with longest edge <= maxSize.
 */
export async function resizeImage(file: File, maxSize: number = 1200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      if (width <= maxSize && height <= maxSize) {
        // Already small enough — convert to JPEG anyway for consistency
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
          "image/jpeg",
          0.85,
        );
        return;
      }

      // Scale down
      if (width > height) {
        height = Math.round(height * (maxSize / width));
        width = maxSize;
      } else {
        width = Math.round(width * (maxSize / height));
        height = maxSize;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/image-resize.ts
git commit -m "feat: add client-side image resize utility"
```

---

### Task 3: SVG pose silhouettes

**Files:**
- Create: `src/components/chat/pose-silhouettes.tsx`

- [ ] **Step 1: Create the pose silhouette components**

Create `src/components/chat/pose-silhouettes.tsx` with three SVG components. These use anatomical outline style (muscle contours visible, gender-neutral, no face). The side figure faces right.

```typescript
interface PoseSVGProps {
  width?: number;
  height?: number;
  color?: string;
}

export function FrontPoseSVG({ width = 120, height = 240, color = "rgba(255,255,255,0.15)" }: PoseSVGProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 200 400" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <ellipse cx="100" cy="32" rx="22" ry="28" stroke={color} strokeWidth="2" />
      {/* Neck */}
      <path d="M90 58 L90 72 L110 72 L110 58" stroke={color} strokeWidth="2" />
      {/* Trapezius */}
      <path d="M90 68 Q70 72 55 82" stroke={color} strokeWidth="2" />
      <path d="M110 68 Q130 72 145 82" stroke={color} strokeWidth="2" />
      {/* Shoulders */}
      <path d="M55 82 Q48 88 44 100" stroke={color} strokeWidth="2" />
      <path d="M145 82 Q152 88 156 100" stroke={color} strokeWidth="2" />
      {/* Deltoids */}
      <ellipse cx="48" cy="95" rx="12" ry="16" stroke={color} strokeWidth="1.5" strokeDasharray="3 2" />
      <ellipse cx="152" cy="95" rx="12" ry="16" stroke={color} strokeWidth="1.5" strokeDasharray="3 2" />
      {/* Chest / pecs */}
      <path d="M70 82 Q80 90 100 92 Q120 90 130 82" stroke={color} strokeWidth="1.5" />
      <path d="M72 88 Q86 98 100 96" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      <path d="M128 88 Q114 98 100 96" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Torso outline */}
      <path d="M66 82 L62 130 L68 172 L80 185" stroke={color} strokeWidth="2" />
      <path d="M134 82 L138 130 L132 172 L120 185" stroke={color} strokeWidth="2" />
      {/* Abs */}
      <line x1="100" y1="100" x2="100" y2="175" stroke={color} strokeWidth="1" strokeDasharray="3 3" />
      <line x1="82" y1="110" x2="118" y2="110" stroke={color} strokeWidth="1" strokeDasharray="2 3" />
      <line x1="84" y1="126" x2="116" y2="126" stroke={color} strokeWidth="1" strokeDasharray="2 3" />
      <line x1="85" y1="142" x2="115" y2="142" stroke={color} strokeWidth="1" strokeDasharray="2 3" />
      <line x1="86" y1="158" x2="114" y2="158" stroke={color} strokeWidth="1" strokeDasharray="2 3" />
      {/* Arms — slightly away from body */}
      <path d="M44 100 L36 140 L32 170 L30 190" stroke={color} strokeWidth="2" />
      <path d="M156 100 L164 140 L168 170 L170 190" stroke={color} strokeWidth="2" />
      {/* Bicep contours */}
      <path d="M40 105 Q34 125 36 140" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      <path d="M160 105 Q166 125 164 140" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Forearms */}
      <path d="M36 140 Q30 155 30 170" stroke={color} strokeWidth="1.5" />
      <path d="M164 140 Q170 155 170 170" stroke={color} strokeWidth="1.5" />
      {/* Hands */}
      <ellipse cx="29" cy="195" rx="6" ry="10" stroke={color} strokeWidth="1.5" />
      <ellipse cx="171" cy="195" rx="6" ry="10" stroke={color} strokeWidth="1.5" />
      {/* Hips */}
      <path d="M80 185 Q100 195 120 185" stroke={color} strokeWidth="2" />
      {/* Quads */}
      <path d="M80 185 L74 240 L72 280 L78 290" stroke={color} strokeWidth="2" />
      <path d="M120 185 L126 240 L128 280 L122 290" stroke={color} strokeWidth="2" />
      {/* Inner thigh */}
      <path d="M92 195 L90 240 L88 280" stroke={color} strokeWidth="1.5" />
      <path d="M108 195 L110 240 L112 280" stroke={color} strokeWidth="1.5" />
      {/* Quad muscle lines */}
      <path d="M82 210 Q78 235 76 260" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      <path d="M118 210 Q122 235 124 260" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Knees */}
      <ellipse cx="83" cy="288" rx="10" ry="8" stroke={color} strokeWidth="1.5" />
      <ellipse cx="117" cy="288" rx="10" ry="8" stroke={color} strokeWidth="1.5" />
      {/* Shins */}
      <path d="M78 296 L76 340 L74 370" stroke={color} strokeWidth="2" />
      <path d="M88 296 L88 340 L86 370" stroke={color} strokeWidth="1.5" />
      <path d="M122 296 L124 340 L126 370" stroke={color} strokeWidth="2" />
      <path d="M112 296 L112 340 L114 370" stroke={color} strokeWidth="1.5" />
      {/* Feet */}
      <path d="M70 370 L66 385 L86 390 L90 375" stroke={color} strokeWidth="2" />
      <path d="M130 370 L134 385 L114 390 L110 375" stroke={color} strokeWidth="2" />
    </svg>
  );
}

export function SidePoseSVG({ width = 120, height = 240, color = "rgba(255,255,255,0.15)" }: PoseSVGProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 200 400" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head — facing right */}
      <ellipse cx="115" cy="32" rx="20" ry="26" stroke={color} strokeWidth="2" />
      {/* Jaw line */}
      <path d="M128 42 Q130 52 122 58" stroke={color} strokeWidth="1.5" />
      {/* Neck */}
      <path d="M108 56 L106 72" stroke={color} strokeWidth="2" />
      <path d="M122 56 L120 72" stroke={color} strokeWidth="2" />
      {/* Upper back / traps */}
      <path d="M106 72 Q100 78 96 90 L92 120" stroke={color} strokeWidth="2" />
      {/* Chest front */}
      <path d="M120 72 Q132 82 134 100 L130 120" stroke={color} strokeWidth="2" />
      {/* Chest contour */}
      <path d="M125 80 Q134 92 132 105" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Shoulder / deltoid */}
      <path d="M96 85 Q88 82 84 90 Q82 100 86 110" stroke={color} strokeWidth="2" />
      <ellipse cx="88" cy="96" rx="10" ry="12" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Back curve — spine to glutes */}
      <path d="M92 120 Q88 150 90 170 Q92 180 96 190" stroke={color} strokeWidth="2" />
      {/* Front torso — chest to hip */}
      <path d="M130 120 Q128 145 126 165 Q122 178 118 190" stroke={color} strokeWidth="2" />
      {/* Ab contour */}
      <path d="M128 125 Q126 145 124 160" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Arm — hanging at side */}
      <path d="M86 110 L82 145 L80 170 L78 190" stroke={color} strokeWidth="2" />
      <path d="M92 110 L88 145 L86 170 L84 190" stroke={color} strokeWidth="1.5" />
      {/* Tricep contour */}
      <path d="M84 115 Q80 132 82 145" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Hand */}
      <ellipse cx="81" cy="196" rx="6" ry="9" stroke={color} strokeWidth="1.5" />
      {/* Glutes */}
      <path d="M96 190 Q90 195 92 208 Q96 215 104 210" stroke={color} strokeWidth="2" />
      <path d="M96 198 Q92 202 94 208" stroke={color} strokeWidth="1" strokeDasharray="2 2" />
      {/* Hip front */}
      <path d="M118 190 Q124 200 120 210 Q116 215 104 210" stroke={color} strokeWidth="2" />
      {/* Thigh — front (quad) */}
      <path d="M120 210 L124 250 L122 280 L118 290" stroke={color} strokeWidth="2" />
      {/* Thigh — back (hamstring) */}
      <path d="M96 210 L94 250 L96 280 L100 290" stroke={color} strokeWidth="2" />
      {/* Quad contour */}
      <path d="M118 215 Q124 240 122 265" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Hamstring contour */}
      <path d="M98 215 Q94 240 96 265" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Knee */}
      <ellipse cx="109" cy="288" rx="12" ry="8" stroke={color} strokeWidth="1.5" />
      {/* Calf */}
      <path d="M100 296 L98 330 Q100 350 104 370" stroke={color} strokeWidth="2" />
      <path d="M118 296 L120 325 Q118 345 114 370" stroke={color} strokeWidth="2" />
      {/* Calf muscle */}
      <path d="M102 300 Q96 318 100 340" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Foot — facing right */}
      <path d="M104 370 L100 380 L90 386 L130 390 L120 375" stroke={color} strokeWidth="2" />
    </svg>
  );
}

export function BackPoseSVG({ width = 120, height = 240, color = "rgba(255,255,255,0.15)" }: PoseSVGProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 200 400" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <ellipse cx="100" cy="32" rx="22" ry="28" stroke={color} strokeWidth="2" />
      {/* Neck */}
      <path d="M90 58 L90 72 L110 72 L110 58" stroke={color} strokeWidth="2" />
      {/* Trapezius */}
      <path d="M90 65 Q70 70 55 82" stroke={color} strokeWidth="2" />
      <path d="M110 65 Q130 70 145 82" stroke={color} strokeWidth="2" />
      <path d="M92 68 Q85 74 78 80" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      <path d="M108 68 Q115 74 122 80" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Shoulders */}
      <path d="M55 82 Q48 88 44 100" stroke={color} strokeWidth="2" />
      <path d="M145 82 Q152 88 156 100" stroke={color} strokeWidth="2" />
      {/* Rear deltoids */}
      <ellipse cx="48" cy="95" rx="12" ry="16" stroke={color} strokeWidth="1.5" strokeDasharray="3 2" />
      <ellipse cx="152" cy="95" rx="12" ry="16" stroke={color} strokeWidth="1.5" strokeDasharray="3 2" />
      {/* Lats — V-taper */}
      <path d="M66 82 L60 110 L62 140 L68 172 L80 185" stroke={color} strokeWidth="2" />
      <path d="M134 82 L140 110 L138 140 L132 172 L120 185" stroke={color} strokeWidth="2" />
      {/* Lat muscle contours */}
      <path d="M68 90 Q62 115 64 140" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      <path d="M132 90 Q138 115 136 140" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Spine */}
      <line x1="100" y1="72" x2="100" y2="180" stroke={color} strokeWidth="1.5" strokeDasharray="4 3" />
      {/* Scapulae */}
      <path d="M76 88 Q82 96 84 110 Q82 118 76 120" stroke={color} strokeWidth="1" strokeDasharray="2 2" />
      <path d="M124 88 Q118 96 116 110 Q118 118 124 120" stroke={color} strokeWidth="1" strokeDasharray="2 2" />
      {/* Lower back */}
      <path d="M88 150 Q100 155 112 150" stroke={color} strokeWidth="1" strokeDasharray="2 2" />
      <path d="M90 162 Q100 167 110 162" stroke={color} strokeWidth="1" strokeDasharray="2 2" />
      {/* Arms */}
      <path d="M44 100 L36 140 L32 170 L30 190" stroke={color} strokeWidth="2" />
      <path d="M156 100 L164 140 L168 170 L170 190" stroke={color} strokeWidth="2" />
      {/* Tricep contours */}
      <path d="M42 105 Q36 120 36 140" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      <path d="M158 105 Q164 120 164 140" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Forearms */}
      <path d="M36 140 Q30 155 30 170" stroke={color} strokeWidth="1.5" />
      <path d="M164 140 Q170 155 170 170" stroke={color} strokeWidth="1.5" />
      {/* Hands */}
      <ellipse cx="29" cy="195" rx="6" ry="10" stroke={color} strokeWidth="1.5" />
      <ellipse cx="171" cy="195" rx="6" ry="10" stroke={color} strokeWidth="1.5" />
      {/* Glutes */}
      <path d="M80 185 Q90 195 100 194 Q110 195 120 185" stroke={color} strokeWidth="2" />
      <path d="M84 188 Q92 196 100 194" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      <path d="M116 188 Q108 196 100 194" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Glute crease */}
      <line x1="100" y1="185" x2="100" y2="200" stroke={color} strokeWidth="1" strokeDasharray="2 2" />
      {/* Hamstrings */}
      <path d="M80 200 L74 240 L72 280 L78 290" stroke={color} strokeWidth="2" />
      <path d="M120 200 L126 240 L128 280 L122 290" stroke={color} strokeWidth="2" />
      <path d="M92 200 L90 240 L88 280" stroke={color} strokeWidth="1.5" />
      <path d="M108 200 L110 240 L112 280" stroke={color} strokeWidth="1.5" />
      {/* Hamstring contours */}
      <path d="M84 210 Q78 235 76 260" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      <path d="M116 210 Q122 235 124 260" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Knees */}
      <ellipse cx="83" cy="288" rx="10" ry="8" stroke={color} strokeWidth="1.5" />
      <ellipse cx="117" cy="288" rx="10" ry="8" stroke={color} strokeWidth="1.5" />
      {/* Calves */}
      <path d="M78 296 L76 330 Q78 350 80 370" stroke={color} strokeWidth="2" />
      <path d="M88 296 L88 330 Q86 350 84 370" stroke={color} strokeWidth="1.5" />
      <path d="M122 296 L124 330 Q122 350 120 370" stroke={color} strokeWidth="2" />
      <path d="M112 296 L112 330 Q114 350 116 370" stroke={color} strokeWidth="1.5" />
      {/* Calf muscle contours */}
      <path d="M80 300 Q74 320 78 345" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      <path d="M120 300 Q126 320 122 345" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Feet */}
      <path d="M70 370 L66 385 L86 390 L90 375" stroke={color} strokeWidth="2" />
      <path d="M130 370 L134 385 L114 390 L110 375" stroke={color} strokeWidth="2" />
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/chat/pose-silhouettes.tsx
git commit -m "feat: add anatomical SVG pose silhouettes for check-in card"
```

---

### Task 4: API endpoints

**Files:**
- Create: `src/app/api/checkins/upload/route.ts`
- Create: `src/app/api/checkins/route.ts`
- Create: `src/app/api/checkins/latest/route.ts`

- [ ] **Step 1: Create upload endpoint**

Create `src/app/api/checkins/upload/route.ts`:

```typescript
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const front = formData.get("front") as File | null;
  const side = formData.get("side") as File | null;
  const back = formData.get("back") as File | null;
  const notes = formData.get("notes") as string | null;

  if (!front || !side || !back) {
    return NextResponse.json({ error: "All three photos required" }, { status: 400 });
  }

  const date = new Date().toISOString().slice(0, 10);
  const urls: Record<string, string> = {};

  for (const [angle, file] of [["front", front], ["side", side], ["back", back]] as const) {
    const path = `${userId}/${date}/${angle}.jpg`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("physique-checkins")
      .upload(path, buffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed for ${angle}: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from("physique-checkins")
      .getPublicUrl(path);

    urls[angle] = urlData.publicUrl;
  }

  const { data: checkin, error: dbError } = await supabase
    .from("physique_checkins")
    .upsert({
      user_id: userId,
      date,
      front_url: urls.front,
      side_url: urls.side,
      back_url: urls.back,
      notes: notes || null,
    }, { onConflict: "user_id,date" })
    .select("id, date, front_url, side_url, back_url, notes")
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, checkin });
}
```

- [ ] **Step 2: Create list endpoint**

Create `src/app/api/checkins/route.ts`:

```typescript
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

  const { data: checkins, error } = await supabase
    .from("physique_checkins")
    .select("id, date, front_url, side_url, back_url, notes, created_at")
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ checkins: checkins || [] });
}
```

- [ ] **Step 3: Create latest endpoint**

Create `src/app/api/checkins/latest/route.ts`:

```typescript
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

  const { data } = await supabase
    .from("physique_checkins")
    .select("date")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({ last_checkin_date: data?.date || null });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/checkins/upload/route.ts src/app/api/checkins/route.ts src/app/api/checkins/latest/route.ts
git commit -m "feat: add check-in API endpoints (upload, list, latest)"
```

---

### Task 5: Coach tools

**Files:**
- Create: `src/lib/chat/tools/get-checkin-history.ts`
- Create: `src/lib/chat/tools/prompt-checkin.ts`

- [ ] **Step 1: Create get-checkin-history tool**

Create `src/lib/chat/tools/get-checkin-history.ts`:

```typescript
import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";

export function getCheckinHistoryTool(userId: string) {
  return tool({
    description:
      "Check when the user's last physique check-in was and whether they have check-ins enabled. Use to decide whether to prompt for a new check-in.",
    inputSchema: z.object({}),
    execute: async () => {
      const supabase = createServerClient();

      const { data } = await supabase
        .from("physique_checkins")
        .select("date")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(1)
        .single();

      const lastDate = data?.date || null;
      let daysSinceLast: number | null = null;

      if (lastDate) {
        const last = new Date(lastDate);
        const now = new Date();
        daysSinceLast = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        last_checkin_date: lastDate,
        days_since_last: daysSinceLast,
      };
    },
  });
}
```

- [ ] **Step 2: Create prompt-checkin tool**

Create `src/lib/chat/tools/prompt-checkin.ts`:

```typescript
import { z } from "zod";
import { tool } from "ai";

export function promptCheckinTool() {
  return tool({
    description:
      "Trigger a physique check-in card in the chat. Use when you've determined it's time for the user to do a progress photo check-in. The card will appear with upload slots for front, side, and back photos.",
    inputSchema: z.object({
      message: z
        .string()
        .describe("A brief motivating message to show with the check-in prompt"),
    }),
    execute: async ({ message }) => {
      return {
        type: "checkin_prompt",
        date: new Date().toISOString().slice(0, 10),
        message,
      };
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/chat/tools/get-checkin-history.ts src/lib/chat/tools/prompt-checkin.ts
git commit -m "feat: add coach tools for check-in history and prompting"
```

---

### Task 6: CheckInCard component

**Files:**
- Create: `src/components/chat/checkin-card.tsx`

- [ ] **Step 1: Create the CheckInCard component**

Create `src/components/chat/checkin-card.tsx`:

```typescript
"use client";

import { useState, useRef } from "react";
import { FrontPoseSVG, SidePoseSVG, BackPoseSVG } from "./pose-silhouettes";
import { resizeImage } from "@/lib/image-resize";

type Angle = "front" | "side" | "back";

interface CheckinCardData {
  type: "checkin_prompt";
  date: string;
  message: string;
}

const ANGLES: { key: Angle; label: string; Svg: typeof FrontPoseSVG }[] = [
  { key: "front", label: "Front", Svg: FrontPoseSVG },
  { key: "side", label: "Side", Svg: SidePoseSVG },
  { key: "back", label: "Back", Svg: BackPoseSVG },
];

export function CheckInCard({ data }: { data: CheckinCardData }) {
  const [photos, setPhotos] = useState<Record<Angle, { file: File; preview: string } | null>>({
    front: null, side: null, back: null,
  });
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [status, setStatus] = useState<"pending" | "uploading" | "done" | "error">("pending");
  const fileRefs = useRef<Record<Angle, HTMLInputElement | null>>({ front: null, side: null, back: null });

  const allUploaded = photos.front && photos.side && photos.back;

  const handleFileSelect = async (angle: Angle, file: File) => {
    const resized = await resizeImage(file);
    const preview = URL.createObjectURL(resized);
    const resizedFile = new File([resized], `${angle}.jpg`, { type: "image/jpeg" });
    setPhotos((prev) => ({ ...prev, [angle]: { file: resizedFile, preview } }));
  };

  const handleSubmit = async () => {
    if (!allUploaded) return;
    setStatus("uploading");

    const formData = new FormData();
    formData.append("front", photos.front!.file);
    formData.append("side", photos.side!.file);
    formData.append("back", photos.back!.file);
    if (notes.trim()) formData.append("notes", notes.trim());

    try {
      const res = await fetch("/api/checkins/upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        setStatus("done");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const handleClear = (angle: Angle) => {
    if (photos[angle]?.preview) URL.revokeObjectURL(photos[angle]!.preview);
    setPhotos((prev) => ({ ...prev, [angle]: null }));
  };

  return (
    <div style={{
      background: "linear-gradient(135deg, #0F1B22 0%, #1a2d3a 100%)",
      borderRadius: 20, padding: 24, color: "#fff",
      position: "relative", overflow: "hidden",
    }}>
      {/* Decorative blobs */}
      <div style={{ position: "absolute", top: -40, right: -30, width: 140, height: 140, borderRadius: "50%", background: "#B7DDEA", opacity: 0.12, filter: "blur(40px)" }} />
      <div style={{ position: "absolute", bottom: -30, left: -20, width: 120, height: 120, borderRadius: "50%", background: "#F6B7A6", opacity: 0.12, filter: "blur(40px)" }} />

      <div style={{ position: "relative" }}>
        {/* Header */}
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#B7DDEA", marginBottom: 6 }}>
          {status === "done" ? "Check-in Saved" : "Weekly Check-in"}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>
          {status === "done" ? "Looking good!" : data.message}
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>
          {data.date}
        </div>

        {/* Upload zones */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
          {ANGLES.map(({ key, label, Svg }) => {
            const photo = photos[key];
            return (
              <div key={key}>
                <div
                  onClick={() => status === "pending" && fileRefs.current[key]?.click()}
                  style={{
                    aspectRatio: "3/4",
                    borderRadius: 14,
                    border: photo ? "2px solid #22c55e" : "2px dashed rgba(255,255,255,0.2)",
                    background: photo ? "transparent" : "rgba(255,255,255,0.03)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: status === "pending" ? "pointer" : "default",
                    position: "relative", overflow: "hidden",
                  }}
                >
                  {photo ? (
                    <>
                      <img src={photo.preview} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} />
                      {status === "pending" && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleClear(key); }}
                          style={{
                            position: "absolute", top: 6, right: 6,
                            width: 22, height: 22, borderRadius: "50%",
                            background: "rgba(0,0,0,0.7)", border: "none",
                            color: "#fff", fontSize: 12, cursor: "pointer",
                            display: "grid", placeItems: "center",
                          }}
                        >
                          x
                        </button>
                      )}
                    </>
                  ) : (
                    <Svg width={80} height={160} />
                  )}
                  <input
                    ref={(el) => { fileRefs.current[key] = el; }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(key, file);
                      e.target.value = "";
                    }}
                  />
                </div>
                <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
                  {label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Notes */}
        {status === "pending" && (
          showNotes ? (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How are you feeling? Any changes you notice?"
              style={{
                width: "100%", minHeight: 60, borderRadius: 10,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff", padding: 10, fontSize: 13, resize: "vertical",
                outline: "none", marginBottom: 16, fontFamily: "inherit",
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowNotes(true)}
              style={{
                background: "none", border: "none", color: "rgba(255,255,255,0.4)",
                fontSize: 12, cursor: "pointer", marginBottom: 16, padding: 0,
              }}
            >
              + Add a note...
            </button>
          )
        )}

        {/* Actions */}
        {status === "done" ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 20px", borderRadius: 999,
            background: "#22c55e", color: "#fff",
            fontSize: 13, fontWeight: 800, width: "fit-content",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
            Check-in saved
          </div>
        ) : status === "error" ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#fca5a5" }}>Upload failed. Try again.</span>
            <button onClick={handleSubmit} style={{
              background: "#F6B7A6", color: "#0F1B22", border: "none",
              borderRadius: 999, padding: "10px 22px", fontSize: 13, fontWeight: 800, cursor: "pointer",
            }}>
              Retry
            </button>
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!allUploaded || status === "uploading"}
            style={{
              background: allUploaded ? "#F6B7A6" : "rgba(255,255,255,0.1)",
              color: allUploaded ? "#0F1B22" : "rgba(255,255,255,0.3)",
              border: "none", borderRadius: 999, padding: "10px 22px",
              fontSize: 13, fontWeight: 800,
              cursor: allUploaded ? "pointer" : "not-allowed",
              opacity: status === "uploading" ? 0.7 : 1,
            }}
          >
            {status === "uploading" ? "Uploading..." : "Submit Check-in"}
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/chat/checkin-card.tsx
git commit -m "feat: add CheckInCard component with photo upload and pose guides"
```

---

### Task 7: PhysiqueReviewModal

**Files:**
- Create: `src/components/chat/physique-review-modal.tsx`

- [ ] **Step 1: Create the review modal**

Create `src/components/chat/physique-review-modal.tsx`:

```typescript
"use client";

import { useState, useEffect, useRef } from "react";

type Angle = "front" | "side" | "back";

interface Checkin {
  id: string;
  date: string;
  front_url: string | null;
  side_url: string | null;
  back_url: string | null;
  notes: string | null;
}

const ANGLE_TABS: { key: Angle; label: string }[] = [
  { key: "front", label: "Front" },
  { key: "side", label: "Side" },
  { key: "back", label: "Back" },
];

function getUrl(checkin: Checkin, angle: Angle): string | null {
  if (angle === "front") return checkin.front_url;
  if (angle === "side") return checkin.side_url;
  return checkin.back_url;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function PhysiqueReviewModal({ onClose }: { onClose: () => void }) {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [angle, setAngle] = useState<Angle>("front");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [comparing, setComparing] = useState(false);
  const [compareIdx, setCompareIdx] = useState(0);
  const [activePin, setActivePin] = useState<"left" | "right">("right");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/checkins")
      .then((r) => r.json())
      .then((data) => {
        const sorted = (data.checkins || []).sort(
          (a: Checkin, b: Checkin) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        setCheckins(sorted);
        if (sorted.length > 0) {
          setSelectedIdx(sorted.length - 1);
          setCompareIdx(Math.max(0, sorted.length - 2));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleThumbClick = (idx: number) => {
    if (comparing) {
      if (activePin === "left") {
        setCompareIdx(idx);
        setActivePin("right");
      } else {
        setSelectedIdx(idx);
        setActivePin("left");
      }
    } else {
      setSelectedIdx(idx);
    }
  };

  const current = checkins[selectedIdx];
  const compare = checkins[compareIdx];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.9)",
        display: "flex", flexDirection: "column",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Top bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Progress Photos</div>

          {/* Angle tabs */}
          <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.1)", borderRadius: 999, padding: 3 }}>
            {ANGLE_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setAngle(tab.key)}
                style={{
                  padding: "6px 16px", borderRadius: 999, border: "none",
                  background: angle === tab.key ? "#fff" : "transparent",
                  color: angle === tab.key ? "#0F1B22" : "rgba(255,255,255,0.6)",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {checkins.length > 0 && (
              <button
                onClick={() => { setComparing(!comparing); setActivePin("left"); }}
                style={{
                  padding: "6px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.2)",
                  background: comparing ? "#F6B7A6" : "transparent",
                  color: comparing ? "#0F1B22" : "#fff",
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}
              >
                {comparing ? "Exit Compare" : "Compare"}
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "rgba(255,255,255,0.1)", border: "none",
                color: "#fff", fontSize: 18, cursor: "pointer",
                display: "grid", placeItems: "center",
              }}
            >
              x
            </button>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          {loading ? (
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Loading...</div>
          ) : checkins.length === 0 ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 8 }}>No check-ins yet</div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
                Your coach will prompt you when it&apos;s time.
              </div>
            </div>
          ) : comparing ? (
            /* Compare mode — side by side */
            <div style={{ display: "flex", gap: 24, alignItems: "center", maxHeight: "70vh" }}>
              {[{ idx: compareIdx, label: "left", color: "#F6B7A6" }, { idx: selectedIdx, label: "right", color: "#B7DDEA" }].map(({ idx, label, color }) => {
                const c = checkins[idx];
                const url = c ? getUrl(c, angle) : null;
                return (
                  <div key={label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 8 }}>
                      {c ? formatDate(c.date) : "—"}
                    </div>
                    {url ? (
                      <img src={url} alt={`${angle} ${c?.date}`} style={{ maxHeight: "60vh", maxWidth: "40vw", borderRadius: 12, border: `2px solid ${color}` }} />
                    ) : (
                      <div style={{ width: 300, height: 400, borderRadius: 12, background: "rgba(255,255,255,0.05)", display: "grid", placeItems: "center", color: "rgba(255,255,255,0.3)" }}>
                        No photo
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Browse mode — single photo */
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 12 }}>
                {current ? formatDate(current.date) : ""}
              </div>
              {current && getUrl(current, angle) ? (
                <img src={getUrl(current, angle)!} alt={`${angle} ${current.date}`} style={{ maxHeight: "65vh", maxWidth: "50vw", borderRadius: 12 }} />
              ) : (
                <div style={{ width: 350, height: 460, borderRadius: 12, background: "rgba(255,255,255,0.05)", display: "grid", placeItems: "center", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
                  No {angle} photo
                </div>
              )}
            </div>
          )}
        </div>

        {/* Timeline scrubber */}
        {checkins.length > 0 && (
          <div style={{
            padding: "12px 24px 20px",
            borderTop: "1px solid rgba(255,255,255,0.1)",
          }}>
            <div
              ref={scrollRef}
              style={{
                display: "flex", gap: 10, overflowX: "auto",
                padding: "4px 0",
                scrollSnapType: "x mandatory",
              }}
            >
              {checkins.map((c, i) => {
                const url = getUrl(c, angle);
                const isSelected = i === selectedIdx;
                const isCompare = comparing && i === compareIdx;
                const borderColor = isSelected ? "#B7DDEA" : isCompare ? "#F6B7A6" : "transparent";

                return (
                  <div
                    key={c.id}
                    onClick={() => handleThumbClick(i)}
                    style={{
                      flexShrink: 0, scrollSnapAlign: "center",
                      cursor: "pointer", textAlign: "center",
                    }}
                  >
                    <div style={{
                      width: 56, height: 56, borderRadius: 10,
                      border: `2.5px solid ${borderColor}`,
                      overflow: "hidden",
                      background: "rgba(255,255,255,0.05)",
                    }}>
                      {url ? (
                        <img src={url} alt={c.date} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "rgba(255,255,255,0.2)", fontSize: 10 }}>
                          —
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                      {formatDate(c.date)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/chat/physique-review-modal.tsx
git commit -m "feat: add PhysiqueReviewModal with timeline scrubber and comparison"
```

---

### Task 8: Chat input dropdown + Settings update

**Files:**
- Create: `src/components/chat/chat-input-dropdown.tsx`
- Modify: `src/components/chat/chat-input.tsx`
- Modify: `src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Add "more" and "camera" icons to Icon component**

In `src/components/app/icon.tsx`, add two new cases before the `default:` case:

```typescript
    case "more":
      return (
        <svg {...props}>
          <circle cx="12" cy="5" r="1.5" fill={stroke} stroke="none" />
          <circle cx="12" cy="12" r="1.5" fill={stroke} stroke="none" />
          <circle cx="12" cy="19" r="1.5" fill={stroke} stroke="none" />
        </svg>
      );
    case "camera":
      return (
        <svg {...props}>
          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      );
```

- [ ] **Step 2: Create dropdown component**

Create `src/components/chat/chat-input-dropdown.tsx` (uses the new "more" and "camera" icons):

```typescript
"use client";

import { useState, useRef, useEffect } from "react";
import { Icon } from "@/components/app/icon";

interface ChatInputDropdownProps {
  onReviewCheckins: () => void;
}

export function ChatInputDropdown({ onReviewCheckins }: ChatInputDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: 32, height: 32, borderRadius: "50%",
          background: open ? "var(--bg-2, #f0f0f0)" : "transparent",
          border: "none", cursor: "pointer",
          display: "grid", placeItems: "center",
          color: "var(--ink-2, #6b7280)", flexShrink: 0,
        }}
      >
        <Icon name="more" size={16} />
      </button>

      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: 0,
          background: "#fff", borderRadius: 12, padding: 4,
          boxShadow: "0 4px 20px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)",
          minWidth: 180, zIndex: 50,
        }}>
          <button
            type="button"
            onClick={() => { onReviewCheckins(); setOpen(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", padding: "10px 12px", borderRadius: 8,
              border: "none", background: "transparent",
              fontSize: 13, color: "var(--ink, #0F1B22)",
              cursor: "pointer", textAlign: "left",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-2, #f5f5f5)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Icon name="camera" size={15} />
            Review Check-ins
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add dropdown to ChatInput**

Modify `src/components/chat/chat-input.tsx` — add `onReviewCheckins` prop and render the dropdown button next to the sparkle icon:

Update the props interface:

```typescript
interface ChatInputProps {
  input: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: FormEvent) => void;
  isLoading: boolean;
  onReviewCheckins?: () => void;
}
```

Add import at top:

```typescript
import { ChatInputDropdown } from "./chat-input-dropdown";
```

Inside the form, after the sparkle icon and before the input, add the dropdown:

```typescript
{onReviewCheckins && (
  <ChatInputDropdown onReviewCheckins={onReviewCheckins} />
)}
```

- [ ] **Step 3: Add check-in settings to Preferences tab**

In `src/app/dashboard/settings/page.tsx`, find the Preferences tab section (the one with distance/weight units). Add a new section below the weight unit toggle for check-in preferences.

Add imports at the top:

```typescript
import { getCheckinPreferences, saveCheckinPreferences, type CheckinPreferences } from "@/lib/checkin-preferences";
```

Add state in the component:

```typescript
const [checkinPrefs, setCheckinPrefs] = useState<CheckinPreferences>({ enabled: true, frequencyWeeks: 1 });

useEffect(() => {
  setCheckinPrefs(getCheckinPreferences());
}, []);
```

Add this section after the existing Weight unit section in the Preferences tab content:

```typescript
{/* Check-in settings */}
<div style={{ marginTop: 32 }}>
  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
    Physique Check-ins
  </div>
  <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 16 }}>
    Your coach will prompt you during chat when it&apos;s time
  </p>

  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
    <span style={{ fontSize: 13, color: "var(--ink)" }}>Enable weekly check-ins</span>
    <button
      type="button"
      onClick={() => {
        const updated = { ...checkinPrefs, enabled: !checkinPrefs.enabled };
        setCheckinPrefs(updated);
        saveCheckinPreferences(updated);
      }}
      style={{
        width: 44, height: 24, borderRadius: 999, border: "none",
        background: checkinPrefs.enabled ? "var(--coral)" : "#d1d5db",
        cursor: "pointer", position: "relative", transition: "background 0.2s",
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: "50%", background: "#fff",
        position: "absolute", top: 3,
        left: checkinPrefs.enabled ? 23 : 3,
        transition: "left 0.2s",
      }} />
    </button>
  </div>

  {checkinPrefs.enabled && (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 13, color: "var(--ink-2)" }}>Remind me every</span>
      <select
        value={checkinPrefs.frequencyWeeks}
        onChange={(e) => {
          const updated = { ...checkinPrefs, frequencyWeeks: Number(e.target.value) };
          setCheckinPrefs(updated);
          saveCheckinPreferences(updated);
        }}
        style={{
          padding: "6px 10px", borderRadius: 8, border: "1px solid var(--line)",
          fontSize: 13, background: "#fff", cursor: "pointer",
        }}
      >
        <option value={1}>1 week</option>
        <option value={2}>2 weeks</option>
        <option value={4}>4 weeks</option>
      </select>
    </div>
  )}
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/app/icon.tsx src/components/chat/chat-input-dropdown.tsx src/components/chat/chat-input.tsx src/app/dashboard/settings/page.tsx
git commit -m "feat: add chat input dropdown and check-in settings in Preferences"
```

---

### Task 9: Integration — wire everything into coach page + chat route

**Files:**
- Modify: `src/app/dashboard/coach/page.tsx`
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/lib/chat/system-prompt.ts`

- [ ] **Step 1: Add check-in tool extraction + rendering to coach page**

In `src/app/dashboard/coach/page.tsx`:

Add imports:

```typescript
import { CheckInCard } from "@/components/chat/checkin-card";
import { PhysiqueReviewModal } from "@/components/chat/physique-review-modal";
```

Add a new extraction function (after `extractBlockProposal`):

```typescript
function extractCheckinPrompt(parts: unknown[]): unknown | null {
  for (const part of parts) {
    const p = part as Record<string, unknown>;

    if (p.type === "tool-result" && p.toolName === "prompt_checkin" && p.result) {
      return p.result;
    }

    if (p.type === "tool-invocation") {
      const inv = p.toolInvocation as Record<string, unknown> | undefined;
      if (inv?.toolName === "prompt_checkin") {
        if (inv.state === "result" && inv.result) return inv.result;
        if (inv.output) return inv.output;
      }
    }

    if (p.type === "tool-prompt_checkin") {
      if (p.state === "output-available" && p.output) return p.output;
      if (p.state === "result" && p.result) return p.result;
    }

    if ((p as Record<string, unknown>).toolName === "prompt_checkin") {
      if (p.output) return p.output;
      if (p.result) return p.result;
    }
  }
  return null;
}
```

Add state for the review modal inside `CoachPage`:

```typescript
const [showReviewModal, setShowReviewModal] = useState(false);
```

In the message rendering loop, after extracting `blockData`, also extract check-in data:

```typescript
const checkinData = m.role === "assistant" ? extractCheckinPrompt(parts) : null;
```

After the BlockProposalCard rendering block, add CheckInCard rendering:

```typescript
{checkinData && (checkinData as Record<string, unknown>).type === "checkin_prompt" && (
  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
    <div style={{ width: 32, flexShrink: 0 }} />
    <div style={{ maxWidth: 560, width: "100%" }}>
      <CheckInCard data={checkinData as Parameters<typeof CheckInCard>[0]["data"]} />
    </div>
  </div>
)}
```

Update the `ChatInput` usage at the bottom to pass the review modal callback:

```typescript
<ChatInput
  input={input}
  onChange={(e) => setInput(e.target.value)}
  onSubmit={handleSubmit}
  isLoading={isLoading}
  onReviewCheckins={() => setShowReviewModal(true)}
/>

{showReviewModal && (
  <PhysiqueReviewModal onClose={() => setShowReviewModal(false)} />
)}
```

- [ ] **Step 2: Register tools in chat route**

In `src/app/api/chat/route.ts`, add imports:

```typescript
import { getCheckinHistoryTool } from "@/lib/chat/tools/get-checkin-history";
import { promptCheckinTool } from "@/lib/chat/tools/prompt-checkin";
```

Add to the `tools` object inside `streamText()`:

```typescript
get_checkin_history: getCheckinHistoryTool(userId),
prompt_checkin: promptCheckinTool(),
```

- [ ] **Step 3: Update system prompt**

In `src/lib/chat/system-prompt.ts`, add these lines to the guidelines section (after the existing regenerate_plan guidelines):

```typescript
lines.push("- You have access to physique check-in tools. Use get_checkin_history to see when the user last did a check-in.");
lines.push("- If their last check-in was more than 7 days ago (or they've never done one), suggest a check-in using prompt_checkin — but only at the start of a conversation or when discussing body composition, not every message.");
lines.push("- When prompting a check-in, give a brief motivating message like 'Time for your weekly progress photos!' or 'Let's see how things are looking this week.'");
```

- [ ] **Step 4: Run all tests to verify nothing broke**

Run: `npx vitest run __tests__/lib/training/ __tests__/lib/checkin-preferences.test.ts`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/coach/page.tsx src/app/api/chat/route.ts src/lib/chat/system-prompt.ts
git commit -m "feat: wire check-in card, review modal, and coach tools into chat"
```

---

## Summary

| Task | What it produces |
|------|-----------------|
| 1 | Migration + preferences utility with tests |
| 2 | Client-side image resize utility |
| 3 | Three anatomical SVG pose silhouettes |
| 4 | Upload, list, and latest API endpoints |
| 5 | Coach tools (get_checkin_history + prompt_checkin) |
| 6 | CheckInCard with 3 upload zones + pose guides |
| 7 | PhysiqueReviewModal with timeline + comparison |
| 8 | Chat dropdown + settings toggle/frequency |
| 9 | Integration — coach page + chat route + system prompt |
