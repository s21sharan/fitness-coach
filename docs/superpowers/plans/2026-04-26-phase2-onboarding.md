# Phase 2: Onboarding Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 9-step onboarding flow that collects the user's profile, goals, race info, training experience, availability, and integrations — then generates an AI-recommended training split. Persist all data to Supabase. Redirect users who haven't completed onboarding.

**Architecture:** Multi-step client-side form using React state, with a server action to persist all data at the end. The onboarding lives at `/onboarding` (a protected route outside the dashboard layout). An onboarding guard in the dashboard layout redirects incomplete users.

**Tech Stack:** Next.js App Router, React (useState for step management), Server Actions, Supabase, Clerk (for user ID), Tailwind CSS, shadcn/ui components

---

## File Structure

```
src/
├── app/
│   └── onboarding/
│       ├── layout.tsx                  # Minimal layout (no sidebar, just centered content)
│       ├── page.tsx                    # Onboarding page (client component, manages steps)
│       └── actions.ts                  # Server action: save profile + goals to Supabase
├── components/
│   └── onboarding/
│       ├── step-profile.tsx            # Step 1: Height, weight, age, sex
│       ├── step-body-goal.tsx          # Step 2: Gain muscle / lose weight / maintain / other
│       ├── step-emphasis.tsx           # Step 3: Body emphasis (conditional)
│       ├── step-race.tsx               # Step 4: Training for a race? (yes/no)
│       ├── step-race-details.tsx       # Step 5a: Race type, date, goal time (conditional)
│       ├── step-cardio.tsx             # Step 5b: Do you do cardio? (conditional)
│       ├── step-experience.tsx         # Step 6: Training experience
│       ├── step-availability.tsx       # Step 7: Days per week, lifting days
│       ├── step-integrations.tsx       # Step 8: Connect integrations
│       ├── step-split-result.tsx       # Step 9: AI-generated split recommendation
│       ├── onboarding-progress.tsx     # Progress bar component
│       └── option-card.tsx             # Reusable selectable card component
├── lib/
│   └── onboarding/
│       └── types.ts                    # OnboardingData type definition
__tests__/
├── lib/
│   └── onboarding/
│       └── types.test.ts              # Type validation tests
├── components/
│   └── onboarding/
│       ├── step-profile.test.tsx       # Profile step tests
│       ├── step-body-goal.test.tsx     # Body goal step tests
│       └── option-card.test.tsx        # Option card tests
└── app/
    └── onboarding/
        └── actions.test.ts            # Server action tests
```

---

### Task 1: Onboarding Data Types & Validation

**Files:**
- Create: `src/lib/onboarding/types.ts`
- Test: `__tests__/lib/onboarding/types.test.ts`

- [ ] **Step 1: Write failing test for onboarding data types**

Create `__tests__/lib/onboarding/types.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  type OnboardingData,
  BODY_GOALS,
  EMPHASIS_OPTIONS,
  RACE_TYPES,
  EXPERIENCE_LEVELS,
  CARDIO_TYPES,
  getDefaultOnboardingData,
  getVisibleSteps,
} from "@/lib/onboarding/types";

describe("OnboardingData", () => {
  it("provides correct default values", () => {
    const data = getDefaultOnboardingData();

    expect(data.height).toBe(null);
    expect(data.weight).toBe(null);
    expect(data.age).toBe(null);
    expect(data.sex).toBe(null);
    expect(data.bodyGoal).toBe(null);
    expect(data.emphasis).toBe(null);
    expect(data.trainingForRace).toBe(false);
    expect(data.raceType).toBe(null);
    expect(data.raceDate).toBe(null);
    expect(data.goalTime).toBe(null);
    expect(data.doesCardio).toBe(false);
    expect(data.cardioTypes).toEqual([]);
    expect(data.experience).toBe(null);
    expect(data.daysPerWeek).toBe(null);
    expect(data.liftingDays).toBe(null);
  });
});

describe("getVisibleSteps", () => {
  it("shows emphasis step when body goal is gain_muscle", () => {
    const data = getDefaultOnboardingData();
    data.bodyGoal = "gain_muscle";
    const steps = getVisibleSteps(data);
    expect(steps).toContain("emphasis");
  });

  it("shows emphasis step when body goal is maintain", () => {
    const data = getDefaultOnboardingData();
    data.bodyGoal = "maintain";
    const steps = getVisibleSteps(data);
    expect(steps).toContain("emphasis");
  });

  it("hides emphasis step when body goal is lose_weight", () => {
    const data = getDefaultOnboardingData();
    data.bodyGoal = "lose_weight";
    const steps = getVisibleSteps(data);
    expect(steps).not.toContain("emphasis");
  });

  it("shows race details when training for a race", () => {
    const data = getDefaultOnboardingData();
    data.trainingForRace = true;
    const steps = getVisibleSteps(data);
    expect(steps).toContain("race_details");
    expect(steps).not.toContain("cardio");
  });

  it("shows cardio step when not training for a race", () => {
    const data = getDefaultOnboardingData();
    data.trainingForRace = false;
    const steps = getVisibleSteps(data);
    expect(steps).toContain("cardio");
    expect(steps).not.toContain("race_details");
  });

  it("always includes profile, body_goal, race, experience, availability, integrations, split_result", () => {
    const data = getDefaultOnboardingData();
    const steps = getVisibleSteps(data);
    expect(steps).toContain("profile");
    expect(steps).toContain("body_goal");
    expect(steps).toContain("race");
    expect(steps).toContain("experience");
    expect(steps).toContain("availability");
    expect(steps).toContain("integrations");
    expect(steps).toContain("split_result");
  });
});

describe("Constants", () => {
  it("has all body goal options", () => {
    expect(BODY_GOALS).toEqual([
      { value: "gain_muscle", label: "Gain Muscle" },
      { value: "lose_weight", label: "Lose Weight" },
      { value: "maintain", label: "Maintain / Recomp" },
      { value: "other", label: "Other" },
    ]);
  });

  it("has all emphasis options", () => {
    expect(EMPHASIS_OPTIONS.map((o) => o.value)).toEqual([
      "shoulders", "chest", "back", "arms", "legs", "glutes", "none",
    ]);
  });

  it("has all race types grouped by category", () => {
    const runningValues = RACE_TYPES.filter((r) => r.category === "running").map((r) => r.value);
    expect(runningValues).toEqual(["5k", "10k", "half_marathon", "marathon", "ultra"]);

    const triValues = RACE_TYPES.filter((r) => r.category === "triathlon").map((r) => r.value);
    expect(triValues).toEqual(["sprint_tri", "olympic_tri", "half_ironman", "ironman"]);
  });

  it("has experience levels", () => {
    expect(EXPERIENCE_LEVELS.map((e) => e.value)).toEqual([
      "beginner", "intermediate", "advanced",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/lib/onboarding/types.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the types and constants**

Create `src/lib/onboarding/types.ts`:

```typescript
export type BodyGoal = "gain_muscle" | "lose_weight" | "maintain" | "other";
export type Emphasis = "shoulders" | "chest" | "back" | "arms" | "legs" | "glutes" | "none";
export type RaceType =
  | "5k" | "10k" | "half_marathon" | "marathon" | "ultra"
  | "sprint_tri" | "olympic_tri" | "half_ironman" | "ironman" | "other";
