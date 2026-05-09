# UI Redesign — Pastel Fitness Aesthetic

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite every app surface (dashboard, chat, plan, review, settings, onboarding, sidebar, topbar) to match the Claude Design mockup's pastel fitness aesthetic — powder-blue background, coral/mint/sky/lemon accents, Plus Jakarta Sans typography, animated rings/sparklines/bars/heatmap, and Cal AI-style one-question-per-screen onboarding.

**Architecture:** The design uses a shared CSS token file + shared React components (Icon, Ring, Sparkline, Bars, MacroDonut, Heatmap, BrandMark) across all screens. We keep the existing Next.js App Router structure and page files — only rewriting the component internals and styles. A new `src/components/app/` directory holds the shared design-system components. Each page's components get rewritten to match the design pixel-for-pixel.

**Tech Stack:** Next.js 16 App Router, TypeScript, CSS (custom properties + utility classes), Plus Jakarta Sans font (already loaded), React 19. No framer-motion needed — animations are CSS-only (keyframes for rings, sparklines, typing dots, floating blobs).

**Design source files:** `/tmp/design2/hybro/project/` — read `tokens.css`, `app/screens/shared.jsx`, `app/screens/dashboard.jsx`, `app/screens/screens.jsx` for exact styles, colors, and component structure.

---

## File Structure

### New files to create

| File | Purpose |
|------|---------|
| `src/components/app/tokens.css` | Design tokens — CSS custom properties for the pastel palette, radii, brand colors, animations, common classes (`.card`, `.eyebrow`, `.btn-ink`, `.btn-coral`, `.btn-ghost`, `.blob`, `.app-shell`, `.sb-*`, `.tb-*`) |
| `src/components/app/icon.tsx` | SVG icon component — 30+ inline SVG icons (home, plan, chat, review, settings, bell, search, lift, run, swim, flame, heart, moon, check, send, zap, sparkle, etc.) |
| `src/components/app/sidebar.tsx` | New sidebar — brand mark, nav links with active state, "Today's pulse" mini-stats, user footer. Replaces existing `src/components/sidebar.tsx` |
| `src/components/app/topbar.tsx` | New topbar — eyebrow subtitle + title, search bar, bell icon, avatar. Replaces existing `src/components/topbar.tsx` |
| `src/components/app/ring.tsx` | Animated activity ring (SVG conic progress), TripleRing (3 stacked rings) |
| `src/components/app/sparkline.tsx` | Animated SVG sparkline chart with gradient fill and draw-in animation |
| `src/components/app/bars.tsx` | Animated SVG bar chart with grow-in animation |
| `src/components/app/macro-donut.tsx` | Macro donut chart (protein/carbs/fat segments) |
| `src/components/app/heatmap.tsx` | Calendar heatmap (14-20 week grid) |
| `src/components/app/brand-mark.tsx` | Integration brand icons — MacroFactor, Hevy, Strava, Garmin, Google Cal, Apple Health, Whoop with real brand colors and SVG logos |
| `src/components/app/pulse-pill.tsx` | Small stat pill for sidebar (label + value with toned background) |

### Files to rewrite (keep path, replace contents)

