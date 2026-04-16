import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CourseSidebar } from "@/components/courses/CourseSidebar";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => <a href={href} className={className}>{children}</a>,
}));

vi.mock("@/components/icons", () => ({
  ChevronLeftIcon: (props: Record<string, unknown>) => (
    <svg data-testid="chevron-left" {...props} />
  ),
  CheckCircleIcon: (props: Record<string, unknown>) => (
    <svg data-testid="check-circle" {...props} />
  ),
  HamburgerIcon: (props: Record<string, unknown>) => (
    <svg data-testid="hamburger" {...props} />
  ),
  CloseIcon: (props: Record<string, unknown>) => (
    <svg data-testid="close" {...props} />
  ),
  DocumentTextIcon: (props: Record<string, unknown>) => (
    <svg data-testid="icon-text" {...props} />
  ),
  VideoIcon: (props: Record<string, unknown>) => (
    <svg data-testid="icon-video" {...props} />
  ),
  QuizIcon: (props: Record<string, unknown>) => (
    <svg data-testid="icon-quiz" {...props} />
  ),
  PaperclipIcon: (props: Record<string, unknown>) => (
    <svg data-testid="icon-document" {...props} />
  ),
}));

const sampleModules = [
  {
    id: "m1",
    title: "Module One",
    order: 1,
    lessons: [
      { id: "l1", title: "Lesson A", type: "text" as const, order: 1 },
      { id: "l2", title: "Lesson B", type: "video" as const, order: 2 },
    ],
  },
  {
    id: "m2",
    title: "Module Two",
    order: 2,
    lessons: [{ id: "l3", title: "Lesson C", type: "quiz" as const, order: 1 }],
  },
];

describe("CourseSidebar", () => {
  it("renders course title and back link", () => {
    render(
      <CourseSidebar
        modules={sampleModules}
        courseId="c1"
        currentLessonId="l1"
        courseTitle="My Course"
      />,
    );
    expect(screen.getByText("My Course")).toBeInTheDocument();
    expect(screen.getByText("Back to course")).toBeInTheDocument();
    const backLink = screen.getByText("Back to course").closest("a");
    expect(backLink).toHaveAttribute("href", "/courses/c1");
  });

  it("renders all module titles and lesson titles", () => {
    render(
      <CourseSidebar
        modules={sampleModules}
        courseId="c1"
        currentLessonId="l1"
        courseTitle="My Course"
      />,
    );
    expect(screen.getByText("Module One")).toBeInTheDocument();
    expect(screen.getByText("Module Two")).toBeInTheDocument();
    expect(screen.getByText("Lesson A")).toBeInTheDocument();
    expect(screen.getByText("Lesson B")).toBeInTheDocument();
    expect(screen.getByText("Lesson C")).toBeInTheDocument();
  });

  it("generates correct lesson href links", () => {
    render(
      <CourseSidebar
        modules={sampleModules}
        courseId="c1"
        currentLessonId="l1"
        courseTitle="My Course"
      />,
    );
    const link = screen.getByText("Lesson B").closest("a");
    expect(link).toHaveAttribute("href", "/courses/c1/lessons/l2");
  });

  it("shows progress bar when lessons exist", () => {
    render(
      <CourseSidebar
        modules={sampleModules}
        courseId="c1"
        currentLessonId="l1"
        courseTitle="My Course"
        percentComplete={33.3}
      />,
    );
    expect(screen.getByTestId("progress-bar-container")).toBeInTheDocument();
    expect(screen.getByTestId("progress-percent")).toHaveTextContent("33.3%");
    const bar = screen.getByTestId("progress-bar");
    expect(bar).toHaveStyle("width: 33.3%");
  });

  it("does not show progress bar when there are no lessons", () => {
    render(
      <CourseSidebar
        modules={[]}
        courseId="c1"
        currentLessonId="l1"
        courseTitle="My Course"
        percentComplete={0}
      />,
    );
    expect(screen.queryByTestId("progress-bar-container")).not.toBeInTheDocument();
  });

  it("shows checkmark icon for completed lessons only", () => {
    render(
      <CourseSidebar
        modules={sampleModules}
        courseId="c1"
        currentLessonId="l1"
        courseTitle="My Course"
        completedLessonIds={new Set(["l1", "l3"])}
      />,
    );
    expect(screen.getByTestId("completed-icon-l1")).toBeInTheDocument();
    expect(screen.getByTestId("completed-icon-l3")).toBeInTheDocument();
    expect(screen.queryByTestId("completed-icon-l2")).not.toBeInTheDocument();
  });

  it("does not show any checkmarks when completedLessonIds is empty", () => {
    render(
      <CourseSidebar
        modules={sampleModules}
        courseId="c1"
        currentLessonId="l1"
        courseTitle="My Course"
        completedLessonIds={new Set()}
      />,
    );
    expect(screen.queryByTestId(/completed-icon/)).not.toBeInTheDocument();
  });

  it("applies active styles to the current lesson link", () => {
    render(
      <CourseSidebar
        modules={sampleModules}
        courseId="c1"
        currentLessonId="l2"
        courseTitle="My Course"
      />,
    );
    const activeLink = screen.getByText("Lesson B").closest("a");
    expect(activeLink?.className).toMatch(/brand/);
  });

  it("defaults percentComplete to 0 and completedLessonIds to empty set when not provided", () => {
    render(
      <CourseSidebar
        modules={sampleModules}
        courseId="c1"
        currentLessonId="l1"
        courseTitle="My Course"
      />,
    );
    expect(screen.getByTestId("progress-percent")).toHaveTextContent("0%");
    expect(screen.queryByTestId(/completed-icon/)).not.toBeInTheDocument();
  });
});
