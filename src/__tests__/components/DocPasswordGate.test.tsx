import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, push: vi.fn() }),
}));

import DocPasswordGate from "@/components/docs/DocPasswordGate";

// ── Helpers ───────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
  category: "engineering",
  slug: "setup",
  title: "Dev Setup Guide",
  description: "How to set up your dev environment.",
};

function mockFetch(status: number, body: object = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

// ── Rendering ─────────────────────────────────────────────────────────────

describe("DocPasswordGate — rendering", () => {
  it("renders the document title", () => {
    render(<DocPasswordGate {...DEFAULT_PROPS} />);
    expect(screen.getByText("Dev Setup Guide")).toBeInTheDocument();
  });

  it("renders the document description", () => {
    render(<DocPasswordGate {...DEFAULT_PROPS} />);
    expect(screen.getByText("How to set up your dev environment.")).toBeInTheDocument();
  });

  it("renders a password input", () => {
    render(<DocPasswordGate {...DEFAULT_PROPS} />);
    expect(screen.getByPlaceholderText("Enter password")).toBeInTheDocument();
  });

  it("renders the Unlock Document button", () => {
    render(<DocPasswordGate {...DEFAULT_PROPS} />);
    expect(screen.getByRole("button", { name: /unlock document/i })).toBeInTheDocument();
  });

  it("submit button is disabled when password is empty", () => {
    render(<DocPasswordGate {...DEFAULT_PROPS} />);
    expect(screen.getByRole("button", { name: /unlock document/i })).toBeDisabled();
  });
});

// ── Interactions ──────────────────────────────────────────────────────────

describe("DocPasswordGate — interactions", () => {
  it("enables the submit button after typing a password", async () => {
    const user = userEvent.setup();
    render(<DocPasswordGate {...DEFAULT_PROPS} />);
    await user.type(screen.getByPlaceholderText("Enter password"), "mypassword");
    expect(screen.getByRole("button", { name: /unlock document/i })).not.toBeDisabled();
  });

  it("calls router.refresh() on successful unlock (200)", async () => {
    mockFetch(200, { success: true });
    const user = userEvent.setup();
    render(<DocPasswordGate {...DEFAULT_PROPS} />);
    await user.type(screen.getByPlaceholderText("Enter password"), "correct");
    await user.click(screen.getByRole("button", { name: /unlock document/i }));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  });

  it("shows 'Incorrect password' error on 401", async () => {
    mockFetch(401, { error: "Incorrect password" });
    const user = userEvent.setup();
    render(<DocPasswordGate {...DEFAULT_PROPS} />);
    await user.type(screen.getByPlaceholderText("Enter password"), "wrong");
    await user.click(screen.getByRole("button", { name: /unlock document/i }));
    await waitFor(() =>
      expect(screen.getByText(/incorrect password/i)).toBeInTheDocument()
    );
  });

  it("shows a generic error message on other non-ok responses", async () => {
    mockFetch(500, { error: "Server error" });
    const user = userEvent.setup();
    render(<DocPasswordGate {...DEFAULT_PROPS} />);
    await user.type(screen.getByPlaceholderText("Enter password"), "pass");
    await user.click(screen.getByRole("button", { name: /unlock document/i }));
    await waitFor(() =>
      expect(screen.getByText(/server error/i)).toBeInTheDocument()
    );
  });

  it("shows 'Network error' when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    const user = userEvent.setup();
    render(<DocPasswordGate {...DEFAULT_PROPS} />);
    await user.type(screen.getByPlaceholderText("Enter password"), "pass");
    await user.click(screen.getByRole("button", { name: /unlock document/i }));
    await waitFor(() =>
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    );
  });

  it("clears the error when the user types again after an error", async () => {
    mockFetch(401, {});
    const user = userEvent.setup();
    render(<DocPasswordGate {...DEFAULT_PROPS} />);
    await user.type(screen.getByPlaceholderText("Enter password"), "wrong");
    await user.click(screen.getByRole("button", { name: /unlock document/i }));
    await waitFor(() =>
      expect(screen.getByText(/incorrect password/i)).toBeInTheDocument()
    );
    // Type another character — error should clear
    await user.type(screen.getByPlaceholderText("Enter password"), "x");
    expect(screen.queryByText(/incorrect password/i)).not.toBeInTheDocument();
  });

  it("posts to /api/docs/unlock with category, slug, and password", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DocPasswordGate {...DEFAULT_PROPS} />);
    await user.type(screen.getByPlaceholderText("Enter password"), "mypass");
    await user.click(screen.getByRole("button", { name: /unlock document/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/docs/unlock");
    expect(options.method).toBe("POST");
    const body = JSON.parse(options.body as string);
    expect(body).toEqual({ category: "engineering", slug: "setup", password: "mypass" });
  });
});
