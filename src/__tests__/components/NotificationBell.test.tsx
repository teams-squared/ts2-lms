import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { NotificationBell } from "@/components/layout/NotificationBell";

describe("NotificationBell", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function mockGetNotifications(
    notifications: Array<{ id: string; type: string; message: string; read: boolean; courseId: string | null; createdAt: string }>,
    unreadCount: number,
  ) {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ notifications, unreadCount }),
    });
  }

  it("renders notification button with aria-label", async () => {
    mockGetNotifications([], 0);
    render(<NotificationBell />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Notifications/ })).toBeInTheDocument(),
    );
  });

  it("shows unread count badge when > 0", async () => {
    mockGetNotifications(
      [{ id: "1", type: "info", message: "New course", read: false, courseId: null, createdAt: "2026-01-01" }],
      3,
    );
    render(<NotificationBell />);

    await waitFor(() => expect(screen.getByText("3")).toBeInTheDocument());
  });

  it('shows "9+" when unread count exceeds 9', async () => {
    mockGetNotifications([], 12);
    render(<NotificationBell />);

    await waitFor(() => expect(screen.getByText("9+")).toBeInTheDocument());
  });

  it("does not show badge when unread is 0", async () => {
    mockGetNotifications([], 0);
    render(<NotificationBell />);

    // Wait for fetch to resolve
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.queryByText("9+")).not.toBeInTheDocument();
  });

  it('opens dropdown on click showing "Notifications" heading', async () => {
    mockGetNotifications([], 0);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<NotificationBell />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: /Notifications/ }));

    expect(screen.getByText("Notifications")).toBeInTheDocument();
  });

  it('shows "No notifications yet." for empty list', async () => {
    mockGetNotifications([], 0);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<NotificationBell />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: /Notifications/ }));

    expect(screen.getByText("No notifications yet.")).toBeInTheDocument();
  });
});
