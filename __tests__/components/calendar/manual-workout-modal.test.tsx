import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ManualWorkoutModal } from "@/components/calendar/manual-workout-modal";

// Force unit prefs so the form labels and payload conversions are deterministic.
vi.mock("@/lib/units", async () => {
  const actual = await vi.importActual<typeof import("@/lib/units")>("@/lib/units");
  return {
    ...actual,
    getUnitPreferences: () => ({ distance: "mi" as const, weight: "lbs" as const, swimDistance: "m" as const }),
  };
});

interface FetchCall {
  url: string;
  body: Record<string, unknown>;
}
const fetchCalls: FetchCall[] = [];
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  fetchCalls.push({
    url: String(url),
    body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {},
  });
  return new Response(JSON.stringify({ id: "planned-new" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

beforeEach(() => {
  fetchCalls.length = 0;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function renderModal(props: Partial<React.ComponentProps<typeof ManualWorkoutModal>> = {}) {
  const onClose = vi.fn();
  const onCreated = vi.fn();
  render(
    <ManualWorkoutModal
      open={true}
      onClose={onClose}
      onCreated={onCreated}
      defaultDate="2026-05-20"
      {...props}
    />
  );
  return { onClose, onCreated };
}

describe("PlanSessionModal — sport picker", () => {
  it("renders Run as the default sport with cardio-specific fields", () => {
    renderModal();
    // Cardio shows distance + pace + HR zone selector.
    expect(screen.getByLabelText(/target distance in mi/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/pace minutes/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/target HR zone/i)).toBeInTheDocument();
    // Strength-only muscle focus is hidden.
    expect(screen.queryByLabelText(/muscle focus/i)).not.toBeInTheDocument();
  });

  it("switches to strength fields when Strength pill is clicked", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Strength" }));
    // Cardio-only distance and pace fields disappear.
    expect(screen.queryByLabelText(/target distance/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/pace minutes/i)).not.toBeInTheDocument();
    // Strength-only muscle focus appears.
    expect(screen.getByLabelText(/muscle focus/i)).toBeInTheDocument();
  });
});

describe("PlanSessionModal — submit gating", () => {
  it("disables Add until session name and a target (duration OR distance) are entered", () => {
    renderModal();
    const save = screen.getByRole("button", { name: /add to plan/i });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/session name/i), { target: { value: "Easy run" } });
    expect(save).toBeDisabled(); // still no target

    fireEvent.change(screen.getByLabelText(/target duration in minutes/i), { target: { value: "45" } });
    expect(save).not.toBeDisabled();
  });

  it("enables Add when distance alone is entered (no duration)", () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/session name/i), { target: { value: "Long run" } });
    fireEvent.change(screen.getByLabelText(/target distance in mi/i), { target: { value: "10" } });
    expect(screen.getByRole("button", { name: /add to plan/i })).not.toBeDisabled();
  });
});

