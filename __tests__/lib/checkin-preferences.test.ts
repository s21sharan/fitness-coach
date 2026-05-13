import { describe, it, expect, beforeEach } from "vitest";
import { getCheckinPreferences, saveCheckinPreferences, type CheckinPreferences } from "@/lib/checkin-preferences";

describe("checkin-preferences", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns defaults when nothing saved", () => {
    const prefs = getCheckinPreferences();
    expect(prefs).toEqual({ enabled: true, frequencyWeeks: 1 });
  });

  it("saves and retrieves preferences", () => {
    const prefs: CheckinPreferences = { enabled: false, frequencyWeeks: 4 };
    saveCheckinPreferences(prefs);
    expect(getCheckinPreferences()).toEqual(prefs);
  });

  it("merges partial saved data with defaults", () => {
    localStorage.setItem("trainer-checkin-preferences", JSON.stringify({ enabled: false }));
    const prefs = getCheckinPreferences();
    expect(prefs.enabled).toBe(false);
    expect(prefs.frequencyWeeks).toBe(1);
  });

  it("returns defaults on invalid JSON", () => {
    localStorage.setItem("trainer-checkin-preferences", "not-json");
    const prefs = getCheckinPreferences();
    expect(prefs).toEqual({ enabled: true, frequencyWeeks: 1 });
  });
});
