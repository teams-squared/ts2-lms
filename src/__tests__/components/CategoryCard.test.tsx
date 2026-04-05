import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CategoryCard from "@/components/docs/CategoryCard";
import { CATEGORY_COLORS } from "@/components/icons";
import type { Category } from "@/lib/types";

// next/link renders a standard <a> in test environments
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const BASE_CATEGORY: Category = {
  slug: "getting-started",
  title: "Getting Started",
  description: "Everything you need to begin",
  icon: "rocket",
  minRole: "employee",
  order: 1,
};

describe("CategoryCard", () => {
  it("renders category title and description", () => {
    render(<CategoryCard category={BASE_CATEGORY} docCount={3} />);
    expect(screen.getByText("Getting Started")).toBeInTheDocument();
    expect(screen.getByText("Everything you need to begin")).toBeInTheDocument();
  });

  it("links to the correct docs path", () => {
    render(<CategoryCard category={BASE_CATEGORY} docCount={3} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/docs/getting-started");
  });

  it("shows doc count when no titles provided", () => {
    render(<CategoryCard category={BASE_CATEGORY} docCount={5} />);
    expect(screen.getByText("5 documents")).toBeInTheDocument();
  });

  it("uses singular 'document' for count of 1", () => {
    render(<CategoryCard category={BASE_CATEGORY} docCount={1} />);
    expect(screen.getByText("1 document")).toBeInTheDocument();
  });

  it("shows up to 5 doc titles", () => {
    const titles = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"];
    render(<CategoryCard category={BASE_CATEGORY} docCount={6} docTitles={titles} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Epsilon")).toBeInTheDocument();
    expect(screen.queryByText("Zeta")).not.toBeInTheDocument();
  });

  it("shows +N more when more than 5 titles", () => {
    const titles = ["A", "B", "C", "D", "E", "F", "G"];
    render(<CategoryCard category={BASE_CATEGORY} docCount={7} docTitles={titles} />);
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });

  it("does not show +N more when 5 or fewer titles", () => {
    const titles = ["A", "B", "C"];
    render(<CategoryCard category={BASE_CATEGORY} docCount={3} docTitles={titles} />);
    expect(screen.queryByText(/more/)).not.toBeInTheDocument();
  });

  it("applies the correct icon background color for rocket", () => {
    const { container } = render(<CategoryCard category={BASE_CATEGORY} docCount={0} />);
    // React renders inline style as background-color in HTML
    const iconWrapper = container.querySelector('[style*="background-color"]') as HTMLElement;
    expect(iconWrapper?.style.backgroundColor).toBe(CATEGORY_COLORS["rocket"]);
  });

  it("falls back to default color for unknown icon", () => {
    const cat = { ...BASE_CATEGORY, icon: "unknown-icon" };
    const { container } = render(<CategoryCard category={cat} docCount={0} />);
    const iconWrapper = container.querySelector('[style*="background-color"]') as HTMLElement;
    expect(iconWrapper?.style.backgroundColor).toBe("#f0e6ff");
  });
});
