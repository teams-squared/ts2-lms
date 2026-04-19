import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LessonNavigation } from "@/components/courses/LessonNavigation";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/components/icons", () => ({
  ChevronLeftIcon: (props: Record<string, unknown>) => (
    <svg data-testid="chevron-left" {...props} />
  ),
  ChevronRightIcon: (props: Record<string, unknown>) => (
    <svg data-testid="chevron-right" {...props} />
  ),
}));

const modules = [
  {
    lessons: [
      { id: "l1", title: "Lesson One" },
      { id: "l2", title: "Lesson Two" },
      { id: "l3", title: "Lesson Three" },
    ],
  },
];

describe("LessonNavigation", () => {
  it("renders nothing when currentLessonId is not found", () => {
    const { container } = render(
      <LessonNavigation courseId="c1" currentLessonId="unknown" modules={modules} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when course has only one lesson", () => {
    const { container } = render(
      <LessonNavigation
        courseId="c1"
        currentLessonId="l1"
        modules={[{ lessons: [{ id: "l1", title: "Only Lesson" }] }]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders only Next for the first lesson", () => {
    render(
      <LessonNavigation courseId="c1" currentLessonId="l1" modules={modules} />,
    );
    expect(screen.queryByText("Previous")).not.toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(screen.getByText("Lesson Two")).toBeInTheDocument();
  });

  it("renders only Previous for the last lesson", () => {
    render(
      <LessonNavigation courseId="c1" currentLessonId="l3" modules={modules} />,
    );
    expect(screen.getByText("Previous")).toBeInTheDocument();
    expect(screen.queryByText("Next")).not.toBeInTheDocument();
    expect(screen.getByText("Lesson Two")).toBeInTheDocument();
  });

  it("renders both Previous and Next for a middle lesson", () => {
    render(
      <LessonNavigation courseId="c1" currentLessonId="l2" modules={modules} />,
    );
    expect(screen.getByText("Previous")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(screen.getByText("Lesson One")).toBeInTheDocument();
    expect(screen.getByText("Lesson Three")).toBeInTheDocument();
  });

  it("generates correct hrefs for prev and next links", () => {
    render(
      <LessonNavigation courseId="c1" currentLessonId="l2" modules={modules} />,
    );
    const prevLink = screen.getByText("Lesson One").closest("a");
    const nextLink = screen.getByText("Lesson Three").closest("a");
    expect(prevLink).toHaveAttribute("href", "/courses/c1/lessons/l1");
    expect(nextLink).toHaveAttribute("href", "/courses/c1/lessons/l3");
  });

  it("flattens lessons across multiple modules", () => {
    const multiModules = [
      { lessons: [{ id: "l1", title: "Intro" }] },
      { lessons: [{ id: "l2", title: "Advanced" }] },
    ];
    render(
      <LessonNavigation courseId="c1" currentLessonId="l1" modules={multiModules} />,
    );
    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(screen.getByText("Advanced")).toBeInTheDocument();
  });
});
