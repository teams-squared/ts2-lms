import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModuleList } from "@/components/courses/ModuleList";

vi.mock("@/components/icons", () => ({
  ChevronDownIcon: (props: Record<string, unknown>) => <svg data-testid="chevron-down" {...props} />,
  ChevronRightIcon: (props: Record<string, unknown>) => <svg data-testid="chevron-right" {...props} />,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const sampleModules = [
  {
    id: "m1",
    title: "Module 1",
    order: 1,
    lessons: [
      { id: "l1", title: "Lesson A", type: "text" as const, order: 1 },
      { id: "l2", title: "Lesson B", type: "video" as const, order: 2 },
    ],
  },
  {
    id: "m2",
    title: "Module 2",
    order: 2,
    lessons: [
      { id: "l3", title: "Quiz C", type: "quiz" as const, order: 1 },
    ],
  },
];

describe("ModuleList", () => {
  it("renders empty state when no modules", () => {
    render(<ModuleList modules={[]} courseId="c1" />);
    expect(screen.getByText("No modules yet.")).toBeInTheDocument();
  });

  it("renders module titles", () => {
    render(<ModuleList modules={sampleModules} courseId="c1" />);
    expect(screen.getByText("Module 1")).toBeInTheDocument();
    expect(screen.getByText("Module 2")).toBeInTheDocument();
  });

  it("renders lesson count per module", () => {
    render(<ModuleList modules={sampleModules} courseId="c1" />);
    expect(screen.getByText("2 lessons")).toBeInTheDocument();
    expect(screen.getByText("1 lesson")).toBeInTheDocument();
  });

  it("renders lesson titles when expanded (default)", () => {
    render(<ModuleList modules={sampleModules} courseId="c1" />);
    expect(screen.getByText("Lesson A")).toBeInTheDocument();
    expect(screen.getByText("Lesson B")).toBeInTheDocument();
    expect(screen.getByText("Quiz C")).toBeInTheDocument();
  });

  it("generates correct lesson links", () => {
    render(<ModuleList modules={sampleModules} courseId="c1" />);
    const link = screen.getByText("Lesson A").closest("a");
    expect(link).toHaveAttribute("href", "/courses/c1/lessons/l1");
  });

  it("collapses module on click", () => {
    render(<ModuleList modules={sampleModules} courseId="c1" />);
    expect(screen.getByText("Lesson A")).toBeInTheDocument();

    // Click to collapse Module 1
    fireEvent.click(screen.getByText("Module 1"));
    expect(screen.queryByText("Lesson A")).not.toBeInTheDocument();

    // Module 2 lessons should still be visible
    expect(screen.getByText("Quiz C")).toBeInTheDocument();
  });

  it("renders lesson type icons", () => {
    render(<ModuleList modules={sampleModules} courseId="c1" />);
    // text=📄, video=🎬, quiz=❓
    expect(screen.getByText("📄")).toBeInTheDocument();
    expect(screen.getByText("🎬")).toBeInTheDocument();
    expect(screen.getByText("❓")).toBeInTheDocument();
  });
});
