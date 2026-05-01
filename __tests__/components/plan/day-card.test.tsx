import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DayCard } from "@/components/plan/day-card";

describe("DayCard", () => {
  it("renders a scheduled session", () => {
    render(
      <DayCard dayName="Mon" dateStr="May 4" sessionType="Push" status="scheduled" isToday={false} aiNotes={null} completion={null} />,
    );
    expect(screen.getByText("Mon")).toBeDefined();
    expect(screen.getByText("Push")).toBeDefined();
    expect(screen.getByText("Scheduled")).toBeDefined();
  });

  it("renders today with highlight and AI notes", () => {
    render(
      <DayCard dayName="Fri" dateStr="May 2" sessionType="Upper Body" status="scheduled" isToday={true} aiNotes="HRV 52, sleep 7.8h — push hard" completion={null} />,
    );
    expect(screen.getByText("Today")).toBeDefined();
    expect(screen.getByText("HRV 52, sleep 7.8h — push hard")).toBeDefined();
  });

  it("renders completed lifting session with Hevy data", () => {
    render(
      <DayCard dayName="Mon" dateStr="Apr 28" sessionType="Push" status="completed" isToday={false} aiNotes={null} completion={{ workout: { name: "Push Day", duration_minutes: 72, exercise_count: 10 } }} />,
    );
    expect(screen.getByText("72 min")).toBeDefined();
    expect(screen.getByText(/10 exercises/)).toBeDefined();
  });

  it("renders completed cardio with Strava data", () => {
    render(
      <DayCard dayName="Tue" dateStr="Apr 29" sessionType="Tempo Run" status="completed" isToday={false} aiNotes={null} completion={{ cardio: [{ type: "run", distance: 8.2, duration: 2355, avg_hr: 168, pace_or_speed: 4.79 }] }} />,
    );
    expect(screen.getByText("8.2 km")).toBeDefined();
    expect(screen.getByText(/168 bpm/)).toBeDefined();
  });

  it("renders rest day", () => {
    render(
      <DayCard dayName="Sun" dateStr="May 4" sessionType="Rest" status="scheduled" isToday={false} aiNotes={null} completion={null} />,
    );
    expect(screen.getByText("Rest")).toBeDefined();
    expect(screen.getByText("Recovery day")).toBeDefined();
  });

  it("renders missed session", () => {
    render(
      <DayCard dayName="Wed" dateStr="Apr 30" sessionType="Legs" status="missed" isToday={false} aiNotes={null} completion={null} />,
    );
    expect(screen.getByText("Missed")).toBeDefined();
  });
});
