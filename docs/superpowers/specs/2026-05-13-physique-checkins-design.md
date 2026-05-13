# Weekly Physique Check-ins — Design Spec

## Overview

Add a physique progress photo feature to the Coach chat. Users upload front, side (facing right), and back photos during periodic check-ins prompted by the coach. A review modal lets users scrub through a timeline of check-in photos and compare two dates side-by-side. Check-in frequency is configurable in Settings > Preferences.

## Data Model

### Database: `physique_checkins` table

```sql
create table physique_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(clerk_id),
  date date not null,
  front_url text,
  side_url text,
  back_url text,
  notes text,
  created_at timestamptz not null default now(),
  unique(user_id, date)
);

alter table physique_checkins enable row level security;

create policy "Users can manage own check-ins"
  on physique_checkins for all
  using (user_id = auth.uid()::text);
```

### Supabase Storage

- **Bucket:** `physique-checkins` (private — signed URLs for access)
- **Path pattern:** `{user_id}/{date}/front.jpg`, `{user_id}/{date}/side.jpg`, `{user_id}/{date}/back.jpg`
- Images resized client-side before upload (max 1200px on longest edge) to keep storage reasonable

### Settings

Stored in localStorage (key: `"trainer-checkin-preferences"`), consistent with existing unit preferences pattern:

```typescript
interface CheckinPreferences {
  enabled: boolean;        // default: true
  frequencyWeeks: number;  // 1, 2, or 4 — default: 1
}
```

## Components

### 1. CheckInCard (Chat Component)

**File:** `src/components/chat/checkin-card.tsx`

Appears in the chat stream when the coach prompts for a check-in. Follows the same pattern as `PlanProposalCard` — rendered inline when the coach's `prompt_checkin` tool is called.

**Layout:**
- Dark gradient background (matching PlanProposalCard aesthetic — `#0F1B22` to `#1a2d3a`)
- Header: sparkle icon + "Weekly Check-in" + date subtitle
- Three upload zones in a horizontal row, each containing:
  - An anatomical SVG silhouette as placeholder/guide (front, side-right, back)
  - Label below: "Front", "Side", "Back"
  - Click opens native file picker (accept: `image/*`)
  - After upload: silhouette replaced by photo thumbnail with a re-upload button (small circular X)
- Optional notes field (collapsible text input, "Add a note...")
- Submit button: coral background (`#F6B7A6`), disabled until all 3 photos are present
- After submit: card transitions to completed state — thumbnails + green checkmark + "Check-in saved"

**Upload flow:**
1. User clicks upload zone
2. File picker opens (accept `image/*`, capture supported for mobile camera)
3. Image resized client-side (max 1200px longest edge, JPEG 85% quality)
4. Preview shown immediately in the card (local blob URL)
5. On "Submit": all 3 images uploaded to `/api/checkins/upload` as multipart/form-data
6. API stores to Supabase Storage, inserts DB row, returns the check-in record
7. Card transitions to completed state

### 2. PhysiqueReviewModal

**File:** `src/components/chat/physique-review-modal.tsx`

Full-screen overlay modal opened from the chat input dropdown.

**Layout:**
- Dark overlay backdrop (`rgba(0,0,0,0.85)`)
- Top bar: "Progress Photos" title, close button (X), angle tabs (Front | Side | Back)
- Angle tabs: pill-style toggle, default to "Front"

**Browse mode (default):**
- Large photo display (centered, max 500px wide) showing the selected angle for the currently selected date
- Date label above the photo
- Horizontal timeline scrubber at the bottom:
  - Row of small square thumbnails (64px) with date labels below
  - Horizontally scrollable (CSS `overflow-x: auto` with snap points)
  - Active date has a highlighted border (coral)
  - Clicking a thumbnail updates the main photo
- "Compare" button (top-right) enters comparison mode
- If user has many check-ins, the scrubber scrolls; most recent on the right

**Compare mode:**
- Side-by-side split: two large photos of the same angle, each with its date label
- Timeline scrubber at bottom with two pin indicators (visually distinct colors — coral for left, mint for right)
- Clicking a thumbnail while in compare mode updates the most recently active pin
- Switching angle tabs updates both photos
- "Exit Compare" button returns to browse mode

**Empty state:**
- Centered message: "No check-ins yet"
- Subtitle: "Your coach will prompt you when it's time."
- "Start a check-in" button that triggers the coach to send a check-in card

### 3. Chat Input Dropdown

**Modified file:** `src/components/chat/chat-input.tsx` (or wherever the chat input bar lives)

A new icon button added to the chat input bar (near the existing sparkle icon on the left side). Clicking it opens a small dropdown menu with:

- "Review Check-ins" — opens PhysiqueReviewModal
- (Future actions can be added here)

Dropdown dismisses on click-outside or Escape key. Simple popover — no heavy library needed.

### 4. SVG Pose Silhouettes

**File:** `src/components/chat/pose-silhouettes.tsx`

