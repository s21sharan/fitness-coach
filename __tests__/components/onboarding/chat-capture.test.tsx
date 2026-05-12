import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatCapture } from "@/components/onboarding/chat-capture";
import { getDefaultAthleteProfile } from "@/lib/onboarding/types";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe("ChatCapture", () => {
  it("renders the prompt and textarea", () => {
    const onUpdate = vi.fn();
    render(
      <ChatCapture
        profile={getDefaultAthleteProfile()}
        onUpdate={onUpdate}
        insertion_point="goals"
        prompt="Tell coach about your goals"
        placeholder="Goals…"
      />
    );
    expect(screen.getByText("Tell coach about your goals")).toBeDefined();
    expect(screen.getByPlaceholderText("Goals…")).toBeDefined();
  });

  it("disables send when empty", () => {
    render(
      <ChatCapture
        profile={getDefaultAthleteProfile()}
        onUpdate={vi.fn()}
        insertion_point="goals"
        prompt="prompt"
        placeholder="placeholder"
      />
    );
    const button = screen.getByRole("button", { name: /Send to coach/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("calls /api/coach/extract and appends a chat note", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          extracted: {
            constraints: ["pool morning only"],
            rules: ["pool_morning_only"],
          },
        }),
    });

    const onUpdate = vi.fn();
    render(
      <ChatCapture
        profile={getDefaultAthleteProfile()}
        onUpdate={onUpdate}
        insertion_point="availability"
        prompt="prompt"
        placeholder="placeholder"
      />
    );
    fireEvent.change(screen.getByPlaceholderText("placeholder"), {
      target: { value: "Pool only opens in the morning" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send to coach/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const fetchCall = fetchMock.mock.calls[0];
    expect(fetchCall[0]).toBe("/api/coach/extract");
    const body = JSON.parse(fetchCall[1].body);
    expect(body.insertion_point).toBe("availability");

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    const calls = onUpdate.mock.calls;
    const noteCall = calls.find(([arg]) => arg.chat_notes);
    expect(noteCall).toBeDefined();
    expect(noteCall[0].chat_notes[0].insertion_point).toBe("availability");

    // Should also have appended an availability rule
    const ruleCall = calls.find(([arg]) => arg.availability_rules);
    expect(ruleCall).toBeDefined();
  });

  it("shows an error message when fetch fails", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    render(
      <ChatCapture
        profile={getDefaultAthleteProfile()}
        onUpdate={vi.fn()}
        insertion_point="goals"
        prompt="p"
        placeholder="ph"
      />
    );
    fireEvent.change(screen.getByPlaceholderText("ph"), { target: { value: "hi" } });
    fireEvent.click(screen.getByRole("button", { name: /Send to coach/ }));
    await waitFor(() => expect(screen.getByText(/failed/i)).toBeDefined());
  });
});