| File | What changes |
|------|-------------|
| `src/components/sidebar.tsx` | Re-export from `app/sidebar.tsx` or replace with new design |
| `src/components/topbar.tsx` | Re-export from `app/topbar.tsx` or replace with new design |
| `src/components/dashboard/today-card.tsx` | Coral gradient hero card with ring, blobs, start workout CTA |
| `src/components/dashboard/sync-status.tsx` | Horizontal sync bar with brand marks and pulse dot |
| `src/components/dashboard/calories-card.tsx` | Macro donut stat card |
| `src/components/dashboard/weight-card.tsx` | Weight sparkline stat card (mint background) |
| `src/components/dashboard/recovery-card.tsx` | Recovery/HRV sparkline stat card (sky background) |
| `src/app/dashboard/page.tsx` | Full V1 dashboard: SyncBar, TodayCard, WeekStrip, 3 stat cards, CoachNudge |
| `src/app/dashboard/layout.tsx` | Use new sidebar + app-shell grid layout |
| `src/components/plan/day-card.tsx` | Tall day column with icon, exercises list, done/active badges |
| `src/components/plan/plan-header.tsx` | Integrated into topbar with week nav buttons |
| `src/components/plan/week-strip.tsx` | 7-column grid of day cards |
| `src/components/plan/adjustment-banner.tsx` | Dark gradient banner with sparkle icon, approve/reject |
| `src/app/dashboard/plan/page.tsx` | Full plan screen with adjustment banner, week grid, volume/cardio charts |
| `src/components/chat/message-bubble.tsx` | Dark user bubbles, white coach bubbles, tool pills, action buttons, meal cards |
| `src/components/chat/chat-input.tsx` | Pill input with sparkle icon, mic button, coral send button |
| `src/components/chat/suggested-prompts.tsx` | Sidebar context panel with live stats + prompt cards |
| `src/app/dashboard/chat/page.tsx` | Two-column layout: chat thread + context sidebar |
| `src/components/review/week-summary.tsx` | Gradient hero card with score ring |
| `src/components/review/stat-card.tsx` | Colored stat cards (coral/mint/sky/lemon) with delta |
| `src/app/dashboard/review/page.tsx` | Full review: hero, 4 stat cards, load chart, PR bars, heatmap |
| `src/components/settings/integration-card.tsx` | Card with brand mark, connected badge, sync/disconnect buttons |
| `src/app/dashboard/settings/page.tsx` | Two-column: settings nav + integration list with header card |
| `src/components/onboarding/onboarding-progress.tsx` | Segmented bar (filled/active/empty segments) |
| `src/components/onboarding/option-card.tsx` | Pastel cards with emoji, check badge, lift-on-select animation |
| `src/components/onboarding/step-profile.tsx` | Cal AI style — big title, 2x2 field grid |
| `src/components/onboarding/step-body-goal.tsx` | 3 large option cards + custom goal dashed button |
| `src/components/onboarding/step-emphasis.tsx` | 4x2 grid of emoji option cards |
| `src/components/onboarding/step-experience.tsx` | 2x2 grid of large option cards |
| `src/components/onboarding/step-availability.tsx` | Number pills + slider for lift/cardio split |
| `src/components/onboarding/step-integrations.tsx` | 2x2 grid with brand marks and connect status |
| `src/components/onboarding/step-split-result.tsx` | Dark card with 7-day split preview |
| `src/app/onboarding/page.tsx` | OnboardingShell wrapper with blobs, progress, back/next footer |
| `src/app/onboarding/layout.tsx` | Full-height layout with bg color |

---

## Tasks

### Task 1: Design tokens CSS + Icon component

**Files:**
- Create: `src/components/app/tokens.css`
- Create: `src/components/app/icon.tsx`

- [ ] **Step 1: Create tokens.css**

Copy the exact CSS from the design file `/tmp/design2/hybro/project/app/tokens.css` into `src/components/app/tokens.css`. This includes:
- All CSS custom properties (`:root` block with `--bg`, `--coral`, `--mint`, `--sky`, `--lemon`, brand colors, radii)
- Common classes: `.card`, `.card-soft`, `.eyebrow`, `.h-title`, `.btn-ink`, `.btn-coral`, `.btn-ghost`, `.blob`
- Animation keyframes: `pulse-dot`, `draw-line`, `ring-fill`, `count-in`, `float-1`, `float-2`, `shimmer`, `typing`
- `.animated-ring` styles
- `.app-shell`, `.sb-*` (sidebar), `.tb-*` (topbar), `.main` layout classes

Prefix nothing — these class names are only used inside the app shell, not on the landing page.

- [ ] **Step 2: Create icon.tsx**

Convert the `Icon` component from `shared.jsx` to TypeScript. It's a switch-based SVG icon renderer with ~30 icons. Each case returns an inline `<svg>` with paths. Export as named export.

```tsx
// src/components/app/icon.tsx
"use client";

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: string;
  size?: number;
}

export function Icon({ name, size = 18, ...rest }: IconProps) {
  const stroke = "currentColor";
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
    strokeWidth: 2, stroke, ...rest };
  switch (name) {
    case 'home': return <svg {...props}><path d="M3 11l9-8 9 8M5 10v10h14V10"/></svg>;
    // ... all 30+ icons from shared.jsx
  }
}
```

