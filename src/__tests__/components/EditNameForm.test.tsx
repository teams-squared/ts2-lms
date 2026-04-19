import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditNameForm } from "@/components/profile/EditNameForm";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

describe("EditNameForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders 'Edit name' button in idle state", () => {
    render(<EditNameForm currentName="Alice" />);
    expect(screen.getByText("Edit name")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows form with current name pre-filled on Edit click", () => {
    render(<EditNameForm currentName="Alice" />);
    fireEvent.click(screen.getByText("Edit name"));
    expect(screen.getByRole("textbox")).toHaveValue("Alice");
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("shows empty input when currentName is null", () => {
    render(<EditNameForm currentName={null} />);
    fireEvent.click(screen.getByText("Edit name"));
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("returns to idle on Cancel", () => {
    render(<EditNameForm currentName="Alice" />);
    fireEvent.click(screen.getByText("Edit name"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.getByText("Edit name")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("restores original name on Cancel after editing", () => {
    render(<EditNameForm currentName="Alice" />);
    fireEvent.click(screen.getByText("Edit name"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Bob" } });
    fireEvent.click(screen.getByText("Cancel"));
    // Re-open and verify original value restored
    fireEvent.click(screen.getByText("Edit name"));
    expect(screen.getByRole("textbox")).toHaveValue("Alice");
  });

  it("shows validation error when submitting empty name", async () => {
    render(<EditNameForm currentName="Alice" />);
    fireEvent.click(screen.getByText("Edit name"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    fireEvent.click(screen.getByText("Save"));
    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("calls PATCH /api/user/profile with trimmed name on submit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    render(<EditNameForm currentName="Alice" />);
    fireEvent.click(screen.getByText("Edit name"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Bob" } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        "/api/user/profile",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ name: "Bob" }),
        }),
      );
    });
  });

  it("returns to idle and calls router.refresh on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    render(<EditNameForm currentName="Alice" />);
    fireEvent.click(screen.getByText("Edit name"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Bob" } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText("Edit name")).toBeInTheDocument();
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("shows server error message on API failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Name taken" }),
      }),
    );
    render(<EditNameForm currentName="Alice" />);
    fireEvent.click(screen.getByText("Edit name"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Bob" } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText("Name taken")).toBeInTheDocument();
    });
    // Should remain in editing state
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("shows generic error on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network down")));
    render(<EditNameForm currentName="Alice" />);
    fireEvent.click(screen.getByText("Edit name"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Bob" } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(
        screen.getByText("An unexpected error occurred"),
      ).toBeInTheDocument();
    });
  });

  it("disables Save button while saving", async () => {
    let resolveRequest!: (val: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        new Promise((res) => {
          resolveRequest = res;
        }),
      ),
    );
    render(<EditNameForm currentName="Alice" />);
    fireEvent.click(screen.getByText("Edit name"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Bob" } });
    fireEvent.click(screen.getByText("Save"));

    expect(screen.getByText("Saving…")).toBeDisabled();

    // Clean up the pending promise
    resolveRequest({ ok: true, json: async () => ({}) });
  });
});
