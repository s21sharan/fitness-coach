import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { RaceAutocomplete, type RaceSearchResult } from "@/components/shared/race-autocomplete";

const mockRaces: RaceSearchResult[] = [
  {
    name: "Boston Marathon",
    date: "2027-04-19",
    city: "Boston",
    state: "MA",
    distance: "Marathon",
    sport_type: "running",
    url: "https://example.com/boston",
    runsignup_id: 12345,
  },
  {
    name: "Bay Area 10K",
    date: "2027-06-01",
    city: "San Francisco",
    state: "CA",
    distance: "10K",
    sport_type: "running",
    url: "https://example.com/bay10k",
    runsignup_id: 67890,
  },
];

function renderAutocomplete(overrides: Partial<React.ComponentProps<typeof RaceAutocomplete>> = {}) {
  const onChange = vi.fn();
  const onSelectRace = vi.fn();
  const utils = render(
    <RaceAutocomplete
      value=""
      onChange={onChange}
      onSelectRace={onSelectRace}
      {...overrides}
    />
  );
  return { ...utils, onChange, onSelectRace };
}

describe("RaceAutocomplete", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders with default placeholder", () => {
    renderAutocomplete();
    expect(screen.getByPlaceholderText("Search races or type a name...")).toBeDefined();
  });

  it("renders with custom placeholder", () => {
    renderAutocomplete({ placeholder: "Find your race" });
    expect(screen.getByPlaceholderText("Find your race")).toBeDefined();
  });

  it("calls onChange on typing", () => {
    const { onChange } = renderAutocomplete();
    const input = screen.getByPlaceholderText("Search races or type a name...");
    fireEvent.change(input, { target: { value: "b" } });
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("does NOT fetch when input has fewer than 2 characters", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockRaces }),
    });
    vi.stubGlobal("fetch", mockFetch);

    renderAutocomplete({ value: "b" });
    const input = screen.getByPlaceholderText("Search races or type a name...");
    fireEvent.change(input, { target: { value: "b" } });

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fetches after 300ms debounce when input has 2+ characters", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockRaces }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { onChange } = renderAutocomplete();
    const input = screen.getByPlaceholderText("Search races or type a name...");

    fireEvent.change(input, { target: { value: "bo" } });
    expect(onChange).toHaveBeenCalledWith("bo");

    // Should not have fetched yet
    expect(mockFetch).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/races/search?q=bo");
  });

  it("shows dropdown with race results after search", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockRaces }),
    });
    vi.stubGlobal("fetch", mockFetch);

    renderAutocomplete({ value: "bo" });
    const input = screen.getByPlaceholderText("Search races or type a name...");

    fireEvent.change(input, { target: { value: "bo" } });

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });

    expect(screen.getByText("Boston Marathon")).toBeDefined();
    expect(screen.getByText("Bay Area 10K")).toBeDefined();
  });

  it("calls onSelectRace and onChange when a result is clicked", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockRaces }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { onSelectRace, onChange } = renderAutocomplete({ value: "bo" });
    const input = screen.getByPlaceholderText("Search races or type a name...");

    fireEvent.change(input, { target: { value: "bo" } });

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });

    fireEvent.mouseDown(screen.getByText("Boston Marathon"));

    expect(onSelectRace).toHaveBeenCalledWith(mockRaces[0]);
    expect(onChange).toHaveBeenCalledWith("Boston Marathon");
  });

  it("shows 'No races found' for empty results", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    renderAutocomplete({ value: "xyz" });
    const input = screen.getByPlaceholderText("Search races or type a name...");

    fireEvent.change(input, { target: { value: "xyz" } });

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });

    expect(screen.getByText("No races found")).toBeDefined();
  });

  it("shows race date, city/state, and distance in dropdown items", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [mockRaces[0]] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    renderAutocomplete({ value: "bo" });
    const input = screen.getByPlaceholderText("Search races or type a name...");

    fireEvent.change(input, { target: { value: "bo" } });

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });

    // Check that date, city/state, distance info is present
    const item = screen.getByText("Boston Marathon").closest("[data-testid='race-result-item']");
    expect(item).toBeDefined();
    expect(item!.textContent).toContain("Boston");
    expect(item!.textContent).toContain("MA");
    expect(item!.textContent).toContain("Marathon");
  });
});
