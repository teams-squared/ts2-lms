import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock posthog-js so importing the module doesn't actually init.
vi.mock("posthog-js", () => ({
  default: { init: vi.fn() },
}));
vi.mock("posthog-js/react", () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

import { PostHogProviderInner } from "@/components/analytics/PostHogProviderInner";

describe("PostHogProviderInner", () => {
  it("renders children when not initialised (no NEXT_PUBLIC_POSTHOG_KEY)", () => {
    render(
      <PostHogProviderInner>
        <div data-testid="child">child</div>
      </PostHogProviderInner>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});