describe("PlanSessionModal — submit payload", () => {
  it("posts to /api/plan/sessions and converts distance (mi → km) + pace (min/mi → min/km)", async () => {
    const { onCreated } = renderModal();

    fireEvent.change(screen.getByLabelText(/session name/i), { target: { value: "Easy Z2 run" } });
    fireEvent.change(screen.getByLabelText(/target duration in minutes/i), { target: { value: "45" } });
    fireEvent.change(screen.getByLabelText(/target distance in mi/i), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText(/pace minutes/i), { target: { value: "9" } });
    fireEvent.change(screen.getByLabelText(/pace seconds/i), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText(/target HR zone/i), { target: { value: "2" } });

    fireEvent.click(screen.getByRole("button", { name: /add to plan/i }));

    await waitFor(() => expect(fetchCalls.length).toBe(1));
    expect(fetchCalls[0].url).toBe("/api/plan/sessions");

    const body = fetchCalls[0].body;
    expect(body.date).toBe("2026-05-20");
    expect(body.sport).toBe("run");
    expect(body.session_type).toBe("Easy Z2 run");
    expect(body.slot).toBe("full");
    expect(body.target_duration_min).toBe(45);
    // 5 mi * 1.609344 = 8.04672 → rounded to 2 decimals.
    expect(body.target_distance_km).toBeCloseTo(8.05, 2);
    // 9:30/mi = 9.5 min/mi → 9.5 / 0.621371 ≈ 15.29 min/km.
    expect(body.target_pace_min_km).toBeCloseTo(15.29, 1);
    expect(body.target_hr_zone).toBe(2);

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });

  it("does not include a steps key when intervals section is closed", async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/session name/i), { target: { value: "Easy run" } });
    fireEvent.change(screen.getByLabelText(/target duration in minutes/i), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: /add to plan/i }));
    await waitFor(() => expect(fetchCalls.length).toBe(1));
    expect("steps" in fetchCalls[0].body).toBe(false);
  });

  it("includes a leaf step in payload with duration + distance + HR zone (cardio)", async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/session name/i), { target: { value: "Tempo" } });
    fireEvent.change(screen.getByLabelText(/target duration in minutes/i), { target: { value: "40" } });

    // Open intervals editor and add a step.
    fireEvent.click(screen.getByRole("button", { name: /toggle structured intervals/i }));
    fireEvent.click(screen.getByRole("button", { name: /^\+ add step$/i }));

    // First (and only) step row.
    fireEvent.change(screen.getByLabelText(/^step 1 duration minutes$/i), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/^step 1 duration seconds$/i), { target: { value: "30" } });
    // Distance for cardio is in mi (test pref).
    fireEvent.change(screen.getByLabelText(/^step 1 distance mi$/i), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/^step 1 HR zone$/i), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText(/^step 1 label$/i), { target: { value: "Threshold" } });

    fireEvent.click(screen.getByRole("button", { name: /add to plan/i }));

    await waitFor(() => expect(fetchCalls.length).toBe(1));
    const body = fetchCalls[0].body;
    const steps = body.steps as Array<Record<string, unknown>>;
    expect(steps).toHaveLength(1);
    // 10:30 = 630 s
    expect(steps[0].duration_sec).toBe(630);
    // 1 mi = 1609.344 m → rounded
    expect(steps[0].distance_m).toBe(1609);
    expect(steps[0].target_hr_zone).toBe(4);
    expect(steps[0].label).toBe("Threshold");
    expect(steps[0].type).toBe("work");
  });

  it("includes a repeat block with two children", async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/session name/i), { target: { value: "4x800" } });
    fireEvent.change(screen.getByLabelText(/target duration in minutes/i), { target: { value: "35" } });

    fireEvent.click(screen.getByRole("button", { name: /toggle structured intervals/i }));
    fireEvent.click(screen.getByRole("button", { name: /\+ add repeat block/i }));

    // Repeat defaults to 4× work + recovery.
    fireEvent.change(screen.getByLabelText(/repeat 1 count/i), { target: { value: "5" } });
    // First child (work): distance 800m → 0.5 mi roughly. Just set duration for simplicity.
    fireEvent.change(screen.getByLabelText(/repeat 1 child 1 duration minutes/i), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText(/repeat 1 child 1 HR zone/i), { target: { value: "4" } });
    // Second child (recovery): 90 s recovery.
    fireEvent.change(screen.getByLabelText(/repeat 1 child 2 duration seconds/i), { target: { value: "90" } });
    fireEvent.change(screen.getByLabelText(/repeat 1 child 2 HR zone/i), { target: { value: "2" } });

    fireEvent.click(screen.getByRole("button", { name: /add to plan/i }));

    await waitFor(() => expect(fetchCalls.length).toBe(1));
    const steps = fetchCalls[0].body.steps as Array<Record<string, unknown>>;
    expect(steps).toHaveLength(1);
    expect(steps[0].type).toBe("repeat");
    expect(steps[0].repeats).toBe(5);
    const children = steps[0].steps as Array<Record<string, unknown>>;
    expect(children).toHaveLength(2);
    expect(children[0]).toMatchObject({ type: "work", duration_sec: 180, target_hr_zone: 4 });
    expect(children[1]).toMatchObject({ type: "recovery", duration_sec: 90, target_hr_zone: 2 });
  });

  it("posts strength sessions with muscle_focus and without distance/pace fields", async () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Strength" }));

    fireEvent.change(screen.getByLabelText(/session name/i), { target: { value: "Push day" } });
    fireEvent.change(screen.getByLabelText(/target duration in minutes/i), { target: { value: "60" } });
    fireEvent.change(screen.getByLabelText(/muscle focus/i), { target: { value: "chest, triceps" } });

    fireEvent.click(screen.getByRole("button", { name: /add to plan/i }));

    await waitFor(() => expect(fetchCalls.length).toBe(1));
    const body = fetchCalls[0].body;
    expect(body.sport).toBe("strength");
    expect(body.target_duration_min).toBe(60);
    expect(body.muscle_focus).toBe("chest, triceps");
    // Cardio-only fields should be null since the inputs aren't rendered.
    expect(body.target_distance_km).toBeNull();
    expect(body.target_pace_min_km).toBeNull();
  });
});
