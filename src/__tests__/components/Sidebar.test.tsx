import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Sidebar from "@/components/layout/Sidebar";
import type { Category } from "@/lib/types";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/docs/getting-started"),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

const FLAT_CATEGORIES: Category[] = [
  { slug: "getting-started", title: "Getting Started", description: "", icon: "rocket", minRole: "employee", order: 1 },
  { slug: "engineering", title: "Engineering", description: "", icon: "code", minRole: "employee", order: 2 },
];

const NESTED_CATEGORIES: Category[] = [
  { slug: "cybersecurity", title: "Cybersecurity", description: "", icon: "shield", minRole: "employee", order: 1 },
  {
    slug: "cyber-onboarding",
    title: "Cyber Onboarding",
    description: "",
    icon: "book",
    minRole: "employee",
    order: 2,
    parentCategory: "cybersecurity",
  },
  {
    slug: "cyber-advanced",
    title: "Cyber Advanced",
    description: "",
    icon: "book",
    minRole: "employee",
    order: 3,
    parentCategory: "cybersecurity",
  },
];

describe("Sidebar — flat categories", () => {
  it("renders all top-level category titles", () => {
    render(<Sidebar categories={FLAT_CATEGORIES} />);
    expect(screen.getByText("Getting Started")).toBeInTheDocument();
    expect(screen.getByText("Engineering")).toBeInTheDocument();
  });

  it("renders links to each category", () => {
    render(<Sidebar categories={FLAT_CATEGORIES} />);
    expect(screen.getByRole("link", { name: "Getting Started" })).toHaveAttribute(
      "href",
      "/docs/getting-started"
    );
  });

  it("applies active styles to the current category", () => {
    render(<Sidebar categories={FLAT_CATEGORIES} currentCategory="getting-started" />);
    const link = screen.getByRole("link", { name: "Getting Started" });
    expect(link.className).toContain("brand");
  });
});

describe("Sidebar — nested categories (accordion)", () => {
  it("renders parent category as an accordion button", () => {
    render(<Sidebar categories={NESTED_CATEGORIES} />);
    expect(screen.getByRole("button", { name: /Cybersecurity/i })).toBeInTheDocument();
  });

  it("children are initially hidden when parent is not active", () => {
    render(<Sidebar categories={NESTED_CATEGORIES} currentCategory="engineering" />);
    // Children are in the DOM but inside a grid-row: 0fr container — not visible
    const wrapper = screen.getByText("Cyber Onboarding").closest("div[style]") as HTMLElement;
    expect(wrapper?.style.gridTemplateRows).toBe("0fr");
  });

  it("opens accordion when parent button is clicked", async () => {
    const user = userEvent.setup();
    render(<Sidebar categories={NESTED_CATEGORIES} />);
    const btn = screen.getByRole("button", { name: /Cybersecurity/i });
    await user.click(btn);
    const wrapper = screen.getByText("Cyber Onboarding").closest("div[style]") as HTMLElement;
    expect(wrapper?.style.gridTemplateRows).toBe("1fr");
  });

  it("closes accordion on second click", async () => {
    const user = userEvent.setup();
    render(<Sidebar categories={NESTED_CATEGORIES} />);
    const btn = screen.getByRole("button", { name: /Cybersecurity/i });
    await user.click(btn); // open
    await user.click(btn); // close
    const wrapper = screen.getByText("Cyber Onboarding").closest("div[style]") as HTMLElement;
    expect(wrapper?.style.gridTemplateRows).toBe("0fr");
  });

  it("auto-opens parent when a child is the current category", () => {
    render(<Sidebar categories={NESTED_CATEGORIES} currentCategory="cyber-onboarding" />);
    const wrapper = screen.getByText("Cyber Onboarding").closest("div[style]") as HTMLElement;
    expect(wrapper?.style.gridTemplateRows).toBe("1fr");
  });
});

describe("Sidebar — documents section", () => {
  const docs = [
    { slug: "intro", title: "Introduction", category: "getting-started", description: "", minRole: "employee" as const, order: 1, tags: [], updatedAt: "" },
    { slug: "setup", title: "Setup Guide", category: "getting-started", description: "", minRole: "employee" as const, order: 2, tags: [], updatedAt: "" },
  ];

  it("renders doc list when currentCategory and docs are provided", () => {
    render(<Sidebar categories={FLAT_CATEGORIES} currentCategory="getting-started" docs={docs} />);
    expect(screen.getByText("Introduction")).toBeInTheDocument();
    expect(screen.getByText("Setup Guide")).toBeInTheDocument();
  });

  it("does not render doc list when docs is empty", () => {
    render(<Sidebar categories={FLAT_CATEGORIES} currentCategory="getting-started" docs={[]} />);
    expect(screen.queryByText("Documents")).not.toBeInTheDocument();
  });
});