export type Experience = "beginner" | "intermediate" | "advanced";
export type CardioType = "running" | "cycling" | "swimming";
export type Sex = "M" | "F" | "Other";

export type StepId =
  | "profile"
  | "body_goal"
  | "emphasis"
  | "race"
  | "race_details"
  | "cardio"
  | "experience"
  | "availability"
  | "integrations"
  | "split_result";

export interface OnboardingData {
  // Step 1: Profile
  height: number | null;       // cm
  weight: number | null;       // lbs
  age: number | null;
  sex: Sex | null;

  // Step 2: Body Goal
  bodyGoal: BodyGoal | null;
  bodyGoalOther: string;

  // Step 3: Emphasis
  emphasis: Emphasis | null;

  // Step 4: Race
  trainingForRace: boolean;

  // Step 5a: Race Details
  raceType: RaceType | null;
  raceTypeOther: string;
  raceDate: string | null;     // ISO date string
  goalTime: string | null;

  // Step 5b: Cardio
  doesCardio: boolean;
  cardioTypes: CardioType[];

  // Step 6: Experience
  experience: Experience | null;

  // Step 7: Availability
  daysPerWeek: number | null;
  liftingDays: number | null;
}

export function getDefaultOnboardingData(): OnboardingData {
  return {
    height: null,
    weight: null,
    age: null,
    sex: null,
    bodyGoal: null,
    bodyGoalOther: "",
    emphasis: null,
    trainingForRace: false,
    raceType: null,
    raceTypeOther: "",
    raceDate: null,
    goalTime: null,
    doesCardio: false,
    cardioTypes: [],
    experience: null,
    daysPerWeek: null,
    liftingDays: null,
  };
}

export function getVisibleSteps(data: OnboardingData): StepId[] {
  const steps: StepId[] = ["profile", "body_goal"];

  if (data.bodyGoal === "gain_muscle" || data.bodyGoal === "maintain") {
    steps.push("emphasis");
  }

  steps.push("race");

  if (data.trainingForRace) {
    steps.push("race_details");
  } else {
    steps.push("cardio");
  }

  steps.push("experience", "availability", "integrations", "split_result");

  return steps;
}

export const BODY_GOALS: { value: BodyGoal; label: string }[] = [
  { value: "gain_muscle", label: "Gain Muscle" },
  { value: "lose_weight", label: "Lose Weight" },
  { value: "maintain", label: "Maintain / Recomp" },
  { value: "other", label: "Other" },
];

export const EMPHASIS_OPTIONS: { value: Emphasis; label: string }[] = [
  { value: "shoulders", label: "Shoulders" },
  { value: "chest", label: "Chest" },
  { value: "back", label: "Back" },
  { value: "arms", label: "Arms" },
  { value: "legs", label: "Legs" },
  { value: "glutes", label: "Glutes" },
  { value: "none", label: "None (Balanced)" },
];

export const RACE_TYPES: { value: RaceType; label: string; category: "running" | "triathlon" | "other" }[] = [
  { value: "5k", label: "5K", category: "running" },
  { value: "10k", label: "10K", category: "running" },
  { value: "half_marathon", label: "Half Marathon", category: "running" },
  { value: "marathon", label: "Marathon", category: "running" },
  { value: "ultra", label: "Ultra", category: "running" },
  { value: "sprint_tri", label: "Sprint Triathlon", category: "triathlon" },
  { value: "olympic_tri", label: "Olympic Triathlon", category: "triathlon" },
  { value: "half_ironman", label: "Half Ironman (70.3)", category: "triathlon" },
  { value: "ironman", label: "Ironman (140.6)", category: "triathlon" },
  { value: "other", label: "Other", category: "other" },
];

