import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";

// The dashboard is a server component, so OnboardingModal is server-rendered
// before hydration. The client-render tests (happy-dom) never exercised this
// path. Reproduce the SSR pass that runs in production.
describe("OnboardingModal SSR", () => {
  it("server-renders without throwing when onboarding is needed", () => {
    expect(() => renderToString(<OnboardingModal needsOnboarding />)).not.toThrow();
  });

  it("server-renders nothing when already onboarded", () => {
    expect(renderToString(<OnboardingModal needsOnboarding={false} />)).toBe("");
  });
});