- [ ] **Step 3: Import tokens.css in the dashboard layout**

In `src/app/dashboard/layout.tsx`, add `import "@/components/app/tokens.css"`. This loads the design tokens for all dashboard pages.

- [ ] **Step 4: Commit**

```
feat: add design token CSS and Icon component for app redesign
```

---

### Task 2: Shared data-viz components (Ring, Sparkline, Bars, MacroDonut, Heatmap, BrandMark, PulsePill)

**Files:**
- Create: `src/components/app/ring.tsx`
- Create: `src/components/app/sparkline.tsx`
- Create: `src/components/app/bars.tsx`
- Create: `src/components/app/macro-donut.tsx`
- Create: `src/components/app/heatmap.tsx`
- Create: `src/components/app/brand-mark.tsx`
- Create: `src/components/app/pulse-pill.tsx`

- [ ] **Step 1: Create ring.tsx**

Port `Ring` and `TripleRing` from `shared.jsx`. Ring renders an SVG with two circles (track + progress) using `strokeDasharray`/`strokeDashoffset`. TripleRing nests 3 Ring components at decreasing sizes. TypeScript with proper interfaces.

- [ ] **Step 2: Create sparkline.tsx**

Port `Sparkline` from `shared.jsx`. Renders SVG with gradient fill path + animated stroke path (using `draw-line` keyframe) + endpoint dot. Takes `points`, `width`, `height`, `color` props.

- [ ] **Step 3: Create bars.tsx**

Port `Bars` from `shared.jsx`. Renders SVG bar chart with animated height (using `<animate>` elements). Takes `data` array with `{l, v, active?}`, `color`, `width`, `height` props.

- [ ] **Step 4: Create macro-donut.tsx**

Port `MacroDonut` from `shared.jsx`. Multi-segment donut chart for protein/carbs/fat. Uses `strokeDasharray` segments on a circle. Center text shows total kcal.

- [ ] **Step 5: Create heatmap.tsx**

Port `Heatmap` from `shared.jsx`. Calendar heatmap grid — generates random data for `weeks` columns × 7 rows. Each cell is a colored `<rect>` with staggered fade-in animation.

- [ ] **Step 6: Create brand-mark.tsx**

Port `BrandMark` from `shared.jsx`. Renders integration logos — Strava (real SVG path), Garmin (mountain SVG), Apple (apple SVG), Google Cal (number "31"), and letter marks for MacroFactor (M), Hevy (H), Whoop (W) with their brand colors.

- [ ] **Step 7: Create pulse-pill.tsx**

Port `PulsePill` from `shared.jsx`. Small horizontal stat pill with label + value + toned background. Used in sidebar.

- [ ] **Step 8: Commit**

```
feat: add shared data-viz components (Ring, Sparkline, Bars, Donut, Heatmap, BrandMark)
```

---

### Task 3: Sidebar + Topbar redesign

**Files:**
- Rewrite: `src/components/sidebar.tsx`
- Rewrite: `src/components/topbar.tsx`
- Modify: `src/app/dashboard/layout.tsx`

- [ ] **Step 1: Rewrite sidebar.tsx**

Replace the existing sidebar with the design's sidebar. It uses:
- `.sb` class (frosted glass, border-right)
- Brand mark (dark rounded square with coral H SVG)
- "Workspace" section label
- 5 nav links: Today (home), My Plan (plan), Coach (chat) with "AI" badge, Weekly Review (review), Settings (settings)
- Active link = dark bg + white text + coral icon
- "Today's pulse" section with 3 PulsePill components (Recovery 78, Calories 1,847, Sleep 7h 12m)
- User footer with avatar gradient + name + settings icon
- Accept `active` prop (string matching route key)

Use the `Icon` component for all icons. Use `PulsePill` for the sidebar stats. Use CSS classes from `tokens.css`.

- [ ] **Step 2: Rewrite topbar.tsx**

Replace the existing topbar with the design's topbar:
- Left: eyebrow subtitle (uppercase, muted) + title (22px, 800 weight)
- Center: search bar (pill input with search icon, placeholder "Ask your coach or search...")
- Right: optional custom content + bell icon (with coral notification dot) + avatar circle
- Accept `title`, `subtitle`, `right` props

