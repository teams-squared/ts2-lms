import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.unmock("@/components/ui/ToastProvider");

import { CourseDeleteZone } from "@/components/courses/CourseDeleteZone";
import { ToastProvider } from "@/components/ui/ToastProvider";

const fetchSpy = vi.fn();
beforeEach(() => {
  fetchSpy.mockReset();
  // @ts-expect-error — happy-dom doesn't expose fetch on globalThis by default.
  global.fetch = fetchSpy;
});

function renderZone(title = "Auth Basics") {
  return render(
    <ToastProvider>
      <CourseDeleteZone courseId="course-1" courseTitle={title} />
    </ToastProvider>,
  );
}

describe("CourseDeleteZone", () => {
  it("renders the danger-zone heading and the delete trigger", () => {
    renderZone();
    expect(screen.getByText("Danger zone")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete course" }),
    ).toBeInTheDocument();
  });

  it("opens the confirm dialog on trigger click", () => {
    renderZone();
    fireEvent.click(screen.getByRole("button", { name: "Delete course" }));
    // The dialog title appears once it's open.
    expect(screen.getByText("Delete this course?")).toBeInTheDocument();
  });

  it("disables the confirm button until the title is typed exactly", () => {
    renderZone("Auth Basics");
    fireEvent.click(screen.getByRole("button", { name: "Delete course" }));
    // Multiple "Delete course" buttons exist now (trigger + dialog confirm).
    const dialogConfirm = screen
      .getAllByRole("button", { name: "Delete course" })
      .find((b) => b.hasAttribute("disabled"));
    expect(dialogConfirm).toBeTruthy();

    // Type a wrong value first.
    const input = screen.getByLabelText(/Type.*to confirm/);
    fireEvent.change(input, { target: { value: "wrong" } });
    expect(
      screen
        .getAllByRole("button", { name: "Delete course" })
        .find((b) => !b.hasAttribute("disabled") && b !== screen.getByText("Danger zone").parentElement?.querySelector("button")),
    ).toBeUndefined();

    // Type the exact title.
    fireEvent.change(input, { target: { value: "Auth Basics" } });
    const enabledConfirm = screen
      .getAllByRole("button", { name: "Delete course" })
      .find((b) => !b.hasAttribute("disabled"));
    expect(enabledConfirm).toBeTruthy();
  });

  it("fires DELETE /api/admin/courses/:id when confirmed", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: true } as Response);
    renderZone("Auth Basics");
    fireEvent.click(screen.getByRole("button", { name: "Delete course" }));
    fireEvent.change(screen.getByLabelText(/Type.*to confirm/), {
      target: { value: "Auth Basics" },
    });
    const confirm = screen
      .getAllByRole("button", { name: "Delete course" })
      .find((b) => !b.hasAttribute("disabled"));
    fireEvent.click(confirm!);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/admin/courses/course-1",
      { method: "DELETE" },
    );
  });

  it("shows the server-supplied error message when the API returns 4xx", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Has enrolled users" }),
    } as Response);
    renderZone("Auth Basics");
    fireEvent.click(screen.getByRole("button", { name: "Delete course" }));
    fireEvent.change(screen.getByLabelText(/Type.*to confirm/), {
      target: { value: "Auth Basics" },
    });
    fireEvent.click(
      screen
        .getAllByRole("button", { name: "Delete course" })
        .find((b) => !b.hasAttribute("disabled"))!,
    );
    // Allow the awaited promise chain to flush.
    await Promise.resolve();
    await Promise.resolve();
    expect(await screen.findByText("Has enrolled users")).toBeInTheDocument();
  });

  it("renders a generic error when fetch rejects", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("offline"));
    renderZone("Auth Basics");
    fireEvent.click(screen.getByRole("button", { name: "Delete course" }));
    fireEvent.change(screen.getByLabelText(/Type.*to confirm/), {
      target: { value: "Auth Basics" },
    });
    fireEvent.click(
      screen
        .getAllByRole("button", { name: "Delete course" })
        .find((b) => !b.hasAttribute("disabled"))!,
    );
    expect(
      await screen.findByText("An unexpected error occurred"),
    ).toBeInTheDocument();
  });

  it("clears confirmText and error when the dialog closes via Cancel", () => {
    renderZone("Auth Basics");
    fireEvent.click(screen.getByRole("button", { name: "Delete course" }));
    fireEvent.change(screen.getByLabelText(/Type.*to confirm/), {
      target: { value: "Auth Basics" },
    });
    // Cancel button label comes from ConfirmDialog default.
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    fireEvent.click(screen.getByRole("button", { name: "Delete course" }));
    // Confirm input is back to empty.
    expect(
      (screen.getByLabelText(/Type.*to confirm/) as HTMLInputElement).value,
    ).toBe("");
  });
});
