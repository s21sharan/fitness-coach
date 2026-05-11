import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlannedCard } from "@/components/calendar/planned-card";

describe("PlannedCard", () => {
  it("renders with cardio targets (run with distance, zone, pace)", () => {
    render(
      <PlannedCard
        sessionType="Morning Run"
        aiNotes="Easy effort, stay aerobic"
        targets={{
          target_distance_km: 10,
          target_pace_min_km: 5.5,
          target_hr_zone: 2,
        }}
      />
    );

    expect(screen.getByText("Morning Run")).toBeDefined();
    expect(screen.getByText("10 km")).toBeDefined();
    expect(screen.getByText("5:30/km")).toBeDefined();
    expect(screen.getByText("Z2")).toBeDefined();
    expect(screen.getByText("Easy effort, stay aerobic")).toBeDefined();
    expect(screen.getByText("Planned")).toBeDefined();
  });

  it("renders with lifting targets (muscle focus, duration)", () => {
    render(
      <PlannedCard
        sessionType="Push Day"
        aiNotes={null}
        targets={{
          target_duration_min: 60,
          muscle_focus: "Chest, Shoulders, Triceps",
        }}
      />
    );

    expect(screen.getByText("Push Day")).toBeDefined();
    expect(screen.getByText("60 min")).toBeDefined();
    expect(screen.getByText("Chest, Shoulders, Triceps")).toBeDefined();
    expect(screen.getByText("Planned")).toBeDefined();
    // No AI notes rendered
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("renders rest day with minimal content (just icon + name)", () => {
    render(
      <PlannedCard
        sessionType="Rest Day"
        aiNotes={null}
        targets={null}
      />
    );

    expect(screen.getByText("Rest Day")).toBeDefined();
    expect(screen.getByText("Planned")).toBeDefined();
    // No targets shown
    expect(screen.queryByText(/km/)).toBeNull();
    expect(screen.queryByText(/min/)).toBeNull();
  });

  it("shows 🏃 icon for run session type", () => {
    render(
      <PlannedCard sessionType="Jog" aiNotes={null} targets={null} />
    );
    expect(screen.getByRole("img", { name: "Jog" })).toBeDefined();
    expect(screen.getByLabelText("Jog").textContent).toBe("🏃");
  });

  it("shows 😴 icon for rest day", () => {
    render(
      <PlannedCard sessionType="Rest" aiNotes={null} targets={null} />
    );
    expect(screen.getByLabelText("Rest").textContent).toBe("😴");
  });
});