- [ ] **Step 3: Update dashboard layout.tsx**

Change the layout to use the `.app-shell` CSS grid (248px sidebar + 1fr content). Import `tokens.css`. Render the new `Sidebar` and wrap children in the flex column with `Topbar`. Determine active sidebar item from the current pathname.

Key structure:
```tsx
<div className="app-shell">
  <Sidebar active={activeKey} />
  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
    {/* Topbar rendered by each page, or as a slot */}
    {children}
  </div>
</div>
```

- [ ] **Step 4: Commit**

```
feat: redesign sidebar and topbar with pastel theme
```

---

### Task 4: Dashboard home page (V1 — today-first, airy)

**Files:**
- Rewrite: `src/components/dashboard/today-card.tsx` — coral gradient hero card
- Rewrite: `src/components/dashboard/sync-status.tsx` — sync bar with brand marks
- Rewrite: `src/components/dashboard/calories-card.tsx` — macro donut stat card
- Rewrite: `src/components/dashboard/weight-card.tsx` — weight sparkline (mint)
- Rewrite: `src/components/dashboard/recovery-card.tsx` — HRV sparkline (sky)
- Create: `src/components/dashboard/week-strip-home.tsx` — 7-day strip for dashboard
- Create: `src/components/dashboard/coach-nudge.tsx` — coach suggestion card
- Rewrite: `src/app/dashboard/page.tsx` — assemble all components

- [ ] **Step 1: Rewrite sync-status.tsx**

Horizontal bar: pulsing green dot + "All synced" + 5 small brand marks (22px) + "Last sync 2 min ago" + "Manage" ghost button. Use classes: rounded-18, frosted glass bg, flex layout.

- [ ] **Step 2: Rewrite today-card.tsx**

Coral gradient hero card with:
- Two floating `.blob` divs (white + lemon) with float animations
- Grid: left copy (eyebrow date, h1 title "Push Day · Chest + Shoulders", description paragraph, button row: "Start workout" btn-ink + "Ask coach" btn-ghost + "Recovery 78" pill) + right Ring (140px, 8/12 sets)
- Match the design's exact styles from `TodayCardV1` in `dashboard.jsx`

- [ ] **Step 3: Create week-strip-home.tsx**

7-column grid of day cards for the dashboard. Each card: day abbreviation, type icon + label, done checkmark (green), active "NOW" badge. Active day = dark bg, elevated shadow, translateY(-3px).

- [ ] **Step 4: Rewrite calories-card.tsx**

StatCard wrapper with "Macros" label, "2,140 / 2,400" value, MacroDonut (120px) + legend (3 rows: Protein/Carbs/Fat with color dots and values).

- [ ] **Step 5: Rewrite weight-card.tsx**

StatCard with mint background. "Weight" label, "183.2" value, "lb · 7d" sub. Sparkline (green stroke). "↓ 1.9 lb · on track for cut" footer.

- [ ] **Step 6: Rewrite recovery-card.tsx**

StatCard with sky background. "Recovery" label, "78" value, "HRV · 7-day" sub. Sparkline (dark teal stroke). "↑ trending up · ready to push" footer.

- [ ] **Step 7: Create coach-nudge.tsx**

Card with: coach avatar (dark circle "H") + pulsing green dot timestamp + message with bold data points + "See meals" coral button + "Ignore" ghost button.

- [ ] **Step 8: Rewrite dashboard page.tsx**

Assemble: `<Topbar title="Today" subtitle="Friday · May 1, 2026"/>` then `<div className="main">` containing SyncBar, TodayCard, "This week" eyebrow + WeekStripHome, 3-column stat grid (macros 1.4fr, weight 1fr, recovery 1fr), CoachNudge.

- [ ] **Step 9: Commit**

```
feat: redesign dashboard home with coral hero, macro donut, sparklines, coach nudge
```

---

### Task 5: Chat page redesign

**Files:**
- Rewrite: `src/components/chat/message-bubble.tsx`
- Rewrite: `src/components/chat/chat-input.tsx`
- Rewrite: `src/components/chat/suggested-prompts.tsx`
- Create: `src/components/chat/context-panel.tsx` — right sidebar with live stats
- Rewrite: `src/app/dashboard/chat/page.tsx`

