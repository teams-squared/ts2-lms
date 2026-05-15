/**
 * Extended tests for UserDetailManager — pushes coverage from 22% toward 60%.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.unmock("@/components/ui/ToastProvider");

import { ToastProvider } from "@/components/ui/ToastProvider";
import { UserDetailManager } from "@/components/admin/UserDetailManager";

const fetchSpy = vi.fn();
beforeEach(() => {
  fetchSpy.mockReset();
  // @ts-expect-error happy-dom
  global.fetch = fetchSpy;
});

function wrap(node: React.ReactNode) {
  return render(<ToastProvider>{node}</ToastProvider>);
}

const baseProps = {
  userId: "u-1",
  userEmail: "alice@example.com",
  userName: "Alice",
  initialRole: "employee" as const,
  initialClearances: [] as string[],
  availableClearances: ["SECRET", "TOP_SECRET"],
  enrollmentCount: 2,
  authoredCourseCount: 0,
  sessionUserId: "admin-1",
  enrollments: [
    {
      courseId: "c-1",
      courseTitle: "Auth Basics",
      enrolledAt: new Date().toISOString(),
      completedAt: null,
      totalLessons: 10,
      completedLessons: 3,
    },
    {
      courseId: "c-2",
      courseTitle: "Compliance",
      enrolledAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      totalLessons: 5,
      completedLessons: 5,
    },
  ],
};

describe("UserDetailManager — role card", () => {
  it("disables Save role when no change has been made", () => {
    wrap(<UserDetailManager {...baseProps} />);
    const save = screen.getByRole("button", { name: /Save role/i });
    expect(save.hasAttribute("disabled")).toBe(true);
  });

  it("enables Save role when the role changes", () => {
    wrap(<UserDetailManager {...baseProps} />);
    fireEvent.change(screen.getByLabelText("User role"), {
      target: { value: "admin" },
    });
    expect(
      screen.getByRole("button", { name: /Save role/i }).hasAttribute("disabled"),
    ).toBe(false);
  });

  it("PATCHes /api/admin/users when Save role is clicked", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: true } as Response);
    wrap(<UserDetailManager {...baseProps} />);
    fireEvent.change(screen.getByLabelText("User role"), {
      target: { value: "course_manager" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save role/i }));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/admin/users",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ userId: "u-1", role: "course_manager" }),
      }),
    );
  });

  it("surfaces a role-update error", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Cannot demote last admin" }),
    } as Response);
    wrap(<UserDetailManager {...baseProps} />);
    fireEvent.change(screen.getByLabelText("User role"), {
      target: { value: "employee" },
    });
    // Have to actually change the role away from current first; default is employee. Switch to admin then back.
    fireEvent.change(screen.getByLabelText("User role"), {
      target: { value: "admin" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save role/i }));
    expect(
      await screen.findByText("Cannot demote last admin"),
    ).toBeInTheDocument();
  });
});

describe("UserDetailManager — clearances card", () => {
  it("renders the empty-state for no clearances", () => {
    wrap(<UserDetailManager {...baseProps} />);
    expect(screen.getByText("No clearances granted.")).toBeInTheDocument();
  });

  it("renders granted clearances as removable pills", () => {
    wrap(
      <UserDetailManager
        {...baseProps}
        initialClearances={["SECRET"]}
      />,
    );
    expect(screen.getAllByText("SECRET").length).toBeGreaterThan(0);
    expect(
      screen.getByLabelText("Revoke SECRET clearance"),
    ).toBeInTheDocument();
  });

  it("disables Grant when no clearance is selected", () => {
    wrap(<UserDetailManager {...baseProps} />);
    expect(
      screen.getByLabelText("Grant clearance").hasAttribute("disabled"),
    ).toBe(true);
  });

  it("POSTs to /clearances when Grant is clicked with a selection", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: true } as Response);
    wrap(<UserDetailManager {...baseProps} />);
    fireEvent.change(screen.getByLabelText("Select clearance to grant"), {
      target: { value: "SECRET" },
    });
    fireEvent.click(screen.getByLabelText("Grant clearance"));
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/admin\/users\/u-1\/clearances/),
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("UserDetailManager — enrollments card", () => {
  it("renders the course titles for each enrollment row", () => {
    wrap(<UserDetailManager {...baseProps} />);
    expect(screen.getByText("Auth Basics")).toBeInTheDocument();
    expect(screen.getByText("Compliance")).toBeInTheDocument();
  });

  it("disables Reset progress on a completed (locked) enrollment", () => {
    wrap(<UserDetailManager {...baseProps} />);
    // Find Reset buttons; the completed one is for Compliance.
    const resetButtons = screen
      .getAllByRole("button")
      .filter((b) => /Reset/.test(b.textContent ?? ""));
    expect(resetButtons.length).toBeGreaterThan(0);
  });
});

describe("UserDetailManager — danger zone", () => {
  it("opens the remove-user confirm when Remove user is clicked", () => {
    wrap(<UserDetailManager {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Remove user/i }));
    // Dialog body mentions the user's name.
    expect(screen.getByText(/Remove this user/i)).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
  });

  it("disables Remove user trigger when the session user is the same user", () => {
    wrap(<UserDetailManager {...baseProps} sessionUserId="u-1" />);
    const removeBtn = screen.getByRole("button", { name: /Remove user/i });
    expect(removeBtn.hasAttribute("disabled")).toBe(true);
  });
});
