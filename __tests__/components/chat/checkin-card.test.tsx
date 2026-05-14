import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CheckInCard } from "@/components/chat/checkin-card";

// Mock resizeImage to avoid canvas operations in jsdom
vi.mock("@/lib/image-resize", () => ({
  resizeImage: vi.fn(async (file: File) => new Blob([await file.arrayBuffer()], { type: "image/jpeg" })),
}));

const mockData = {
  type: "checkin_prompt" as const,
  date: "2026-05-12",
  message: "Time for your weekly progress photos!",
};

describe("CheckInCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock URL.createObjectURL / revokeObjectURL
    Object.defineProperty(URL, "createObjectURL", {
      writable: true,
      value: vi.fn(() => "blob:mock-url"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      writable: true,
      value: vi.fn(),
    });
  });

  it("renders header label and message", () => {
    render(<CheckInCard data={mockData} />);
    expect(screen.getByText("Weekly Check-in")).toBeDefined();
    expect(screen.getByText("Time for your weekly progress photos!")).toBeDefined();
    expect(screen.getByText("2026-05-12")).toBeDefined();
  });

  it("renders three upload zone labels", () => {
    render(<CheckInCard data={mockData} />);
    expect(screen.getByText("Front")).toBeDefined();
    expect(screen.getByText("Side")).toBeDefined();
    expect(screen.getByText("Back")).toBeDefined();
  });

  it("renders submit button disabled when no photos selected", () => {
    render(<CheckInCard data={mockData} />);
    const btn = screen.getByRole("button", { name: /Submit Check-in/i });
    expect(btn).toBeDefined();
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows add note button in pending state", () => {
    render(<CheckInCard data={mockData} />);
    expect(screen.getByText("+ Add a note...")).toBeDefined();
  });

  it("shows textarea when add note is clicked", () => {
    render(<CheckInCard data={mockData} />);
    const addNoteBtn = screen.getByText("+ Add a note...");
    fireEvent.click(addNoteBtn);
    const textarea = screen.getByPlaceholderText("How are you feeling? Any changes you notice?");
    expect(textarea).toBeDefined();
  });

  it("does not show add note button after clicking it", () => {
    render(<CheckInCard data={mockData} />);
    const addNoteBtn = screen.getByText("+ Add a note...");
    fireEvent.click(addNoteBtn);
    expect(screen.queryByText("+ Add a note...")).toBeNull();
  });

  it("renders three hidden file inputs", () => {
    const { container } = render(<CheckInCard data={mockData} />);
    const inputs = container.querySelectorAll('input[type="file"]');
    expect(inputs.length).toBe(3);
  });

  it("file inputs accept image/* and use environment capture", () => {
    const { container } = render(<CheckInCard data={mockData} />);
    const inputs = container.querySelectorAll('input[type="file"]');
    inputs.forEach((input) => {
      expect((input as HTMLInputElement).accept).toBe("image/*");
      // capture is an attribute (not a DOM property) in jsdom
      expect(input.getAttribute("capture")).toBe("environment");
    });
  });
});
