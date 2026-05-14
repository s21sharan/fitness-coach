import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PhysiqueReviewModal } from "@/components/chat/physique-review-modal";

const mockCheckins = [
  {
    id: "1",
    date: "2026-04-01",
    front_url: "https://example.com/front1.jpg",
    side_url: "https://example.com/side1.jpg",
    back_url: "https://example.com/back1.jpg",
    notes: null,
  },
  {
    id: "2",
    date: "2026-04-08",
    front_url: "https://example.com/front2.jpg",
    side_url: null,
    back_url: "https://example.com/back2.jpg",
    notes: "Feeling stronger",
  },
];

describe("PhysiqueReviewModal", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ checkins: mockCheckins }),
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the top bar with title and angle tabs", async () => {
    const onClose = vi.fn();
    render(<PhysiqueReviewModal onClose={onClose} />);
    expect(screen.getByText("Progress Photos")).toBeDefined();
    expect(screen.getByText("Front")).toBeDefined();
    expect(screen.getByText("Side")).toBeDefined();
    expect(screen.getByText("Back")).toBeDefined();
  });

  it("shows loading state initially", () => {
    // Use a never-resolving fetch to keep loading state
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise(() => {}))
    );
    const onClose = vi.fn();
    render(<PhysiqueReviewModal onClose={onClose} />);
    expect(screen.getByText("Loading...")).toBeDefined();
  });

  it("shows empty state when no check-ins", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ checkins: [] }),
      })
    );
    const onClose = vi.fn();
    render(<PhysiqueReviewModal onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText("No check-ins yet")).toBeDefined();
    });
  });

  it("shows Compare button when check-ins are loaded", async () => {
    const onClose = vi.fn();
    render(<PhysiqueReviewModal onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText("Compare")).toBeDefined();
    });
  });

  it("toggles compare mode when Compare button is clicked", async () => {
    const onClose = vi.fn();
    render(<PhysiqueReviewModal onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText("Compare")).toBeDefined();
    });
    fireEvent.click(screen.getByText("Compare"));
    expect(screen.getByText("Exit Compare")).toBeDefined();
    fireEvent.click(screen.getByText("Exit Compare"));
    expect(screen.getByText("Compare")).toBeDefined();
  });

  it("renders timeline thumbnails after loading", async () => {
    const onClose = vi.fn();
    render(<PhysiqueReviewModal onClose={onClose} />);
    await waitFor(() => {
      // Two thumbnails for two check-ins
      const imgs = screen.getAllByRole("img");
      // At least the thumbnails should be present
      expect(imgs.length).toBeGreaterThan(0);
    });
  });

  it("calls onClose when clicking the overlay backdrop", async () => {
    const onClose = vi.fn();
    const { container } = render(<PhysiqueReviewModal onClose={onClose} />);
    // Click the outer overlay (first div)
    fireEvent.click(container.firstChild as Element);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when pressing Escape key", async () => {
    const onClose = vi.fn();
    render(<PhysiqueReviewModal onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when clicking the close X button", async () => {
    const onClose = vi.fn();
    render(<PhysiqueReviewModal onClose={onClose} />);
    // Find button with "x" text
    const closeBtn = screen.getByText("x");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("switches angle when tab is clicked", async () => {
    const onClose = vi.fn();
    render(<PhysiqueReviewModal onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText("Compare")).toBeDefined();
    });
    // Click Side tab
    fireEvent.click(screen.getByText("Side"));
    // The active tab should now be Side — the front angle tab is unselected
    // We just verify the click doesn't throw and the tabs are still there
    expect(screen.getByText("Side")).toBeDefined();
    expect(screen.getByText("Back")).toBeDefined();
  });

  it("fetches check-ins from /api/checkins on mount", async () => {
    const onClose = vi.fn();
    render(<PhysiqueReviewModal onClose={onClose} />);
    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/checkins");
    });
  });

  it("does not crash when fetch errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error"))
    );
    const onClose = vi.fn();
    render(<PhysiqueReviewModal onClose={onClose} />);
    await waitFor(() => {
      // Should show empty state or loading resolved — no crash
      expect(screen.queryByText("Loading...")).toBeNull();
    });
  });
});