- [ ] **Step 1: Rewrite message-bubble.tsx**

Match the design: user messages = dark (ink bg, white text, rounded with flat top-right), coach messages = white bg with shadow, flat top-left. Support:
- `tools` array → coral-soft pills with plug icon ("Read from Garmin")
- `actions` array → coral/ghost button row
- `meals` kind → mint-soft meal cards with emoji, title, macros, "Add" button
- Typing indicator = 3 animated dots

- [ ] **Step 2: Rewrite chat-input.tsx**

Pill-shaped input bar: sparkle icon (coral) + text input + mic button + coral send button. Frosted glass bg with border-top.

- [ ] **Step 3: Create context-panel.tsx**

Right sidebar (280px, border-left):
- "Live context" section with ContextRow components (HRV, Sleep, Calories, Protein, Sets) — each a small card with label + value + sub text, coral-soft bg for warning values
- "Try asking" section with 4 prompt cards (emoji + text, white bg, border, rounded)

- [ ] **Step 4: Rewrite suggested-prompts.tsx**

Convert to the 4 emoji prompt cards shown in the design: "Plan my week", "What should I eat?", "Why is bench stalling?", "Am I overtraining?"

- [ ] **Step 5: Rewrite chat page.tsx**

Two-column layout (1fr + 280px): left = chat thread (centered max-width 680px, scrollable) + input bar at bottom. Right = ContextPanel. Topbar: title="Coach", subtitle="● Online · sees your data".

Preserve the existing `useChat` streaming logic and message fetching — only change the visual rendering.

- [ ] **Step 6: Commit**

```
feat: redesign chat page with context sidebar, tool pills, and meal cards
```

---

### Task 6: Plan page redesign

**Files:**
- Rewrite: `src/components/plan/day-card.tsx`
- Rewrite: `src/components/plan/week-strip.tsx`
- Rewrite: `src/components/plan/adjustment-banner.tsx`
- Rewrite: `src/components/plan/plan-header.tsx`
- Rewrite: `src/app/dashboard/plan/page.tsx`

- [ ] **Step 1: Rewrite adjustment-banner.tsx**

Dark gradient card with: coral blob overlay, sparkle icon in coral square, "Coach proposal · awaiting approval" eyebrow (coral text), description with bold highlights, Reject ghost button + "Approve · 2 changes" coral button.

- [ ] **Step 2: Rewrite day-card.tsx**

Tall column card (min-height 240px) with: day/date header, done checkmark or TODAY badge, type icon (lift/run/swim/rest) in colored rounded square, session label, duration, exercise list (· prefixed items, max 4 shown + "+N more").

Active day = colored background matching type, elevated shadow, translateY(-4px).

- [ ] **Step 3: Rewrite week-strip.tsx**

7-column CSS grid of DayCard components. No changes to data flow — just visual update.

- [ ] **Step 4: Rewrite plan-header.tsx**

Integrate week navigation into the Topbar's `right` prop: prev/next ghost buttons + "This week" ghost button.

- [ ] **Step 5: Rewrite plan page.tsx**

Layout: Topbar (title="My Plan", subtitle="Week of Apr 27 — May 3", right=week nav buttons) → main area with: AdjustmentBanner, WeekStrip, 2-column grid (weekly volume Bars chart + cardio load Sparkline).

Preserve existing data fetching from `/api/plan`.

- [ ] **Step 6: Commit**

```
feat: redesign plan page with day columns, adjustment banner, volume charts
```

---

### Task 7: Review page redesign

**Files:**
- Rewrite: `src/components/review/week-summary.tsx`
- Rewrite: `src/components/review/stat-card.tsx`
- Rewrite: `src/app/dashboard/review/page.tsx`

- [ ] **Step 1: Rewrite week-summary.tsx**

Gradient hero card (mint → sky) with floating white blob:
- Left: eyebrow "This week's verdict", h1 "Strong week. Keep this rhythm.", description paragraph
- Right: Ring (140px, value=0.92) showing score "92"

- [ ] **Step 2: Rewrite stat-card.tsx**

Colored stat card with: eyebrow label, large value + delta badge, sub text. Accept `tone` prop for background color (coral/mint/sky/lemon).

