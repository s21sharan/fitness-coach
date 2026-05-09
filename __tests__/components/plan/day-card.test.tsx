import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DayCard } from "@/components/plan/day-card";

describe("DayCard", () => {
  it("renders a scheduled session", () => {
    render(
      <DayCard
        day="Mon"
        date="May 4"
        label="Push"
        type="lift"
        duration="—"
        exercises={["Bench Press", "Overhead Press"]}
        done={false}
        active={false}
        color="coral"
      />,
    );
    expect(screen.getByText("Mon")).toBeDefined();
    expect(screen.getByText("Push")).toBeDefined();
    expect(screen.getByText("May 4")).toBeDefined();
  });

  it("renders today with active highlight", () => {
    render(
      <DayCard
        day="Fri"
        date="May 2"
        label="Upper Body"
        type="lift"
        duration="—"
        exercises={[]}
        done={false}
        active={true}
        color="coral"
      />,
    );
    expect(screen.getByText("TODAY")).toBeDefined();
  });

  it("renders completed lifting session", () => {
    render(
      <DayCard
        day="Mon"
        date="Apr 28"
        label="Push"
        type="lift"
        duration="72 min"
        exercises={["Push Day", "72 min · 10 exercises"]}
        done={true}
        active={false}
        color="coral"
      />,
    );
    expect(screen.getByText("72 min")).toBeDefined();
    expect(screen.getByText(/10 exercises/)).toBeDefined();
  });

  it("renders cardio session with distance", () => {
    render(
      <DayCard
        day="Tue"
        date="Apr 29"
        label="Tempo Run"
        type="run"
        duration="8.2 km"
        exercises={["8.2 km", "Avg HR 168"]}
        done={true}
        active={false}
        color="sky"
      />,
    );
    expect(screen.getByText(/Avg HR 168/)).toBeDefined();
  });

  it("renders rest day", () => {
    render(
      <DayCard
        day="Sun"
        date="May 4"
        label="Rest"
        type="rest"
        duration="—"
        exercises={["Recovery day"]}
        done={false}
        active={false}
        color="lemon"
      />,
    );
    expect(screen.getByText("Rest")).toBeDefined();
    expect(screen.getByText(/Recovery day/)).toBeDefined();
  });

  it("renders exercises list", () => {
    render(
      <DayCard
        day="Wed"
        date="Apr 30"
        label="Legs"
        type="lift"
        duration="—"
        exercises={["Squat", "Deadlift", "Leg Press"]}
        done={false}
        active={false}
        color="coral"
      />,
    );
    expect(screen.getByText(/· Squat/)).toBeDefined();
    expect(screen.getByText(/· Deadlift/)).toBeDefined();
  });
});