export const EXPERIENCE_LEVELS: { value: Experience; label: string; description: string }[] = [
  { value: "beginner", label: "Beginner", description: "Less than 1 year consistent lifting" },
  { value: "intermediate", label: "Intermediate", description: "1-3 years consistent lifting" },
  { value: "advanced", label: "Advanced", description: "3+ years consistent lifting" },
];

export const CARDIO_TYPES: { value: CardioType; label: string }[] = [
  { value: "running", label: "Running" },
  { value: "cycling", label: "Cycling" },
  { value: "swimming", label: "Swimming" },
];
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- __tests__/lib/onboarding/types.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/onboarding/ __tests__/lib/onboarding/
git commit -m "feat: add onboarding data types, constants, and step visibility logic"
```

---

### Task 2: Reusable Option Card Component

**Files:**
- Create: `src/components/onboarding/option-card.tsx`
- Test: `__tests__/components/onboarding/option-card.test.tsx`

- [ ] **Step 1: Write failing test**

Create `__tests__/components/onboarding/option-card.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OptionCard } from "@/components/onboarding/option-card";

describe("OptionCard", () => {
  it("renders label and description", () => {
    render(
      <OptionCard
        label="Gain Muscle"
        description="Build lean mass"
        selected={false}
        onClick={() => {}}
      />
    );

    expect(screen.getByText("Gain Muscle")).toBeDefined();
    expect(screen.getByText("Build lean mass")).toBeDefined();
  });

  it("shows selected state", () => {
    const { container } = render(
      <OptionCard
        label="Gain Muscle"
        selected={true}
        onClick={() => {}}
      />
    );

    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("border-black");
  });

  it("shows unselected state", () => {
    const { container } = render(
      <OptionCard
        label="Gain Muscle"
        selected={false}
        onClick={() => {}}
      />
    );

    const card = container.firstChild as HTMLElement;
    expect(card.className).not.toContain("border-black");
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(
      <OptionCard
        label="Gain Muscle"
        selected={false}
        onClick={onClick}
      />
    );

    fireEvent.click(screen.getByText("Gain Muscle"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/components/onboarding/option-card.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement the component**

Create `src/components/onboarding/option-card.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";

interface OptionCardProps {
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
}

export function OptionCard({ label, description, selected, onClick }: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border-2 p-4 text-left transition-colors",
        selected
          ? "border-black bg-gray-50"
          : "border-gray-200 hover:border-gray-300"
      )}
    >
      <span className="font-medium">{label}</span>
      {description && (
        <span className="mt-1 block text-sm text-gray-500">{description}</span>
      )}
    </button>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- __tests__/components/onboarding/option-card.test.tsx
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/ __tests__/components/onboarding/
git commit -m "feat: add reusable OptionCard component for onboarding selections"
```

---

### Task 3: Progress Bar Component

**Files:**
- Create: `src/components/onboarding/onboarding-progress.tsx`

- [ ] **Step 1: Create the progress bar**

Create `src/components/onboarding/onboarding-progress.tsx`:

```tsx
"use client";

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function OnboardingProgress({ currentStep, totalSteps }: OnboardingProgressProps) {
  const percentage = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="w-full">
      <div className="mb-2 flex justify-between text-sm text-gray-500">
        <span>Step {currentStep} of {totalSteps}</span>
        <span>{percentage}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200">
        <div
          className="h-2 rounded-full bg-black transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/onboarding/onboarding-progress.tsx
git commit -m "feat: add onboarding progress bar component"
```

---

### Task 4: Individual Step Components (Steps 1-7)

**Files:**
- Create: `src/components/onboarding/step-profile.tsx`
- Create: `src/components/onboarding/step-body-goal.tsx`
- Create: `src/components/onboarding/step-emphasis.tsx`
- Create: `src/components/onboarding/step-race.tsx`
- Create: `src/components/onboarding/step-race-details.tsx`
- Create: `src/components/onboarding/step-cardio.tsx`
- Create: `src/components/onboarding/step-experience.tsx`
- Create: `src/components/onboarding/step-availability.tsx`
- Test: `__tests__/components/onboarding/step-profile.test.tsx`
- Test: `__tests__/components/onboarding/step-body-goal.test.tsx`

- [ ] **Step 1: Write failing test for profile step**

Create `__tests__/components/onboarding/step-profile.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StepProfile } from "@/components/onboarding/step-profile";
import { getDefaultOnboardingData } from "@/lib/onboarding/types";

describe("StepProfile", () => {
  it("renders all profile fields", () => {
    render(
      <StepProfile
        data={getDefaultOnboardingData()}
        onUpdate={() => {}}
      />
    );

    expect(screen.getByLabelText("Height (cm)")).toBeDefined();
    expect(screen.getByLabelText("Weight (lbs)")).toBeDefined();
    expect(screen.getByLabelText("Age")).toBeDefined();
    expect(screen.getByText("Sex")).toBeDefined();
  });

  it("calls onUpdate when a field changes", () => {
    const onUpdate = vi.fn();
    render(
      <StepProfile
        data={getDefaultOnboardingData()}
        onUpdate={onUpdate}
      />
    );

    fireEvent.change(screen.getByLabelText("Age"), { target: { value: "25" } });
    expect(onUpdate).toHaveBeenCalledWith({ age: 25 });
  });
});
```

- [ ] **Step 2: Write failing test for body goal step**

Create `__tests__/components/onboarding/step-body-goal.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StepBodyGoal } from "@/components/onboarding/step-body-goal";
import { getDefaultOnboardingData } from "@/lib/onboarding/types";

describe("StepBodyGoal", () => {
  it("renders all body goal options", () => {
    render(
      <StepBodyGoal
        data={getDefaultOnboardingData()}
        onUpdate={() => {}}
      />
    );

    expect(screen.getByText("Gain Muscle")).toBeDefined();
    expect(screen.getByText("Lose Weight")).toBeDefined();
    expect(screen.getByText("Maintain / Recomp")).toBeDefined();
    expect(screen.getByText("Other")).toBeDefined();
  });

  it("calls onUpdate when an option is selected", () => {
    const onUpdate = vi.fn();
    render(
      <StepBodyGoal
        data={getDefaultOnboardingData()}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByText("Gain Muscle"));
    expect(onUpdate).toHaveBeenCalledWith({ bodyGoal: "gain_muscle" });
  });

  it("shows text input when Other is selected", () => {
    const data = getDefaultOnboardingData();
    data.bodyGoal = "other";
    render(
      <StepBodyGoal data={data} onUpdate={() => {}} />
    );

    expect(screen.getByPlaceholderText("Describe your goal...")).toBeDefined();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- __tests__/components/onboarding/
```

Expected: FAIL

- [ ] **Step 4: Create StepProfile component**

Create `src/components/onboarding/step-profile.tsx`:

```tsx
"use client";

import type { OnboardingData, Sex } from "@/lib/onboarding/types";
import { OptionCard } from "./option-card";

interface StepProfileProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

const sexOptions: { value: Sex; label: string }[] = [
  { value: "M", label: "Male" },
  { value: "F", label: "Female" },
  { value: "Other", label: "Other" },
];

export function StepProfile({ data, onUpdate }: StepProfileProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">About You</h2>
        <p className="mt-1 text-gray-500">Basic info to personalize your plan.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="height" className="block text-sm font-medium text-gray-700">
            Height (cm)
          </label>
          <input
            id="height"
            type="number"
            value={data.height ?? ""}
            onChange={(e) => onUpdate({ height: e.target.value ? Number(e.target.value) : null })}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-black focus:outline-none"
            placeholder="178"
          />
        </div>
        <div>
          <label htmlFor="weight" className="block text-sm font-medium text-gray-700">
            Weight (lbs)
          </label>
          <input
            id="weight"
            type="number"
            value={data.weight ?? ""}
            onChange={(e) => onUpdate({ weight: e.target.value ? Number(e.target.value) : null })}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-black focus:outline-none"
            placeholder="175"
          />
        </div>
      </div>

      <div>
        <label htmlFor="age" className="block text-sm font-medium text-gray-700">
          Age
        </label>
        <input
          id="age"
          type="number"
          value={data.age ?? ""}
          onChange={(e) => onUpdate({ age: e.target.value ? Number(e.target.value) : null })}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-black focus:outline-none"
          placeholder="25"
        />
      </div>

      <div>
        <span className="block text-sm font-medium text-gray-700">Sex</span>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {sexOptions.map((option) => (
            <OptionCard
              key={option.value}
              label={option.label}
              selected={data.sex === option.value}
              onClick={() => onUpdate({ sex: option.value })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create StepBodyGoal component**

Create `src/components/onboarding/step-body-goal.tsx`:

```tsx
"use client";

import type { OnboardingData } from "@/lib/onboarding/types";
import { BODY_GOALS } from "@/lib/onboarding/types";
import { OptionCard } from "./option-card";

interface StepBodyGoalProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export function StepBodyGoal({ data, onUpdate }: StepBodyGoalProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">What's your body goal?</h2>
        <p className="mt-1 text-gray-500">This helps us set your calorie and training targets.</p>
      </div>

      <div className="space-y-3">
        {BODY_GOALS.map((goal) => (
          <OptionCard
            key={goal.value}
            label={goal.label}
            selected={data.bodyGoal === goal.value}
            onClick={() => onUpdate({ bodyGoal: goal.value })}
          />
        ))}
      </div>

      {data.bodyGoal === "other" && (
        <div>
          <input
            type="text"
            value={data.bodyGoalOther}
            onChange={(e) => onUpdate({ bodyGoalOther: e.target.value })}
            placeholder="Describe your goal..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-black focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Create StepEmphasis component**

Create `src/components/onboarding/step-emphasis.tsx`:

```tsx
"use client";

import type { OnboardingData } from "@/lib/onboarding/types";
import { EMPHASIS_OPTIONS } from "@/lib/onboarding/types";
import { OptionCard } from "./option-card";

interface StepEmphasisProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export function StepEmphasis({ data, onUpdate }: StepEmphasisProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Any areas you want to emphasize?</h2>
        <p className="mt-1 text-gray-500">This influences your training split selection.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {EMPHASIS_OPTIONS.map((option) => (
          <OptionCard
            key={option.value}
            label={option.label}
            selected={data.emphasis === option.value}
            onClick={() => onUpdate({ emphasis: option.value })}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create StepRace component**

Create `src/components/onboarding/step-race.tsx`:

```tsx
"use client";

import type { OnboardingData } from "@/lib/onboarding/types";
import { OptionCard } from "./option-card";

interface StepRaceProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export function StepRace({ data, onUpdate }: StepRaceProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Are you training for a race?</h2>
        <p className="mt-1 text-gray-500">
          This is separate from your body goal — you can train for a race and gain muscle.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <OptionCard
          label="Yes"
          description="I have a race coming up"
          selected={data.trainingForRace === true}
          onClick={() => onUpdate({ trainingForRace: true })}
        />
        <OptionCard
          label="No"
          description="Not training for a race"
          selected={data.trainingForRace === false}
          onClick={() => onUpdate({ trainingForRace: false })}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Create StepRaceDetails component**

Create `src/components/onboarding/step-race-details.tsx`:

```tsx
"use client";

import type { OnboardingData } from "@/lib/onboarding/types";
import { RACE_TYPES } from "@/lib/onboarding/types";
import { OptionCard } from "./option-card";

interface StepRaceDetailsProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export function StepRaceDetails({ data, onUpdate }: StepRaceDetailsProps) {
  const runningRaces = RACE_TYPES.filter((r) => r.category === "running");
  const triathlonRaces = RACE_TYPES.filter((r) => r.category === "triathlon");
  const otherRaces = RACE_TYPES.filter((r) => r.category === "other");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">What race are you training for?</h2>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-500">Running</h3>
        <div className="grid grid-cols-3 gap-2">
          {runningRaces.map((race) => (
            <OptionCard
              key={race.value}
              label={race.label}
              selected={data.raceType === race.value}
              onClick={() => onUpdate({ raceType: race.value })}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-500">Triathlon</h3>
        <div className="grid grid-cols-2 gap-2">
          {triathlonRaces.map((race) => (
            <OptionCard
              key={race.value}
              label={race.label}
              selected={data.raceType === race.value}
              onClick={() => onUpdate({ raceType: race.value })}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {otherRaces.map((race) => (
          <OptionCard
            key={race.value}
            label={race.label}
            selected={data.raceType === race.value}
            onClick={() => onUpdate({ raceType: race.value })}
          />
        ))}
      </div>

      {data.raceType === "other" && (
        <input
          type="text"
          value={data.raceTypeOther}
          onChange={(e) => onUpdate({ raceTypeOther: e.target.value })}
          placeholder="What race?"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-black focus:outline-none"
        />
      )}

      <div>
        <label htmlFor="raceDate" className="block text-sm font-medium text-gray-700">
          Race date (optional)
        </label>
        <input
          id="raceDate"
          type="date"
          value={data.raceDate ?? ""}
          onChange={(e) => onUpdate({ raceDate: e.target.value || null })}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-black focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="goalTime" className="block text-sm font-medium text-gray-700">
          Goal time (optional)
        </label>
        <input
          id="goalTime"
          type="text"
          value={data.goalTime ?? ""}
          onChange={(e) => onUpdate({ goalTime: e.target.value || null })}
          placeholder="e.g. sub 4:00:00"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-black focus:outline-none"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Create StepCardio component**

Create `src/components/onboarding/step-cardio.tsx`:

```tsx
"use client";

import type { OnboardingData, CardioType } from "@/lib/onboarding/types";
import { CARDIO_TYPES } from "@/lib/onboarding/types";
import { OptionCard } from "./option-card";

interface StepCardioProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export function StepCardio({ data, onUpdate }: StepCardioProps) {
  const toggleCardioType = (type: CardioType) => {
    const current = data.cardioTypes;
    if (current.includes(type)) {
      onUpdate({ cardioTypes: current.filter((t) => t !== type), doesCardio: true });
    } else {
      onUpdate({ cardioTypes: [...current, type], doesCardio: true });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Do you do any cardio?</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <OptionCard
          label="Yes"
          selected={data.doesCardio === true}
          onClick={() => onUpdate({ doesCardio: true })}
        />
        <OptionCard
          label="No"
          selected={data.doesCardio === false && data.cardioTypes.length === 0}
          onClick={() => onUpdate({ doesCardio: false, cardioTypes: [] })}
        />
      </div>

      {data.doesCardio && (
        <div>
          <p className="mb-2 text-sm font-medium text-gray-500">What type? (select all that apply)</p>
          <div className="grid grid-cols-3 gap-3">
            {CARDIO_TYPES.map((type) => (
              <OptionCard
                key={type.value}
                label={type.label}
                selected={data.cardioTypes.includes(type.value)}
                onClick={() => toggleCardioType(type.value)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 10: Create StepExperience component**

Create `src/components/onboarding/step-experience.tsx`:

```tsx
"use client";

import type { OnboardingData } from "@/lib/onboarding/types";
import { EXPERIENCE_LEVELS } from "@/lib/onboarding/types";
import { OptionCard } from "./option-card";

interface StepExperienceProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export function StepExperience({ data, onUpdate }: StepExperienceProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">What's your training experience?</h2>
      </div>

      <div className="space-y-3">
        {EXPERIENCE_LEVELS.map((level) => (
          <OptionCard
            key={level.value}
            label={level.label}
            description={level.description}
            selected={data.experience === level.value}
            onClick={() => onUpdate({ experience: level.value })}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 11: Create StepAvailability component**

Create `src/components/onboarding/step-availability.tsx`:

```tsx
"use client";

import type { OnboardingData } from "@/lib/onboarding/types";
import { OptionCard } from "./option-card";

interface StepAvailabilityProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export function StepAvailability({ data, onUpdate }: StepAvailabilityProps) {
  const dayOptions = [3, 4, 5, 6, 7];

  const suggestedLiftingDays = () => {
    if (!data.daysPerWeek) return null;
    if (!data.trainingForRace) return data.daysPerWeek;
    if (data.daysPerWeek <= 4) return 2;
    if (data.daysPerWeek <= 5) return 3;
    return Math.min(4, data.daysPerWeek - 2);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">How many days can you train?</h2>
        <p className="mt-1 text-gray-500">Total training days per week (lifting + cardio).</p>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {dayOptions.map((days) => (
          <OptionCard
            key={days}
            label={`${days}`}
            selected={data.daysPerWeek === days}
            onClick={() => {
              const suggested = (() => {
                if (!data.trainingForRace) return days;
                if (days <= 4) return 2;
                if (days <= 5) return 3;
                return Math.min(4, days - 2);
              })();
              onUpdate({ daysPerWeek: days, liftingDays: suggested });
            }}
          />
        ))}
      </div>

      {data.daysPerWeek && data.trainingForRace && (
        <div>
          <label htmlFor="liftingDays" className="block text-sm font-medium text-gray-700">
            How many of those for lifting?
          </label>
          <input
            id="liftingDays"
            type="number"
            min={1}
            max={data.daysPerWeek}
            value={data.liftingDays ?? ""}
            onChange={(e) => onUpdate({ liftingDays: e.target.value ? Number(e.target.value) : null })}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-black focus:outline-none"
          />
          <p className="mt-1 text-sm text-gray-400">
            Suggested: {suggestedLiftingDays()} lifting days
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 12: Run tests**

```bash
npm test -- __tests__/components/onboarding/
```

Expected: ALL PASS

- [ ] **Step 13: Commit**

```bash
git add src/components/onboarding/ __tests__/components/onboarding/
git commit -m "feat: add onboarding step components (profile, goals, race, experience, availability)"
```

---

### Task 5: Integrations Step (Step 8) — Placeholder

**Files:**
- Create: `src/components/onboarding/step-integrations.tsx`

The integrations step is a placeholder for now — actual OAuth flows and credential storage are Phase 3. For now, it displays the list of integrations and lets users skip for testing.

- [ ] **Step 1: Create StepIntegrations component**

Create `src/components/onboarding/step-integrations.tsx`:

```tsx
"use client";

import type { OnboardingData } from "@/lib/onboarding/types";

interface StepIntegrationsProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

const integrations = [
  { name: "MacroFactor", description: "Nutrition tracking & macros", icon: "🍎" },
  { name: "Hevy", description: "Strength training & workouts", icon: "🏋️" },
  { name: "Strava", description: "Running, cycling & swimming", icon: "🏃" },
  { name: "Garmin", description: "Recovery, sleep & HRV", icon: "⌚" },
  { name: "Google Calendar", description: "Schedule & availability", icon: "📅" },
];

export function StepIntegrations({ data, onUpdate }: StepIntegrationsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Connect your apps</h2>
        <p className="mt-1 text-gray-500">
          Connect at least one app so Hybro can see your data. More connections = better coaching.
        </p>
      </div>

      <div className="space-y-3">
        {integrations.map((integration) => (
          <div
            key={integration.name}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{integration.icon}</span>
              <div>
                <p className="font-medium">{integration.name}</p>
                <p className="text-sm text-gray-500">{integration.description}</p>
              </div>
            </div>
            <button
              type="button"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Connect
            </button>
          </div>
        ))}
      </div>

      <p className="text-center text-sm text-gray-400">
        You can connect more apps later in Settings.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/onboarding/step-integrations.tsx
git commit -m "feat: add integrations step placeholder for onboarding"
```

---

### Task 6: Split Result Step (Step 9) — Placeholder

**Files:**
- Create: `src/components/onboarding/step-split-result.tsx`

The actual AI split generation is Phase 4. For now, this step shows a hardcoded split recommendation based on the user's inputs using simple logic (not Claude).

- [ ] **Step 1: Create StepSplitResult component**

Create `src/components/onboarding/step-split-result.tsx`:

```tsx
"use client";

import type { OnboardingData } from "@/lib/onboarding/types";

interface StepSplitResultProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

function recommendSplit(data: OnboardingData): { split: string; reasoning: string; schedule: string[] } {
  const days = data.daysPerWeek ?? 4;
  const isRacing = data.trainingForRace;
  const emphasis = data.emphasis;
  const experience = data.experience;

  if (isRacing) {
    const liftDays = data.liftingDays ?? 3;
    if (liftDays <= 2) {
      return {
        split: "Full Body + Race Prep",
        reasoning: `With ${liftDays} lifting days alongside race training, full body sessions maintain strength efficiently.`,
        schedule: generateHybridSchedule(days, liftDays, "Full Body"),
      };
    }
    return {
      split: "Upper/Lower + Race Prep",
      reasoning: `${liftDays} lifting days with race training works well with an upper/lower split for balanced strength.`,
      schedule: generateHybridSchedule(days, liftDays, "Upper/Lower"),
    };
  }

  if (days <= 3) {
    return {
      split: "Full Body",
      reasoning: "With 3 training days, full body gives you the highest frequency per muscle group.",
      schedule: ["Full Body", "Rest", "Full Body", "Rest", "Full Body", "Rest", "Rest"],
    };
  }

  if (days === 4) {
    if (experience === "advanced") {
      return {
        split: "PHUL",
        reasoning: "4 days with advanced experience — PHUL combines power and hypertrophy for continued progress.",
        schedule: ["Upper Power", "Lower Power", "Rest", "Upper Hypertrophy", "Lower Hypertrophy", "Rest", "Rest"],
      };
    }
    return {
      split: "Upper / Lower",
      reasoning: "4 days is the sweet spot for upper/lower — good frequency, good recovery.",
      schedule: ["Upper", "Lower", "Rest", "Upper", "Lower", "Rest", "Rest"],
    };
  }

  // 5-6 days
  if (emphasis === "shoulders" || emphasis === "arms") {
    return {
      split: "Arnold Split",
      reasoning: `With ${emphasis} emphasis, the Arnold split gives shoulders and arms a dedicated day for extra volume.`,
      schedule: ["Chest + Back", "Shoulders + Arms", "Legs", "Chest + Back", "Shoulders + Arms", "Legs", "Rest"],
    };
  }

  return {
    split: "Push / Pull / Legs",
    reasoning: `${days} days with balanced emphasis — PPL is the gold standard for well-rounded muscle growth.`,
    schedule: ["Push", "Pull", "Legs", "Rest", "Push", "Pull", "Rest"],
  };
}

function generateHybridSchedule(totalDays: number, liftDays: number, liftType: string): string[] {
  const schedule = Array(7).fill("Rest");
  const liftLabels = liftType === "Full Body"
    ? Array(liftDays).fill("Full Body")
    : ["Upper", "Lower", "Upper", "Lower"].slice(0, liftDays);

  const cardioDays = totalDays - liftDays;
  const cardioLabels = ["Easy Run (Zone 2)", "Intervals", "Long Run", "Easy Run (Zone 2)"].slice(0, cardioDays);

  // Interleave: lift and cardio on alternating days
  let li = 0, ci = 0;
  for (let d = 0; d < 7 && (li < liftLabels.length || ci < cardioLabels.length); d++) {
    if (li < liftLabels.length && (d % 2 === 0 || ci >= cardioLabels.length)) {
      schedule[d] = liftLabels[li++];
    } else if (ci < cardioLabels.length) {
      schedule[d] = cardioLabels[ci++];
    }
  }

  return schedule;
}

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function StepSplitResult({ data }: StepSplitResultProps) {
  const { split, reasoning, schedule } = recommendSplit(data);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Your Recommended Split</h2>
        <p className="mt-1 text-gray-500">Based on your goals, experience, and availability.</p>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-xl font-bold">{split}</h3>
        <p className="mt-2 text-gray-600">{reasoning}</p>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <h3 className="mb-4 text-sm font-medium text-gray-500">Your Week</h3>
        <div className="grid grid-cols-7 gap-2">
          {schedule.map((session, i) => (
            <div
              key={i}
              className={`flex flex-col items-center rounded-lg border p-3 ${
                session === "Rest" ? "bg-gray-50 text-gray-400" : "bg-white"
              }`}
            >
              <span className="text-xs text-gray-500">{dayNames[i]}</span>
              <span className="mt-1 text-center text-xs font-medium">{session}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/onboarding/step-split-result.tsx
git commit -m "feat: add split recommendation step with basic decision logic"
```

---

### Task 7: Server Action — Save Onboarding Data

**Files:**
- Create: `src/app/onboarding/actions.ts`
- Test: `__tests__/app/onboarding/actions.test.ts`

- [ ] **Step 1: Write failing test**

Create `__tests__/app/onboarding/actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Clerk
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(() => Promise.resolve({ userId: "test-user-123" })),
}));

// Mock Supabase
const mockUpsert = vi.fn(() => Promise.resolve({ error: null }));
const mockUpdate = vi.fn(() => ({
  eq: vi.fn(() => Promise.resolve({ error: null })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({
    from: (table: string) => ({
      upsert: mockUpsert,
      update: mockUpdate,
    }),
  }),
}));

describe("saveOnboardingData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves profile and goals to Supabase", async () => {
    const { saveOnboardingData } = await import("@/app/onboarding/actions");

    const result = await saveOnboardingData({
      height: 178,
      weight: 175,
      age: 25,
      sex: "M",
      bodyGoal: "gain_muscle",
      bodyGoalOther: "",
      emphasis: "shoulders",
      trainingForRace: false,
      raceType: null,
      raceTypeOther: "",
      raceDate: null,
      goalTime: null,
      doesCardio: true,
      cardioTypes: ["running"],
      experience: "intermediate",
      daysPerWeek: 5,
      liftingDays: 5,
    });

    expect(result.success).toBe(true);
    expect(mockUpsert).toHaveBeenCalledTimes(2); // profile + goals
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/app/onboarding/actions.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement the server action**

Create `src/app/onboarding/actions.ts`:

```typescript
"use server";

import { auth } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";
import type { OnboardingData } from "@/lib/onboarding/types";

export async function saveOnboardingData(data: OnboardingData) {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  const supabase = createServerClient();

  // Upsert user profile
  const { error: profileError } = await supabase.from("user_profiles").upsert(
    {
      user_id: userId,
      height: data.height,
      weight: data.weight,
      age: data.age,
      sex: data.sex,
      training_experience: data.experience,
    },
    { onConflict: "user_id" }
  );

  if (profileError) {
    console.error("Failed to save profile:", profileError);
    return { success: false, error: "Failed to save profile" };
  }

  // Upsert user goals
  const { error: goalsError } = await supabase.from("user_goals").upsert(
    {
      user_id: userId,
      body_goal: data.bodyGoal!,
      body_goal_other: data.bodyGoalOther || null,
      emphasis: data.emphasis,
      training_for_race: data.trainingForRace,
      race_type: data.raceType,
      race_type_other: data.raceTypeOther || null,
      race_date: data.raceDate,
      goal_time: data.goalTime,
      does_cardio: data.doesCardio,
      cardio_types: data.cardioTypes.length > 0 ? data.cardioTypes : null,
      days_per_week: data.daysPerWeek!,
      lifting_days: data.liftingDays,
    },
    { onConflict: "user_id" }
  );

  if (goalsError) {
    console.error("Failed to save goals:", goalsError);
    return { success: false, error: "Failed to save goals" };
  }

  // Mark onboarding as completed
  const { error: userError } = await supabase
    .from("users")
    .update({ onboarding_completed: true })
    .eq("id", userId);

  if (userError) {
    console.error("Failed to update user:", userError);
    return { success: false, error: "Failed to update user" };
  }

  return { success: true };
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- __tests__/app/onboarding/actions.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/onboarding/actions.ts __tests__/app/onboarding/actions.test.ts
git commit -m "feat: add server action to save onboarding data to Supabase"
```

---

### Task 8: Onboarding Page — Wire It All Together

**Files:**
- Create: `src/app/onboarding/layout.tsx`
- Create: `src/app/onboarding/page.tsx`

- [ ] **Step 1: Create onboarding layout (no sidebar)**

Create `src/app/onboarding/layout.tsx`:

```tsx
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Create the onboarding page**

Create `src/app/onboarding/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  type OnboardingData,
  type StepId,
  getDefaultOnboardingData,
  getVisibleSteps,
} from "@/lib/onboarding/types";
import { saveOnboardingData } from "./actions";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { StepProfile } from "@/components/onboarding/step-profile";
import { StepBodyGoal } from "@/components/onboarding/step-body-goal";
import { StepEmphasis } from "@/components/onboarding/step-emphasis";
import { StepRace } from "@/components/onboarding/step-race";
import { StepRaceDetails } from "@/components/onboarding/step-race-details";
import { StepCardio } from "@/components/onboarding/step-cardio";
import { StepExperience } from "@/components/onboarding/step-experience";
import { StepAvailability } from "@/components/onboarding/step-availability";
import { StepIntegrations } from "@/components/onboarding/step-integrations";
import { StepSplitResult } from "@/components/onboarding/step-split-result";

const stepComponents: Record<
  StepId,
  React.ComponentType<{ data: OnboardingData; onUpdate: (updates: Partial<OnboardingData>) => void }>
> = {
  profile: StepProfile,
  body_goal: StepBodyGoal,
  emphasis: StepEmphasis,
  race: StepRace,
  race_details: StepRaceDetails,
  cardio: StepCardio,
  experience: StepExperience,
  availability: StepAvailability,
  integrations: StepIntegrations,
  split_result: StepSplitResult,
};

export default function OnboardingPage() {
  const router = useRouter();
  const [data, setData] = useState<OnboardingData>(getDefaultOnboardingData());
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleSteps = getVisibleSteps(data);
  const currentStepId = visibleSteps[stepIndex];
  const StepComponent = stepComponents[currentStepId];
  const isLastStep = stepIndex === visibleSteps.length - 1;
  const isFirstStep = stepIndex === 0;

  const handleUpdate = (updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const handleNext = async () => {
    if (isLastStep) {
      setSaving(true);
      setError(null);
      const result = await saveOnboardingData(data);
      setSaving(false);

      if (result.success) {
        router.push("/dashboard");
      } else {
        setError(result.error ?? "Something went wrong");
      }
      return;
    }

    // Recalculate visible steps after data change, then advance
    const nextSteps = getVisibleSteps(data);
    const nextIndex = Math.min(stepIndex + 1, nextSteps.length - 1);
    setStepIndex(nextIndex);
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setStepIndex(stepIndex - 1);
    }
  };

  return (
    <div className="space-y-8">
      <OnboardingProgress
        currentStep={stepIndex + 1}
        totalSteps={visibleSteps.length}
      />

      <StepComponent data={data} onUpdate={handleUpdate} />

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={handleBack}
          disabled={isFirstStep}
          className="rounded-lg border border-gray-300 px-6 py-2 font-medium disabled:opacity-30"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={saving}
          className="rounded-lg bg-black px-6 py-2 font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? "Saving..." : isLastStep ? "Finish" : "Next"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/onboarding/
git commit -m "feat: add onboarding page with multi-step flow and data persistence"
```

---

### Task 9: Onboarding Guard — Redirect Incomplete Users

**Files:**
- Modify: `src/app/dashboard/layout.tsx`
- Modify: `src/app/page.tsx` (landing page)
- Modify: `src/middleware.ts`

- [ ] **Step 1: Update middleware to allow /onboarding as a protected (non-public) route**

Read and modify `src/middleware.ts` — add `/onboarding` to the route patterns but NOT as a public route (it requires auth). The current middleware already handles this correctly — `/onboarding` is not in `isPublicRoute`, so Clerk will require auth. No changes needed to middleware.

- [ ] **Step 2: Update dashboard layout to check onboarding status**

Read and modify `src/app/dashboard/layout.tsx`:

```tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (userId) {
    const supabase = createServerClient();
    const { data: user } = await supabase
      .from("users")
      .select("onboarding_completed")
      .eq("id", userId)
      .single();

    if (!user || !user.onboarding_completed) {
      redirect("/onboarding");
    }
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update landing page to also redirect to onboarding if needed**

Read and modify `src/app/page.tsx` — the current landing page redirects authenticated users to `/dashboard`. The dashboard layout will then handle the onboarding redirect. No changes needed here.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/layout.tsx
git commit -m "feat: add onboarding guard to redirect incomplete users from dashboard"
```

---

## Phase 2 Summary

After completing all 9 tasks, you have:

- Onboarding data types with step visibility logic (conditional steps)
- Reusable OptionCard component for selections
- Progress bar component
- 10 step components covering all onboarding inputs
- Server action that persists profile + goals to Supabase
- Multi-step onboarding page at `/onboarding`
- Onboarding guard that redirects users who haven't completed onboarding
- Basic split recommendation logic (will be replaced by Claude in Phase 4)

**What the user experiences:**
1. Sign up → redirected to `/onboarding`
2. Walk through 7-9 steps (conditional based on answers)
3. See recommended training split
4. Click "Finish" → data saved → redirected to `/dashboard`

**Next:** Phase 3 (Integrations) wires up MacroFactor, Hevy, Strava, and Garmin data syncing.
