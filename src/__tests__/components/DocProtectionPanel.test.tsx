import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, push: vi.fn() }),
}));

import DocProtectionPanel from "@/components/docs/DocProtectionPanel";

// ── Helpers ───────────────────────────────────────────────────────────────

const BASE_PROPS = { category: "engineering", slug: "setup" };

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

afterEach(() => {
  // Guarantee real timers are restored even if a test times out mid-flight
  vi.useRealTimers();
});

// ── Unprotected idle state ────────────────────────────────────────────────

describe("DocProtectionPanel — unprotected idle", () => {
  it("shows 'not password protected' message", () => {
    render(<DocProtectionPanel {...BASE_PROPS} passwordProtected={false} />);
    expect(screen.getByText(/not password protected/i)).toBeInTheDocument();
  });

  it("shows the Add protection button", () => {
    render(<DocProtectionPanel {...BASE_PROPS} passwordProtected={false} />);
    expect(screen.getByRole("button", { name: /add protection/i })).toBeInTheDocument();
  });

  it("shows the form when Add protection is clicked", async () => {
    const user = userEvent.setup({});
    render(<DocProtectionPanel {...BASE_PROPS} passwordProtected={false} />);
    await user.click(screen.getByRole("button", { name: /add protection/i }));
    expect(screen.getByPlaceholderText(/new password/i)).toBeInTheDocument();
  });
});

// ── Protected idle state ──────────────────────────────────────────────────

describe("DocProtectionPanel — protected idle", () => {
  it("shows 'Password protected' status", () => {
    render(<DocProtectionPanel {...BASE_PROPS} passwordProtected={true} />);
    expect(screen.getByText(/password protected/i)).toBeInTheDocument();
  });

  it("shows Change and Remove buttons", () => {
    render(<DocProtectionPanel {...BASE_PROPS} passwordProtected={true} />);
    expect(screen.getByRole("button", { name: /change/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument();
  });

  it("shows the form when Change is clicked", async () => {
    const user = userEvent.setup({});
    render(<DocProtectionPanel {...BASE_PROPS} passwordProtected={true} />);
    await user.click(screen.getByRole("button", { name: /change/i }));
    expect(screen.getByPlaceholderText(/new password/i)).toBeInTheDocument();
  });

  it("calls fetch with password: null when Remove is clicked", async () => {
    mockFetch(200, { success: true });
    const user = userEvent.setup({});
    render(<DocProtectionPanel {...BASE_PROPS} passwordProtected={true} />);
    await user.click(screen.getByRole("button", { name: /remove/i }));
    await waitFor(() =>
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        "/api/docs/protect",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"password":null'),
        })
      )
    );
  });
});

// ── Form validation ───────────────────────────────────────────────────────

