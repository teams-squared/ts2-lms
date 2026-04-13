import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CourseEditor } from "@/components/courses/CourseEditor";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// Mock SharePointFilePicker
vi.mock("@/components/courses/SharePointFilePicker", () => ({
  SharePointFilePicker: () => null,
}));

// Mock QuizBuilder so we can assert it renders without full complexity
vi.mock("@/components/courses/QuizBuilder", () => ({
  QuizBuilder: ({ lessonId, passingScore }: { lessonId: string; passingScore: number }) => (
    <div data-testid={`quiz-builder-mock-${lessonId}`}>
      QuizBuilder passingScore={passingScore}
    </div>
  ),
}));

const baseProps = {
  courseId: "course1",
  initialTitle: "Test Course",
  initialDescription: null,
  initialStatus: "draft" as const,
  initialModules: [],
};

const moduleWithLessons = {
  id: "mod1",
  title: "Module One",
  order: 1,
  lessons: [
    { id: "lesson-text", title: "Text Lesson", type: "text" as const, content: null, order: 1 },
    { id: "lesson-quiz", title: "Quiz Lesson", type: "quiz" as const, content: null, order: 2 },
  ],
};

describe("CourseEditor — quiz builder", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("confirm", () => false);
  });

  it("renders 'Quiz Builder ▼' toggle for quiz lessons", () => {
    render(
      <CourseEditor
        {...baseProps}
        initialModules={[moduleWithLessons]}
        quizDataByLessonId={{
          "lesson-quiz": { questions: [], passingScore: 70 },
        }}
      />
    );
    // expand the module first
    fireEvent.click(screen.getByText(/Module One/));
    expect(screen.getByTestId("toggle-quiz-builder-lesson-quiz")).toHaveTextContent("Quiz Builder ▼");
  });

  it("renders 'Edit' button for non-quiz lessons", () => {
    render(
      <CourseEditor
        {...baseProps}
        initialModules={[moduleWithLessons]}
      />
    );
    fireEvent.click(screen.getByText(/Module One/));
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });

  it("shows inline QuizBuilder when toggle is clicked", () => {
    render(
      <CourseEditor
        {...baseProps}
        initialModules={[moduleWithLessons]}
        quizDataByLessonId={{
          "lesson-quiz": { questions: [], passingScore: 70 },
        }}
      />
    );
    fireEvent.click(screen.getByText(/Module One/));
    const toggle = screen.getByTestId("toggle-quiz-builder-lesson-quiz");
    fireEvent.click(toggle);
    expect(screen.getByTestId("quiz-builder-panel-lesson-quiz")).toBeInTheDocument();
    expect(screen.getByTestId("quiz-builder-mock-lesson-quiz")).toBeInTheDocument();
    expect(toggle).toHaveTextContent("Quiz Builder ▲");
  });

  it("hides QuizBuilder when toggle is clicked again", () => {
    render(
      <CourseEditor
        {...baseProps}
        initialModules={[moduleWithLessons]}
        quizDataByLessonId={{
          "lesson-quiz": { questions: [], passingScore: 70 },
        }}
      />
    );
    fireEvent.click(screen.getByText(/Module One/));
    const toggle = screen.getByTestId("toggle-quiz-builder-lesson-quiz");
    fireEvent.click(toggle); // open
    fireEvent.click(toggle); // close
    expect(screen.queryByTestId("quiz-builder-panel-lesson-quiz")).not.toBeInTheDocument();
    expect(toggle).toHaveTextContent("Quiz Builder ▼");
  });

  it("does not show QuizBuilder panel when quizDataByLessonId is empty", () => {
    render(
      <CourseEditor
        {...baseProps}
        initialModules={[moduleWithLessons]}
        quizDataByLessonId={{}}
      />
    );
    fireEvent.click(screen.getByText(/Module One/));
    const toggle = screen.getByTestId("toggle-quiz-builder-lesson-quiz");
    fireEvent.click(toggle);
    // Panel won't render if no data for this lessonId
    expect(screen.queryByTestId("quiz-builder-panel-lesson-quiz")).not.toBeInTheDocument();
  });
});
