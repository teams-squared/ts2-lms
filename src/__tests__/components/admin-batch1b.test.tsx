/**
 * Second pass at admin-batch-1: the smaller settings/panel components
 * that depend on a real ToastProvider, plus the IsoNotificationSettingsForm.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.unmock("@/components/ui/ToastProvider");

import { ToastProvider } from "@/components/ui/ToastProvider";
import { IsoNotificationSettingsForm } from "@/components/admin/IsoNotificationSettingsForm";
import { CourseManagersPanel } from "@/components/admin/CourseManagersPanel";

const fetchSpy = vi.fn();

beforeEach(() => {
  fetchSpy.mockReset();
  // @ts-expect-error happy-dom
  global.fetch = fetchSpy;
});

function wrap(node: React.ReactNode) {
  return render(<ToastProvider>{node}</ToastProvider>);
}

describe("IsoNotificationSettingsForm", () => {
  const baseProps = {
    initialEnabled: true,
    initialTo: ["iso@teamsquared.io"],
    initialCc: [],
    updatedAt: new Date("2026-04-01T12:00:00Z"),
  };

  it("renders the master toggle reflecting initialEnabled", () => {
    wrap(<IsoNotificationSettingsForm {...baseProps} />);
    const toggle = screen.getByRole("checkbox");
    expect((toggle as HTMLInputElement).checked).toBe(true);
  });

  it("renders both EmailListInput surfaces (To + Cc)", () => {
    wrap(<IsoNotificationSettingsForm {...baseProps} />);
    expect(screen.getByText("To")).toBeInTheDocument();
    expect(screen.getByText("Cc")).toBeInTheDocument();
  });

  it("dims the recipients section when disabled (master switch off)", () => {
    const { container } = wrap(
      <IsoNotificationSettingsForm {...baseProps} initialEnabled={false} />,
    );
    expect(container.innerHTML).toContain("opacity-60");
  });

  it("PATCHes the settings endpoint with the current values on submit", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        enabled: true,
        toEmails: ["iso@teamsquared.io"],
        ccEmails: [],
        updatedAt: new Date().toISOString(),
      }),
    } as Response);
    wrap(<IsoNotificationSettingsForm {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Save settings/ }));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/admin/settings/iso-notifications",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          enabled: true,
          toEmails: ["iso@teamsquared.io"],
          ccEmails: [],
        }),
      }),
    );
  });

  it("surfaces an error message when the server returns an error body", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "Bad input" }),
    } as Response);
    wrap(<IsoNotificationSettingsForm {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Save settings/ }));
    expect(await screen.findByText("Bad input")).toBeInTheDocument();
  });
});

describe("CourseManagersPanel", () => {
  const managers = [
    {
      id: "u-1",
      name: "Manager One",
      email: "m1@example.com",
      role: "COURSE_MANAGER" as const,
    },
  ];
  const assignable = [
    {
      id: "u-1",
      name: "Manager One",
      email: "m1@example.com",
      role: "COURSE_MANAGER" as const,
    },
    {
      id: "u-2",
      name: "Manager Two",
      email: "m2@example.com",
      role: "COURSE_MANAGER" as const,
    },
    {
      id: "u-3",
      name: null,
      email: "admin@example.com",
      role: "ADMIN" as const,
    },
  ];

  it("renders existing managers", () => {
    wrap(
      <CourseManagersPanel
        courseId="c-1"
        initialManagers={managers}
        assignableUsers={assignable}
      />,
    );
    expect(screen.getByText("Manager One")).toBeInTheDocument();
  });

  it("renders the empty-state copy when no managers", () => {
    wrap(
      <CourseManagersPanel
        courseId="c-1"
        initialManagers={[]}
        assignableUsers={assignable}
      />,
    );
    expect(
      screen.getByText(/Only admins can edit this course/),
    ).toBeInTheDocument();
  });

  it("excludes already-linked users from the Add dropdown", () => {
    wrap(
      <CourseManagersPanel
        courseId="c-1"
        initialManagers={managers}
        assignableUsers={assignable}
      />,
    );
    const select = screen.getByLabelText(
      "Select user to add as a manager",
    ) as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    // u-1 already linked.
    expect(options).not.toContain("u-1");
    expect(options).toContain("u-2");
    expect(options).toContain("u-3");
  });

  it("POSTs to /managers when Add is clicked", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "u-2",
        name: "Manager Two",
        email: "m2@example.com",
        role: "COURSE_MANAGER",
      }),
    } as Response);
    wrap(
      <CourseManagersPanel
        courseId="c-1"
        initialManagers={managers}
        assignableUsers={assignable}
      />,
    );
    fireEvent.change(screen.getByLabelText("Select user to add as a manager"), {
      target: { value: "u-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/admin/courses/c-1/managers",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ userId: "u-2" }),
      }),
    );
  });

  it("DELETEs when Remove is clicked", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: true } as Response);
    wrap(
      <CourseManagersPanel
        courseId="c-1"
        initialManagers={managers}
        assignableUsers={assignable}
      />,
    );
    fireEvent.click(screen.getByLabelText("Remove Manager One"));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/admin/courses/c-1/managers/u-1",
      { method: "DELETE" },
    );
  });

  it("surfaces server error from the add path", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "User already linked" }),
    } as Response);
    wrap(
      <CourseManagersPanel
        courseId="c-1"
        initialManagers={[]}
        assignableUsers={assignable}
      />,
    );
    fireEvent.change(screen.getByLabelText("Select user to add as a manager"), {
      target: { value: "u-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("User already linked")).toBeInTheDocument();
  });
});
