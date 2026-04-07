import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/docs/engineering/setup",
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
    title,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    title?: string;
  }) => (
    <a href={href} className={className} title={title}>
      {children}
    </a>
  ),
}));

import RecentlyViewed, { DocVisitRecorder } from "@/components/docs/RecentlyViewed";

const STORAGE_KEY = "recently-viewed-docs";

beforeEach(() => {
  localStorage.clear();
});

describe("DocVisitRecorder", () => {
  it("adds an entry to localStorage on mount", () => {
    render(<DocVisitRecorder title="Setup Guide" href="/docs/engineering/setup" />);
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const entries = JSON.parse(raw!);
    expect(entries[0].title).toBe("Setup Guide");
    expect(entries[0].href).toBe("/docs/engineering/setup");
  });

  it("deduplicates by href (moves to front)", () => {
    render(<DocVisitRecorder title="Setup Guide" href="/docs/engineering/setup" />);
    render(<DocVisitRecorder title="Other Doc" href="/docs/engineering/other" />);
    render(<DocVisitRecorder title="Setup Guide" href="/docs/engineering/setup" />);
    const entries = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(entries[0].href).toBe("/docs/engineering/setup");
    expect(entries.filter((e: { href: string }) => e.href === "/docs/engineering/setup")).toHaveLength(1);
  });

  it("renders nothing", () => {
    const { container } = render(<DocVisitRecorder title="X" href="/x" />);
    expect(container.firstChild).toBeNull();
  });
});

describe("RecentlyViewed", () => {
  it("renders nothing when localStorage is empty", () => {
    const { container } = render(<RecentlyViewed />);
    expect(container.firstChild).toBeNull();
  });

  it("renders entries from localStorage after mount", () => {
    const entries = [
      { title: "Doc A", href: "/docs/cat/doc-a", visitedAt: Date.now() },
      { title: "Doc B", href: "/docs/cat/doc-b", visitedAt: Date.now() - 1000 },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    render(<RecentlyViewed />);
    expect(screen.getByText("Doc A")).toBeInTheDocument();
    expect(screen.getByText("Doc B")).toBeInTheDocument();
  });

  it("marks the current pathname as active", () => {
    const entries = [
      { title: "Setup", href: "/docs/engineering/setup", visitedAt: Date.now() },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    render(<RecentlyViewed />);
    const link = screen.getByText("Setup");
    expect(link.className).toMatch(/brand-700/);
  });
});