Three inline SVG React components: `FrontPoseSVG`, `SidePoseSVG`, `BackPoseSVG`

**Style:**
- Anatomical outline with muscle group contours (similar to existing muscle body diagram in calendar sidebar)
- Gender-neutral proportions
- Head as oval, no facial features
- Front: arms slightly away from body, palms forward (anatomical position)
- Side: facing right, natural standing pose, arms at sides
- Back: mirrors front pose from behind
- Rendered in muted color: `rgba(255,255,255,0.15)` on dark backgrounds
- Viewbox sized for consistency across all three (e.g. `0 0 200 400`)
- Each SVG is ~40-60 paths — detailed enough to show muscle contours, not so complex it's heavy

### 5. Settings: Preferences Tab Addition

**Modified file:** `src/app/dashboard/settings/page.tsx`

New section added below the existing Weight unit setting:

- Section header: "Physique Check-ins"
- Toggle switch: "Enable weekly check-ins" — when off, coach won't prompt
- When enabled, frequency selector appears: "Remind me every" + dropdown (1 week / 2 weeks / 4 weeks)
- Helper text: "Your coach will prompt you during chat when it's time"
- Persisted to localStorage via `getCheckinPreferences()` / `saveCheckinPreferences()` utility functions (same pattern as `src/lib/units.ts`)

## API

### POST `/api/checkins/upload`

Handles multipart/form-data with three image files + optional notes.

**Request:** FormData with fields `front`, `side`, `back` (File), `notes` (string, optional)

**Process:**
1. Authenticate via Clerk
2. Upload each image to Supabase Storage bucket `physique-checkins` at path `{userId}/{date}/{angle}.jpg`
3. Get signed URLs (or public URLs if bucket is public) for each uploaded image
4. Insert row into `physique_checkins` table with the URLs
5. Return the created check-in record

**Response:** `{ success: true, checkin: { id, date, front_url, side_url, back_url, notes } }`

### GET `/api/checkins`

Returns all check-ins for the authenticated user, ordered by date descending.

**Response:** `{ checkins: Array<{ id, date, front_url, side_url, back_url, notes, created_at }> }`

Used by PhysiqueReviewModal to populate the timeline.

### GET `/api/checkins/latest`

Returns just the most recent check-in date (or null). Used by the coach tool to decide whether to prompt.

**Response:** `{ last_checkin_date: string | null }`

## Coach Integration

### System prompt addition

Add to the coach's system prompt guidelines (in `src/lib/chat/system-prompt.ts`):

```
- If the user has physique check-ins enabled and their last check-in was more than N weeks ago
  (based on their frequency setting), suggest a physique check-in using the prompt_checkin tool.
- Don't prompt for check-ins every message — only at the start of a conversation or after
  discussing progress/body composition.
```

### New tool: `get_checkin_history`

**File:** `src/lib/chat/tools/get-checkin-history.ts`

Returns the user's last check-in date and check-in frequency setting so the coach can decide whether to prompt.

**Returns:** `{ last_checkin_date: string | null, frequency_weeks: number, enabled: boolean, days_since_last: number | null }`

### New tool: `prompt_checkin`

**File:** `src/lib/chat/tools/prompt-checkin.ts`

When the coach decides it's time for a check-in, it calls this tool. The tool returns structured data that gets rendered as a `CheckInCard` in the chat UI (same pattern as `regenerate_plan` → `PlanProposalCard`).

**Returns:** `{ type: "checkin_prompt", date: string, message: "Time for your weekly check-in!" }`

The chat message renderer detects this tool result and renders a `CheckInCard` component.

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/009_physique_checkins.sql` | Create | Table + RLS policies |
| `src/lib/checkin-preferences.ts` | Create | localStorage get/save for check-in settings |
| `src/components/chat/pose-silhouettes.tsx` | Create | 3 SVG pose guide components |
| `src/components/chat/checkin-card.tsx` | Create | Upload card for chat |
| `src/components/chat/physique-review-modal.tsx` | Create | Timeline scrubber + comparison modal |
| `src/components/chat/chat-input-dropdown.tsx` | Create | Dropdown menu component for chat input |
| `src/app/api/checkins/upload/route.ts` | Create | Upload endpoint |
| `src/app/api/checkins/route.ts` | Create | List endpoint |
| `src/app/api/checkins/latest/route.ts` | Create | Latest check-in endpoint |
| `src/lib/chat/tools/get-checkin-history.ts` | Create | Coach tool: check last check-in |
| `src/lib/chat/tools/prompt-checkin.ts` | Create | Coach tool: trigger check-in card |
| `src/lib/chat/system-prompt.ts` | Modify | Add check-in prompting guideline |
| `src/app/api/chat/route.ts` | Modify | Register new tools |
| `src/app/dashboard/coach/page.tsx` | Modify | Add dropdown + render CheckInCard + PhysiqueReviewModal |
| `src/app/dashboard/settings/page.tsx` | Modify | Add check-in toggle/frequency to Preferences |
