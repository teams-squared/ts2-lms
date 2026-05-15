import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.unmock("@/components/ui/ToastProvider");

vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/components/analytics/PostHogProvider", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/theme/ThemeProvider", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

import Providers from "@/components/auth/Providers";

describe("Providers", () => {
  it("renders children through the full provider stack", () => {
    render(
      <Providers>
        <div data-testid="page-content">page</div>
      </Providers>,
    );
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
  });
});
