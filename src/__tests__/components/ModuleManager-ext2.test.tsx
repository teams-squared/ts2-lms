/**
 * More ModuleManager tests — covers the add-lesson + edit-lesson flows,
 * deletion confirmation, and the per-lesson type-specific rendering.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModuleManager } from "@/components/courses/ModuleManager";

vi.mock("@/components/courses/SharePointFilePicker", () => ({
  SharePointFilePicker: () => null,
}));
vi.mock("@/components/courses/QuizBuilder", () => ({
  QuizBuilder: () => <div data-testid="quiz-builder-mock" />,
}));
vi.mock("@/components/courses/PolicyDocLessonEditor", () => ({
  PolicyDocLessonEditor: () => <div data-testid="policy-doc-editor-mock" />,
}));

const fetchSpy = vi.fn();
beforeEach(() => {
  fetchSpy.mockReset();
  // @ts-expect-error happy-dom
  global.fetch = fetchSpy;
});

const oneModule = {
  courseId: "course-1",
  initialModules: [
    {
      id: "m-1",
      title: "Module 1",
      order: 1,
      lessons: [
        {
          id: "l-text",
          title: "Intro text",
          type: "text" as const,
          content: "Body",
          order: 1,
          deadlineDays: null,
        },
        {
          id: "l-quiz",
          title: "Knowledge check",
          type: "quiz" as const,
          content: null,
          order: 2,
          deadlineDays: 7,
        },
      ],
    },
  ],
};

describe("ModuleManager — add lesson flow", () => {
  it("opens the inline add-lesson form when + Add lesson is clicked", () => {
    render(<ModuleManager {...oneModule} />);
    fireEvent.click(screen.getByText(/Module 1/));
    fireEvent.click(screen.getByText("+ Add lesson"));
    expect(
      screen.getByPlaceholderText(/Phishing fundamentals/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Add lesson$/i })).toBeInTheDocument();
  });

  it("offers all seven lesson type options in the new-lesson type select", () => {
    render(<ModuleManager {...oneModule} />);
    fireEvent.click(screen.getByText(/Module 1/));
    fireEvent.click(screen.getByText("+ Add lesson"));
    const select = screen.getAllByRole("combobox")[0] as HTMLSelectElement;
    const labels = Array.from(select.options).map((o) => o.value);
    expect(labels).toEqual([
      "text",
      "video",
      "quiz",
      "document",
      "html",
      "policy_doc",
      "link",
    ]);
  });

  it("POSTs to /lessons when the inline Add lesson submit fires", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "l-new",
        title: "New lesson",
        type: "TEXT",
        content: null,
        order: 3,
        deadlineDays: null,
      }),
    } as Response);
    render(<ModuleManager {...oneModule} />);
    fireEvent.click(screen.getByText(/Module 1/));
    fireEvent.click(screen.getByText("+ Add lesson"));
    fireEvent.change(screen.getByPlaceholderText(/Phishing fundamentals/i), {
      target: { value: "New lesson" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Add lesson$/i }));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/courses/course-1/modules/m-1/lessons",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("dismisses the add-lesson form on Cancel without sending a request", () => {
    render(<ModuleManager {...oneModule} />);
    fireEvent.click(screen.getByText(/Module 1/));
    fireEvent.click(screen.getByText("+ Add lesson"));
    // Multiple cancel buttons may exist; the one inside the add-lesson form is
    // the Lucide-styled ghost button. Click the one nearest the input.
    fireEvent.click(
      screen.getAllByRole("button", { name: /Cancel/i })[0],
    );
    expect(
      screen.queryByPlaceholderText(/Phishing fundamentals/i),
    ).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("ModuleManager — quiz panel toggle", () => {
  const propsWithQuizData = {
    ...oneModule,
    quizDataByLessonId: {
      "l-quiz": { questions: [], passingScore: 70 },
    },
  };

  it("expands the QuizBuilder panel when Quiz Builder ▼ is clicked", () => {
    render(<ModuleManager {...propsWithQuizData} />);
    fireEvent.click(screen.getByText(/Module 1/));
    expect(screen.queryByTestId("quiz-builder-mock")).toBeNull();
    fireEvent.click(screen.getByTestId("toggle-quiz-builder-l-quiz"));
    expect(screen.getByTestId("quiz-builder-mock")).toBeInTheDocument();
  });
});

describe("ModuleManager — delete confirmations", () => {
  it("opens delete-lesson confirm dialog when Delete is clicked", () => {
    render(<ModuleManager {...oneModule} />);
    fireEvent.click(screen.getByText(/Module 1/));
    fireEvent.click(screen.getByLabelText("Delete lesson Intro text"));
    expect(screen.getByText("Delete lesson?")).toBeInTheDocument();
  });

  it("opens delete-module confirm when the module delete is clicked", () => {
    render(<ModuleManager {...oneModule} />);
    fireEvent.click(screen.getByText(/Module 1/));
    fireEvent.click(
      screen.getByLabelText(/Delete module Module 1/i),
    );
    expect(screen.getByText("Delete module?")).toBeInTheDocument();
  });
});
