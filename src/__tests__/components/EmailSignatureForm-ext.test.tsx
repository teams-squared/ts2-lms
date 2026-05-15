import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.unmock("@/components/ui/ToastProvider");

import { ToastProvider } from "@/components/ui/ToastProvider";
import { EmailSignatureForm } from "@/components/admin/EmailSignatureForm";

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
  enabled: true,
  signOff: "Best,",
  name: "Akil",
  title: "PM",
  email: "akil@teamsquared.io",
  phone: "+1 555 0100",
  websiteUrl: "https://example.com",
  websiteLabel: "Visit us",
  addressLine: "123 Main St",
  logoUrl: "",
  disclaimer: "",
  defaultDisclaimer: "Default legal text.",
  updatedAt: null,
};

describe("EmailSignatureForm — interactions", () => {
  it("reflects the toggle state in the preview block", () => {
    const { container } = wrap(
      <EmailSignatureForm {...baseProps} enabled={false} />,
    );
    // Preview renders the "Signature disabled" fallback when enabled is false.
    expect(container.innerHTML).toContain("Signature disabled");
  });

  it("PATCHes the settings endpoint when Save is clicked", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        enabled: true,
        signOff: "Best,",
        name: "Akil",
        title: "PM",
        email: "akil@teamsquared.io",
        phone: "+1 555 0100",
        websiteUrl: "https://example.com",
        websiteLabel: "Visit us",
        addressLine: "123 Main St",
        logoUrl: "",
        disclaimer: "",
        updatedAt: new Date().toISOString(),
      }),
    } as Response);
    wrap(<EmailSignatureForm {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Save( signature)?/i }));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/admin/settings/email-signature",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("surfaces the server error message on save failure", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "Field too long" }),
    } as Response);
    wrap(<EmailSignatureForm {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Save( signature)?/i }));
    expect(await screen.findByText("Field too long")).toBeInTheDocument();
  });

  it("toggles the master switch and switches the preview to disabled copy", () => {
    const { container } = wrap(<EmailSignatureForm {...baseProps} />);
    expect(container.innerHTML).not.toContain("Signature disabled");
    fireEvent.click(screen.getByRole("checkbox"));
    expect(container.innerHTML).toContain("Signature disabled");
  });

  it("updates a text field when its input is edited", () => {
    wrap(<EmailSignatureForm {...baseProps} />);
    const titleInput = screen.getByDisplayValue("PM") as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "Product Manager" } });
    expect(titleInput.value).toBe("Product Manager");
  });
});
