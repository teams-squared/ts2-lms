import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchBar from "@/components/search/SearchBar";

vi.mock("@/lib/posthog-client", () => ({
  posthog: { capture: vi.fn() },
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { posthog } from "@/lib/posthog-client";
const mockCapture = vi.mocked(posthog.capture);

const MOCK_DOCS = [
  { title: "Intro Guide", description: "Getting started", slug: "intro-guide", category: "getting-started", minRole: "employee", tags: [] },
  { title: "Security Basics", description: "Stay safe", slug: "security-basics", category: "cybersecurity", minRole: "employee", tags: ["security"] },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    json: () => Promise.resolve(MOCK_DOCS),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("SearchBar", () => {
  it("renders the search input", () => {
    render(<SearchBar />);
    expect(screen.getByPlaceholderText("Search documentation...")).toBeInTheDocument();
  });

  it("shows matching results after typing a query", async () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText("Search documentation...");
    await userEvent.type(input, "Intro");
    expect(await screen.findByText("Intro Guide")).toBeInTheDocument();
  });

  it("captures search_performed event after 1-second debounce", async () => {
    vi.useFakeTimers();
    render(<SearchBar />);

    // Flush the initial fetch
    await act(async () => { await vi.runAllTimersAsync(); });

    const input = screen.getByPlaceholderText("Search documentation...");
    // Use fireEvent to avoid userEvent/fake-timer interaction issues
    await act(async () => {
      fireEvent.change(input, { target: { value: "security" } });
    });

    expect(mockCapture).not.toHaveBeenCalled();

    // Advance past the 1-second debounce
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });

    expect(mockCapture).toHaveBeenCalledWith("search_performed", expect.objectContaining({
      query: "security",
      has_results: expect.any(Boolean),
      result_count: expect.any(Number),
    }));
  });

  it("does not capture search_performed for a whitespace-only query", async () => {
    vi.useFakeTimers();
    render(<SearchBar />);
    await act(async () => { await vi.runAllTimersAsync(); });

    const input = screen.getByPlaceholderText("Search documentation...");
    await act(async () => {
      fireEvent.change(input, { target: { value: "   " } });
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });

    expect(mockCapture).not.toHaveBeenCalled();
  });
});