- [ ] **Step 3: Rewrite review page.tsx**

Layout: Topbar (title="Weekly Review", subtitle="Week 18 of 2026") → main area with:
- WeekSummary hero card
- 4-column grid: Sessions (coral), Sleep avg (sky), HRV avg (mint), Cal adherence (lemon)
- 2-column grid: Training load sparkline (1.6fr) + PR progression bars (1fr)
- Heatmap card with "92% adherence" header

Replace the current placeholder with the full design.

- [ ] **Step 4: Commit**

```
feat: redesign review page with score ring, stat cards, heatmap
```

---

### Task 8: Settings page redesign

**Files:**
- Rewrite: `src/components/settings/integration-card.tsx`
- Rewrite: `src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Rewrite integration-card.tsx**

Card with: BrandMark (44px), name + connected badge (mint pill with green dot) + category/sync time, action buttons (Sync now + Disconnect ghost buttons if connected, Connect coral button if not).

- [ ] **Step 2: Rewrite settings page.tsx**

Two-column layout (220px nav + 1fr content):
- Left nav: settings categories (Integrations active with 4/6 count badge, Account, Goals & body, Notifications, Privacy & data, Subscription)
- Right: header card (sky gradient, plug icon, "Your connected apps", Add button) + stacked integration cards

Topbar: title="Settings", subtitle="Integrations & account".

Preserve existing integration status fetching and connect/disconnect logic.

- [ ] **Step 3: Commit**

```
feat: redesign settings page with integration cards and nav sidebar
```

---

### Task 9: Onboarding flow redesign (Cal AI / Whoop style)

**Files:**
- Rewrite: `src/components/onboarding/onboarding-progress.tsx`
- Rewrite: `src/components/onboarding/option-card.tsx`
- Rewrite: `src/components/onboarding/step-profile.tsx`
- Rewrite: `src/components/onboarding/step-body-goal.tsx`
- Rewrite: `src/components/onboarding/step-emphasis.tsx`
- Rewrite: `src/components/onboarding/step-experience.tsx`
- Rewrite: `src/components/onboarding/step-availability.tsx`
- Rewrite: `src/components/onboarding/step-integrations.tsx`
- Rewrite: `src/components/onboarding/step-split-result.tsx`
- Rewrite: `src/app/onboarding/page.tsx`
- Rewrite: `src/app/onboarding/layout.tsx`

- [ ] **Step 1: Rewrite onboarding-progress.tsx**

Segmented progress bar: array of flex-1 bars (height 5px, rounded). Filled steps = ink bg, current step = coral bg, future = line color. Takes `step` (0-indexed) and `total` props.

- [ ] **Step 2: Rewrite option-card.tsx**

Pastel selection card with: emoji (large), label (bold), optional sub text, check badge (ink circle + white check) when selected. Selected state: colored background based on `color` prop (coral/mint/sky/lemon), 2px ink border, translateY(-3px) lift, shadow. Unselected: white bg, 1px line border.

Accept `emoji`, `label`, `sub`, `selected`, `color`, `size` ("md" | "lg"), `onClick` props.

- [ ] **Step 3: Create OnboardingShell wrapper**

Create the full-screen onboarding wrapper in `src/app/onboarding/page.tsx` (or a new component). Structure:
- Full height, powder-blue bg with two floating blobs (coral top-right, mint bottom-left)
- Top: brand mark + "Step N of M" text
- Progress bar
- Center: vertically centered content area with big title (clamp 36-52px), subtitle, children slot
- Bottom: frosted glass footer with Back ghost button (if not first step) + Continue ink button

- [ ] **Step 4: Rewrite step-profile.tsx**

Title: "Let's start with the basics." Sub: "A few details so your coach can dial in your nutrition and training targets."

Content: 2x2 grid (max-width 520px):
- Height: two inputs (ft + in) with unit labels
- Weight: input with "lb" label
- Age: single input
- Sex: two toggle buttons (Male selected = ink bg, Female = white)

Use `.ob-input` class from tokens for styled inputs.

- [ ] **Step 5: Rewrite step-body-goal.tsx**

Title: "What's your body goal right now?" Sub: "You can change this anytime — your plan adapts."

Content: 3-column grid of large OptionCards:
- 📉 Cut / "Lose fat, keep muscle" / coral
- 📈 Bulk / "Build size and strength" / mint
- ⚖️ Recomp / "Lean out + add muscle" / sky

Plus a "Custom goal" dashed-border row below with plus icon.

- [ ] **Step 6: Rewrite step-emphasis.tsx**

Title: "Anything to emphasize?" Sub: "Lagging body parts or focus areas — pick up to 3 and we'll bias your split."

Content: 4x2 grid of OptionCards: Arms 💪, Shoulders 🤸, Chest 🏋️, Back 🦾, Legs 🦵, Glutes 🍑, Core ⚡, Mobility 🧘.

- [ ] **Step 7: Rewrite step-experience.tsx**

Title: "How experienced are you?" Sub: "Be honest — this calibrates volume, intensity, and how aggressive your plan can be."

Content: 2x2 grid of large OptionCards:
- 🌱 Beginner / "0–1 yr · still learning the lifts" / mint
- 🔥 Intermediate / "1–3 yrs · solid form, steady gains" / coral (selected)
- ⚡ Advanced / "3–5 yrs · plateaus need real planning" / sky
- 🏆 Elite / "5+ yrs · competing or pushing PR limits" / lemon

- [ ] **Step 8: Rewrite step-availability.tsx**

Title: "How many days per week can you train?" Sub: "Pick a number — we'll fit lifts and cardio realistically."

Content: 4 number pills (3, 4, 5, 6) — selected = dark bg + elevated. Below: "Of those N days, how many lifts vs cardio?" with a visual slider showing the split (coral bar for lifts, remainder for cardio, draggable thumb).

- [ ] **Step 9: Rewrite step-integrations.tsx**

Title: "Connect your apps." Sub: "The more Hybro sees, the better it coaches. You can always add more later."

Content: 2x2 grid (max-width 580px) of integration cards: MacroFactor, Hevy, Strava, Garmin, Google Calendar, Apple Health. Connected = green border + check-circle icon. Not connected = line border + "Connect" ghost button.

CTA label: "Continue · N connected".

Preserve existing connect logic (credential modals, OAuth redirects).

- [ ] **Step 10: Rewrite step-split-result.tsx**

Title: "Here's your starting split." Sub: "Push / Pull / Legs + 2 cardio days. We'll adapt it weekly based on your data."

Content: Dark card (ink bg) with coral/sky blobs:
- Eyebrow: "Recommended split" (coral text)
- Title: "5-day Hybrid PPL"
- 7-column grid showing Mon-Sun with type labels in colored rounded cells (Push/coral, Run/sky, Pull/coral, Rest/lemon, Legs/coral, Long/sky, Rest/lemon)

CTA label: "Let's go →"

- [ ] **Step 11: Rewrite onboarding page.tsx and layout.tsx**

Update `layout.tsx` to import `tokens.css`. Update `page.tsx` to use the OnboardingShell wrapper instead of the current form layout. Preserve all state management and the `completeOnboarding` server action.

- [ ] **Step 12: Commit**

```
feat: redesign onboarding flow with Cal AI one-question-per-screen style
```

---

### Task 10: Final cleanup and visual QA

**Files:**
- Modify: `src/app/globals.css` (if needed)
- Remove: unused old component code

- [ ] **Step 1: Remove unused imports**

Check all modified files for leftover imports of old components (framer-motion, old lucide icons, old shadcn components not used anymore). Remove them.

- [ ] **Step 2: Remove old phone-mockup.tsx and hybro-logo.tsx if unused**

These were only used by the old landing page. If the new landing page doesn't import them, delete them.

- [ ] **Step 3: Visual QA**

Start dev server, navigate through every page and onboarding step. Check:
- Sidebar active states highlight correctly per route
- Dashboard stat cards render with correct colors and charts
- Chat two-column layout doesn't overflow
- Plan day cards show exercises and active state
- Review heatmap and sparklines render
- Settings integration cards show brand marks
- Onboarding steps navigate correctly with correct progress
- All animations work (rings, sparklines, floating blobs, typing dots)

- [ ] **Step 4: Commit**

```
chore: clean up unused components and verify visual QA
```
