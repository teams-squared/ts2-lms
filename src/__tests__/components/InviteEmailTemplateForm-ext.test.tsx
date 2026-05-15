import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.unmock("@/components/ui/ToastProvider");

import { ToastProvider } from "@/components/ui/ToastProvider";
import { InviteEmailTemplateForm } from "@/components/admin/InviteEmailTemplateForm";

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
  initialSubject: "Welcome to Teams Squared",
  initialBodyText: "",
  initialCc: ["cc@example.com"],
  defaultBodyText: "Hi {{firstName}}, default copy.",
  updatedAt: null,
};

describe("InviteEmailTemplateForm — interactions", () => {
  it("uses defaultBodyText for preview when bodyText is empty", () => {
    wrap(<InviteEmailTemplateForm {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Show preview/i }));
    // The preview interpolates "Jordan" as the sample firstName.
    const previews = screen.getAllByText(/Jordan/);
    expect(previews.length).toBeGreaterThan(0);
  });

  it("PATCHes the settings endpoint on Save", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        subject: "Welcome to Teams Squared",
        bodyText: "Hi {{firstName}},",
        ccEmails: ["cc@example.com"],
        updatedAt: new Date().toISOString(),
      }),
    } as Response);
    wrap(<InviteEmailTemplateForm {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Save( invite email)?/i }));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/admin/settings/invite-email",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("renders an error message when the server rejects the save", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "Subject too long" }),
    } as Response);
    wrap(<InviteEmailTemplateForm {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Save( invite email)?/i }));
    expect(await screen.findByText("Subject too long")).toBeInTheDocument();
  });

  it("Reset to default sets the body to defaultBodyText", () => {
    wrap(
      <InviteEmailTemplateForm
        {...baseProps}
        initialBodyText="Custom body content"
      />,
    );
    const textarea = screen.getByDisplayValue(
      "Custom body content",
    ) as HTMLTextAreaElement;
    fireEvent.click(screen.getByRole("button", { name: /Reset to default/i }));
    expect(textarea.value).toBe("Hi {{firstName}}, default copy.");
  });

  it("renders existing CC emails as pills", () => {
    wrap(<InviteEmailTemplateForm {...baseProps} />);
    expect(screen.getByText("cc@example.com")).toBeInTheDocument();
  });
});
