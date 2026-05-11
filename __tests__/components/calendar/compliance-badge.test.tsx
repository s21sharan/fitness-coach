import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { getComplianceStatus, ComplianceBadge } from "@/components/calendar/compliance-badge";

describe("getComplianceStatus", () => {
  it("returns match when planned lift and workout logs exist", () => {
    const result = getComplianceStatus(
      "Push Day",
      [{ name: "Bench Press" }],
      []
    );
    expect(result).toBe("match");
  });

  it("returns match when planned run and cardio run found", () => {
    const result = getComplianceStatus(
      "Morning Run",
      [],
      [{ type: "run" }]
    );
    expect(result).toBe("match");
  });

  it("returns different when planned run but only workout logged", () => {
    const result = getComplianceStatus(
      "Morning Run",
      [{ name: "Bench Press" }],
      []
    );
    expect(result).toBe("different");
  });

  it("returns missed when planned run and no activity", () => {
    const result = getComplianceStatus("Morning Run", [], []);
    expect(result).toBe("missed");
  });

  it("returns match for rest day regardless of planned type", () => {
    const result = getComplianceStatus("Rest Day", [], []);
    expect(result).toBe("match");
  });

  it("returns match for rest day even when activities exist", () => {
    const result = getComplianceStatus(
      "Recovery",
      [{ name: "Bench Press" }],
      [{ type: "run" }]
    );
    expect(result).toBe("match");
  });

  it("returns null when plannedSessionType is null", () => {
    const result = getComplianceStatus(null, [], []);
    expect(result).toBeNull();
  });

  it("returns different when planned lift but only cardio logged", () => {
    const result = getComplianceStatus("Pull Day", [], [{ type: "run" }]);
    expect(result).toBe("different");
  });

  it("returns missed when planned lift and no activity", () => {
    const result = getComplianceStatus("Legs", [], []);
    expect(result).toBe("missed");
  });
});

describe("ComplianceBadge", () => {
  it("renders nothing when status is null", () => {
    const { container } = render(<ComplianceBadge status={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders green dot for match status", () => {
    const { container } = render(<ComplianceBadge status="match" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toBeDefined();
    // jsdom normalizes hex to rgb
    expect(badge.style.background).toBe("rgb(34, 197, 94)");
    expect(badge.title).toBe("Completed as planned");
  });

  it("renders orange dot for different status", () => {
    const { container } = render(<ComplianceBadge status="different" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.style.background).toBe("rgb(249, 115, 22)");
    expect(badge.title).toBe("Completed differently than planned");
  });

  it("renders red dot for missed status", () => {
    const { container } = render(<ComplianceBadge status="missed" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.style.background).toBe("rgb(239, 68, 68)");
    expect(badge.title).toBe("Missed");
  });
});
