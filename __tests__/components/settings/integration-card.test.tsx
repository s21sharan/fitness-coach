import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntegrationCard } from "@/components/settings/integration-card";

describe("IntegrationCard", () => {
  it("renders disconnected state", () => {
    render(
      <IntegrationCard
        name="MacroFactor"
        description="Nutrition tracking & macros"
        provider="macrofactor"
        connected={false}
        status="disconnected"
        lastSyncedAt={null}
        onConnect={() => {}}
        onDisconnect={() => {}}
      />,
    );
    expect(screen.getByText("MacroFactor")).toBeDefined();
    expect(screen.getByText("Not connected")).toBeDefined();
    expect(screen.getByRole("button", { name: /connect/i })).toBeDefined();
  });

  it("renders connected state with last synced", () => {
    render(
      <IntegrationCard
        name="Hevy"
        description="Strength training"
        provider="hevy"
        connected={true}
        status="active"
        lastSyncedAt={new Date().toISOString()}
        onConnect={() => {}}
        onDisconnect={() => {}}
      />,
    );
    expect(screen.getByText("Connected")).toBeDefined();
    expect(screen.getByRole("button", { name: /disconnect/i })).toBeDefined();
  });

  it("renders error state", () => {
    render(
      <IntegrationCard
        name="Garmin"
        description="Recovery"
        provider="garmin"
        connected={true}
        status="error"
        lastSyncedAt={null}
        onConnect={() => {}}
        onDisconnect={() => {}}
      />,
    );
    expect(screen.getByText("Sync error")).toBeDefined();
  });
});
