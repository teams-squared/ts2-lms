import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchBar from "@/components/search/SearchBar";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
    role,
    "aria-selected": ariaSelected,
    onClick,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    role?: string;
    "aria-selected"?: boolean;
    onClick?: () => void;
  }) => (
    <a href={href} className={className} role={role} aria-selected={ariaSelected} onClick={onClick}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/posthog-client", () => ({
  posthog: { capture: vi.fn() },
}));

import { posthog } from "@/lib/posthog-client";
const mockCapture = vi.mocked(posthog.capture);

const MOCK_DOCS = [
  {
    slug: "getting-started",
    title: "Getting Started",
    description: "How to get started",
    category: "onboarding",
    minRole: "employee" as const,
    tags: ["intro"],
    order: 1,
    updatedAt: "",
  },
  {
    slug: "security-basics",
    title: "Security Basics",
    description: "Security overview",
    category: "security",
    minRole: "employee" as const,
    tags: ["security"],
    order: 2,
    updatedAt: "",
  },
];

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  mockPush.mockReset();
  mockCapture.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("SearchBar — loading state", () => {
  it("shows loading message while fetch is in-flight", async () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {})); // never resolves
    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByPlaceholderText("Search documentation...");
    await user.click(input);
    expect(screen.getByText(/loading search index/i)).toBeInTheDocument();
  });
});

describe("SearchBar — error state", () => {
  it("shows error message when fetch rejects", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByPlaceholderText("Search documentation...");
    await user.click(input);
    await waitFor(() =>
      expect(screen.getByText(/search unavailable/i)).toBeInTheDocument()
    );
  });

  it("shows error message when API returns non-OK status", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 401, statusText: "Unauthorized" })
    );
    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByPlaceholderText("Search documentation...");
    await user.click(input);
    await waitFor(() =>
      expect(screen.getByText(/search unavailable/i)).toBeInTheDocument()
    );
  });
});

describe("SearchBar — success state", () => {
  beforeEach(() => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(MOCK_DOCS), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("shows results when query matches", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByPlaceholderText("Search documentation...");
    await user.type(input, "security");
    await waitFor(() =>
      expect(screen.getByText("Security Basics")).toBeInTheDocument()
    );
  });

  it("does not show error or loading once docs are loaded", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByPlaceholderText("Search documentation...");
    await user.click(input);
    await waitFor(() =>
      expect(screen.queryByText(/search unavailable/i)).not.toBeInTheDocument()
    );
    expect(screen.queryByText(/loading search index/i)).not.toBeInTheDocument();
  });

  it("closes dropdown and clears query when a result is clicked", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByPlaceholderText("Search documentation...");
    await user.type(input, "security");
    await waitFor(() => screen.getByText("Security Basics"));
    await user.click(screen.getByText("Security Basics"));
    expect(screen.queryByText("Security Basics")).not.toBeInTheDocument();
    expect(input).toHaveValue("");
  });
});

describe("SearchBar — keyboard navigation", () => {
  beforeEach(() => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(MOCK_DOCS), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("ArrowDown highlights the first result", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByPlaceholderText("Search documentation...");
    await user.type(input, "started");
    await waitFor(() => screen.getByText("Getting Started"));
    await user.keyboard("{ArrowDown}");
    const option = screen.getByRole("option", { name: /getting started/i });
    expect(option).toHaveAttribute("aria-selected", "true");
  });

  it("ArrowUp from first item does not go below -1", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByPlaceholderText("Search documentation...");
    await user.type(input, "started");
    await waitFor(() => screen.getByText("Getting Started"));
    await user.keyboard("{ArrowUp}");
    const option = screen.getByRole("option", { name: /getting started/i });
    expect(option).toHaveAttribute("aria-selected", "false");
  });

  it("Enter with selected result calls router.push and resets state", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByPlaceholderText("Search documentation...");
    await user.type(input, "started");
    await waitFor(() => screen.getByText("Getting Started"));
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");
    expect(mockPush).toHaveBeenCalledWith("/docs/onboarding/getting-started");
    expect(input).toHaveValue("");
  });

  it("Escape closes the dropdown", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByPlaceholderText("Search documentation...");
    await user.type(input, "security");
    await waitFor(() => screen.getByText("Security Basics"));
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Security Basics")).not.toBeInTheDocument();
  });

  it("Cmd+K focuses the input", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByPlaceholderText("Search documentation...");
    input.blur();
    await user.keyboard("{Meta>}k{/Meta}");
    expect(document.activeElement).toBe(input);
  });
});

describe("SearchBar — PostHog telemetry", () => {
  beforeEach(() => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(MOCK_DOCS), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("captures search_performed event after 1-second debounce", async () => {
    vi.useFakeTimers();
    render(<SearchBar />);

    await act(async () => { await vi.runAllTimersAsync(); });

    const input = screen.getByPlaceholderText("Search documentation...");
    await act(async () => {
      fireEvent.change(input, { target: { value: "security" } });
    });

    expect(mockCapture).not.toHaveBeenCalled();

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
