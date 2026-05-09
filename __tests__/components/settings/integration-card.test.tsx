import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntegrationCard } from "@/components/settings/integration-card";

describe("IntegrationCard", () => {
  it("renders disconnected state", () => {
    render(
      <IntegrationCard
        name="MacroFactor"
        category="Nutrition tracking & macros"
        provider="macrofactor"
        connected={false}
        lastSyncedAt={null}
        onConnect={() => {}}
        onDisconnect={() => {}}
      />,
    );
    expect(screen.getByText("MacroFactor")).toBeDefined();
    expect(screen.getByText("Nutrition tracking & macros")).toBeDefined();
    expect(screen.getByRole("button", { name: /connect/i })).toBeDefined();
  });

  it("renders connected state with last synced", () => {
    render(
      <IntegrationCard
        name="Hevy"
        category="Strength training"
        provider="hevy"
        connected={true}
        lastSyncedAt={new Date().toISOString()}
        onConnect={() => {}}
        onDisconnect={() => {}}
      />,
    );
    expect(screen.getByText("Connected")).toBeDefined();
    expect(screen.getByRole("button", { name: /disconnect/i })).toBeDefined();
  });

  it("renders without sync button when onSync is not provided", () => {
    render(
      <IntegrationCard
        name="Garmin"
        category="Recovery"
        provider="garmin"
        connected={true}
        lastSyncedAt={null}
        onConnect={() => {}}
        onDisconnect={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: /sync now/i })).toBeNull();
    expect(screen.getByRole("button", { name: /disconnect/i })).toBeDefined();
  });
});
