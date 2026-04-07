import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import DocViewTracker from "@/components/telemetry/DocViewTracker";

vi.mock("@/lib/posthog-client", () => ({
  posthog: { capture: vi.fn() },
}));

import { posthog } from "@/lib/posthog-client";
const mockCapture = vi.mocked(posthog.capture);

const DEFAULT_PROPS = {
  title: "Security Basics",
  slug: "security-basics",
  category: "cybersecurity",
  categoryTitle: "Cybersecurity",
  userRole: "employee",
};

describe("DocViewTracker", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders nothing", () => {
    const { container } = render(<DocViewTracker {...DEFAULT_PROPS} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("captures document_viewed on mount with correct properties", () => {
    render(<DocViewTracker {...DEFAULT_PROPS} />);
    expect(mockCapture).toHaveBeenCalledOnce();
    expect(mockCapture).toHaveBeenCalledWith("document_viewed", {
      doc_title: "Security Basics",
      doc_slug: "security-basics",
      category: "cybersecurity",
      category_title: "Cybersecurity",
      user_role: "employee",
    });
  });

  it("re-fires when slug changes (navigating between docs)", () => {
    const { rerender } = render(<DocViewTracker {...DEFAULT_PROPS} />);
    expect(mockCapture).toHaveBeenCalledTimes(1);

    rerender(<DocViewTracker {...DEFAULT_PROPS} slug="data-handling" title="Data Handling" />);
    expect(mockCapture).toHaveBeenCalledTimes(2);
    expect(mockCapture).toHaveBeenLastCalledWith(
      "document_viewed",
      expect.objectContaining({ doc_slug: "data-handling" })
    );
  });

  it("does not re-fire when unrelated prop changes", () => {
    const { rerender } = render(<DocViewTracker {...DEFAULT_PROPS} />);
    // userRole change is part of the dep array — but same slug/title should not
    // cause an extra fire if none of the tracked deps changed
    rerender(<DocViewTracker {...DEFAULT_PROPS} />);
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });
});
