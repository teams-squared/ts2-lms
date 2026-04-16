import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EnrollButton } from "@/components/courses/EnrollButton";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/components/icons", () => ({
  ChevronRightIcon: (props: Record<string, unknown>) => (
    <svg data-testid="chevron-right" {...props} />
  ),
}));

const base = {
  courseId: "c1",
  isLocked: false,
  enrolled: true,
  isComplete: false,
  firstLessonUrl: "/courses/c1/lessons/l1",
  continueUrl: "/courses/c1/lessons/l2",
};

describe("EnrollButton", () => {
  it("renders nothing when locked", () => {
    const { container } = render(<EnrollButton {...base} isLocked={true} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when not enrolled", () => {
    const { container } = render(<EnrollButton {...base} enrolled={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when firstLessonUrl is null", () => {
    const { container } = render(
      <EnrollButton {...base} firstLessonUrl={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders 'Continue Learning' link for enrolled in-progress user", () => {
    render(<EnrollButton {...base} />);
    expect(screen.getByText("Continue Learning")).toBeInTheDocument();
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/courses/c1/lessons/l2");
  });

  it("uses firstLessonUrl when continueUrl is null and not complete", () => {
    render(<EnrollButton {...base} continueUrl={null} />);
    expect(screen.getByText("Continue Learning")).toBeInTheDocument();
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/courses/c1/lessons/l1");
  });

  it("renders 'Review Course' link for enrolled complete user", () => {
    render(<EnrollButton {...base} isComplete={true} />);
    expect(screen.getByText("Review Course")).toBeInTheDocument();
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/courses/c1/lessons/l1");
  });

  it("renders nothing when locked even if enrolled and has lessons", () => {
    const { container } = render(
      <EnrollButton {...base} isLocked={true} enrolled={true} isComplete={true} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
