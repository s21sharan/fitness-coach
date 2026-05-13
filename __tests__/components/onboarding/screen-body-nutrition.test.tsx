import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScreenBodyNutrition } from "@/components/onboarding/screen-body-nutrition";
import { getDefaultAthleteProfile } from "@/lib/onboarding/types";

function renderScreen() {
  const onUpdate = vi.fn();
  const utils = render(<ScreenBodyNutrition profile={getDefaultAthleteProfile()} onUpdate={onUpdate} />);
  return { ...utils, onUpdate };
}

describe("ScreenBodyNutrition (cards)", () => {
  it("shows protein tier cards", () => {
    renderScreen();
    expect(screen.getByText("Moderate")).toBeDefined();
    expect(screen.getByText("High")).toBeDefined();
    expect(screen.getByText("Highest")).toBeDefined();
    expect(screen.queryByText(/Protein target \(g\)/)).toBeNull(); // old grams label
  });

  it("shows diet style card options", () => {
    renderScreen();
    expect(screen.getByText("Low carb")).toBeDefined();
    expect(screen.getByText("Vegetarian")).toBeDefined();
    expect(screen.getByText("Vegan")).toBeDefined();
    expect(screen.getByText("Omnivore")).toBeDefined();
  });

  it("does not ask about a tracking app anymore", () => {
    renderScreen();
    expect(screen.queryByText(/Tracking app/i)).toBeNull();
    expect(screen.queryByText(/MacroFactor/i)).toBeNull();
  });

  it("sets protein tier on click", () => {
    const { onUpdate } = renderScreen();
    fireEvent.click(screen.getByText("High"));
    const call = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
    expect(call.body_nutrition.protein_tier).toBe("high");
  });
});