describe("DocProtectionPanel — form validation", () => {
  it("Set password button is disabled while fields are empty", async () => {
    const user = userEvent.setup({});
    render(<DocProtectionPanel {...BASE_PROPS} passwordProtected={false} />);
    await user.click(screen.getByRole("button", { name: /add protection/i }));
    expect(screen.getByRole("button", { name: /set password/i })).toBeDisabled();
  });

  it("shows error for passwords shorter than 8 characters", async () => {
    const user = userEvent.setup({});
    render(<DocProtectionPanel {...BASE_PROPS} passwordProtected={false} />);
    await user.click(screen.getByRole("button", { name: /add protection/i }));
    await user.type(screen.getByPlaceholderText(/new password/i), "short");
    await user.type(screen.getByPlaceholderText(/confirm password/i), "short");
    await user.click(screen.getByRole("button", { name: /set password/i }));
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it("shows error when passwords do not match", async () => {
    const user = userEvent.setup({});
    render(<DocProtectionPanel {...BASE_PROPS} passwordProtected={false} />);
    await user.click(screen.getByRole("button", { name: /add protection/i }));
    await user.type(screen.getByPlaceholderText(/new password/i), "password123");
    await user.type(screen.getByPlaceholderText(/confirm password/i), "different123");
    await user.click(screen.getByRole("button", { name: /set password/i }));
    expect(screen.getByText(/do not match/i)).toBeInTheDocument();
  });
});

// ── Happy path — set/update password ──────────────────────────────────────

describe("DocProtectionPanel — happy path", () => {
  it("calls POST /api/docs/protect with the correct body", async () => {
    mockFetch(200, { success: true });
    const user = userEvent.setup({});
    render(<DocProtectionPanel {...BASE_PROPS} passwordProtected={false} />);
    await user.click(screen.getByRole("button", { name: /add protection/i }));
    await user.type(screen.getByPlaceholderText(/new password/i), "securepass1");
    await user.type(screen.getByPlaceholderText(/confirm password/i), "securepass1");
    await user.click(screen.getByRole("button", { name: /set password/i }));
    await waitFor(() =>
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        "/api/docs/protect",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            category: "engineering",
            slug: "setup",
            password: "securepass1",
          }),
        })
      )
    );
  });

  it("shows a success message after setting a password", async () => {
    mockFetch(200, { success: true });
    const user = userEvent.setup({});
    render(<DocProtectionPanel {...BASE_PROPS} passwordProtected={false} />);
    await user.click(screen.getByRole("button", { name: /add protection/i }));
    await user.type(screen.getByPlaceholderText(/new password/i), "securepass1");
    await user.type(screen.getByPlaceholderText(/confirm password/i), "securepass1");
    await user.click(screen.getByRole("button", { name: /set password/i }));
    await waitFor(() =>
      expect(screen.getByText(/password protection updated/i)).toBeInTheDocument()
    );
  });

  it("calls router.refresh() after a short delay on success", async () => {
    mockFetch(200, { success: true });
    const user = userEvent.setup({});
    render(<DocProtectionPanel {...BASE_PROPS} passwordProtected={false} />);
    await user.click(screen.getByRole("button", { name: /add protection/i }));
    await user.type(screen.getByPlaceholderText(/new password/i), "securepass1");
    await user.type(screen.getByPlaceholderText(/confirm password/i), "securepass1");
    await user.click(screen.getByRole("button", { name: /set password/i }));
    // Wait for refresh to be called (component does so after 1.5s)
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1), { timeout: 4000 });
  }, 8000);
});

// ── Error states ──────────────────────────────────────────────────────────

describe("DocProtectionPanel — error states", () => {
  it("shows API error message on non-ok response", async () => {
    mockFetch(502, { error: "SharePoint write failed: 403 Forbidden" });
    const user = userEvent.setup({});
    render(<DocProtectionPanel {...BASE_PROPS} passwordProtected={false} />);
    await user.click(screen.getByRole("button", { name: /add protection/i }));
    await user.type(screen.getByPlaceholderText(/new password/i), "securepass1");
    await user.type(screen.getByPlaceholderText(/confirm password/i), "securepass1");
    await user.click(screen.getByRole("button", { name: /set password/i }));
    await waitFor(() =>
      expect(screen.getByText(/sharepoint write failed/i)).toBeInTheDocument()
    );
  });

  it("shows Network error when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network down")));
    const user = userEvent.setup({});
    render(<DocProtectionPanel {...BASE_PROPS} passwordProtected={false} />);
    await user.click(screen.getByRole("button", { name: /add protection/i }));
    await user.type(screen.getByPlaceholderText(/new password/i), "securepass1");
    await user.type(screen.getByPlaceholderText(/confirm password/i), "securepass1");
    await user.click(screen.getByRole("button", { name: /set password/i }));
    await waitFor(() =>
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    );
  });
});

// ── Cancel ────────────────────────────────────────────────────────────────

describe("DocProtectionPanel — cancel", () => {
  it("returns to idle view without calling fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup({});
    render(<DocProtectionPanel {...BASE_PROPS} passwordProtected={false} />);
    await user.click(screen.getByRole("button", { name: /add protection/i }));
    expect(screen.getByPlaceholderText(/new password/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.getByRole("button", { name: /add protection/i })).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
