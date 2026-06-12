import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";

beforeEach(() => {
  vi.clearAllMocks();
  // RevealOnView constructs an IntersectionObserver; happy-dom lacks one.
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
});

describe("OnboardingModal", () => {
  it("renders nothing when the user has already onboarded", () => {
    const { container } = render(<OnboardingModal needsOnboarding={false} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("onboarding-modal")).toBeNull();
  });

  it("shows the welcome slide first, then advances to how-it-works", () => {
    render(<OnboardingModal needsOnboarding />);
    expect(screen.getByText("Welcome to Teams Squared")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(screen.getByText("How it works")).toBeInTheDocument();
    expect(screen.getByText("Work through courses")).toBeInTheDocument();
    expect(screen.getByText("Stay on time")).toBeInTheDocument();
  });

  it("stamps onboarding complete on finish", async () => {
    render(<OnboardingModal needsOnboarding />);
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/user/onboarding", { method: "POST" });
    });
  });

  it("stamps onboarding complete when skipped from the first slide", async () => {
    render(<OnboardingModal needsOnboarding />);
    fireEvent.click(screen.getByRole("button", { name: /skip/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/user/onboarding", { method: "POST" });
    });
  });

  it("only stamps once even across multiple close paths", async () => {
    render(<OnboardingModal needsOnboarding />);
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });
});
