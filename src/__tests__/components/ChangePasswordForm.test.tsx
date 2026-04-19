import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChangePasswordForm } from "@/components/profile/ChangePasswordForm";

describe("ChangePasswordForm", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows SSO message when isSsoOnly is true", () => {
    render(<ChangePasswordForm isSsoOnly={true} />);
    expect(screen.getByText(/SSO accounts/i)).toBeInTheDocument();
    expect(screen.queryByTestId("change-password-trigger")).not.toBeInTheDocument();
  });

  it("shows trigger button when isSsoOnly is false", () => {
    render(<ChangePasswordForm isSsoOnly={false} />);
    expect(screen.getByTestId("change-password-trigger")).toBeInTheDocument();
  });

  it("shows form when trigger is clicked", () => {
    render(<ChangePasswordForm isSsoOnly={false} />);
    fireEvent.click(screen.getByTestId("change-password-trigger"));
    expect(screen.getByTestId("change-password-form")).toBeInTheDocument();
    expect(screen.getByTestId("current-password-input")).toBeInTheDocument();
    expect(screen.getByTestId("new-password-input")).toBeInTheDocument();
    expect(screen.getByTestId("confirm-password-input")).toBeInTheDocument();
  });

  it("shows error when passwords do not match", async () => {
    render(<ChangePasswordForm isSsoOnly={false} />);
    fireEvent.click(screen.getByTestId("change-password-trigger"));
    fireEvent.change(screen.getByTestId("current-password-input"), {
      target: { value: "oldpass" },
    });
    fireEvent.change(screen.getByTestId("new-password-input"), {
      target: { value: "newpass123" },
    });
    fireEvent.change(screen.getByTestId("confirm-password-input"), {
      target: { value: "different123" },
    });
    fireEvent.click(screen.getByTestId("save-password-button"));
    await waitFor(() => {
      expect(screen.getByTestId("password-error")).toHaveTextContent(
        "Passwords do not match",
      );
    });
  });

  it("shows error when new password is too short", async () => {
    render(<ChangePasswordForm isSsoOnly={false} />);
    fireEvent.click(screen.getByTestId("change-password-trigger"));
    fireEvent.change(screen.getByTestId("current-password-input"), {
      target: { value: "oldpass" },
    });
    fireEvent.change(screen.getByTestId("new-password-input"), {
      target: { value: "short" },
    });
    fireEvent.change(screen.getByTestId("confirm-password-input"), {
      target: { value: "short" },
    });
    fireEvent.submit(screen.getByTestId("change-password-form"));
    await waitFor(() => {
      expect(screen.getByTestId("password-error")).toHaveTextContent(
        "at least 8 characters",
      );
    });
  });

  it("calls fetch and closes form on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      }),
    );
    render(<ChangePasswordForm isSsoOnly={false} />);
    fireEvent.click(screen.getByTestId("change-password-trigger"));
    fireEvent.change(screen.getByTestId("current-password-input"), {
      target: { value: "oldpass123" },
    });
    fireEvent.change(screen.getByTestId("new-password-input"), {
      target: { value: "newpass123" },
    });
    fireEvent.change(screen.getByTestId("confirm-password-input"), {
      target: { value: "newpass123" },
    });
    fireEvent.click(screen.getByTestId("save-password-button"));
    await waitFor(() => {
      expect(screen.queryByTestId("change-password-form")).not.toBeInTheDocument();
      expect(screen.getByText(/Password updated successfully/i)).toBeInTheDocument();
    });
  });

  it("shows error from API response on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Current password is incorrect" }),
      }),
    );
    render(<ChangePasswordForm isSsoOnly={false} />);
    fireEvent.click(screen.getByTestId("change-password-trigger"));
    fireEvent.change(screen.getByTestId("current-password-input"), {
      target: { value: "wrongpass" },
    });
    fireEvent.change(screen.getByTestId("new-password-input"), {
      target: { value: "newpass123" },
    });
    fireEvent.change(screen.getByTestId("confirm-password-input"), {
      target: { value: "newpass123" },
    });
    fireEvent.click(screen.getByTestId("save-password-button"));
    await waitFor(() => {
      expect(screen.getByTestId("password-error")).toHaveTextContent(
        "Current password is incorrect",
      );
    });
  });

  it("closes form when cancel is clicked", () => {
    render(<ChangePasswordForm isSsoOnly={false} />);
    fireEvent.click(screen.getByTestId("change-password-trigger"));
    expect(screen.getByTestId("change-password-form")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByTestId("change-password-form")).not.toBeInTheDocument();
  });
});
