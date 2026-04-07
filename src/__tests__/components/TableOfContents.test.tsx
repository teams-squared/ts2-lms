import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TableOfContents from "@/components/docs/TableOfContents";
import type { TocHeading } from "@/components/docs/TableOfContents";

// Mock IntersectionObserver (not available in happy-dom test env)
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();
class MockIntersectionObserver {
  observe = mockObserve;
  disconnect = mockDisconnect;
  constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {}
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

const HEADINGS: TocHeading[] = [
  { depth: 1, text: "Introduction", id: "introduction" },
  { depth: 2, text: "Getting Started", id: "getting-started" },
  { depth: 3, text: "Prerequisites", id: "prerequisites" },
];

describe("TableOfContents", () => {
  it("renders heading links", () => {
    render(<TableOfContents headings={HEADINGS} />);
    expect(screen.getByText("Introduction")).toBeInTheDocument();
    expect(screen.getByText("Getting Started")).toBeInTheDocument();
    expect(screen.getByText("Prerequisites")).toBeInTheDocument();
  });

  it("links use correct anchor href", () => {
    render(<TableOfContents headings={HEADINGS} />);
    const link = screen.getByText("Getting Started").closest("a");
    expect(link).toHaveAttribute("href", "#getting-started");
  });

  it("renders nothing when headings array is empty", () => {
    const { container } = render(<TableOfContents headings={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("applies depth-based indentation classes", () => {
    render(<TableOfContents headings={HEADINGS} />);
    const h3Link = screen.getByText("Prerequisites").closest("a");
    expect(h3Link?.className).toMatch(/pl-6/);
    const h2Link = screen.getByText("Getting Started").closest("a");
    expect(h2Link?.className).toMatch(/pl-3/);
  });

  it("renders the 'On this page' label", () => {
    render(<TableOfContents headings={HEADINGS} />);
    expect(screen.getByText(/on this page/i)).toBeInTheDocument();
  });
});
