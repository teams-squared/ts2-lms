import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QuizViewer } from "@/components/courses/QuizViewer";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

const mockQuestions = [
  {
    id: "q1",
    text: "What is 2+2?",
    order: 1,
    options: [
      { id: "o1", text: "3", order: 1 },
      { id: "o2", text: "4", order: 2 },
    ],
  },
  {
    id: "q2",
    text: "What is 3+3?",
    order: 2,
    options: [
      { id: "o3", text: "5", order: 1 },
      { id: "o4", text: "6", order: 2 },
    ],
  },
];

const defaultProps = {
  questions: mockQuestions,
  passingScore: 70,
  initialBestAttempt: null,
  courseId: "c1",
  moduleId: "m1",
  lessonId: "l1",
  courseTitle: "Test Course",
};

describe("QuizViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows empty state when no questions exist", () => {
    render(<QuizViewer {...defaultProps} questions={[]} />);
    expect(
      screen.getByText(/no questions have been added/i),
    ).toBeInTheDocument();
  });

  it("shows idle state with start button when no prior attempt", () => {
    render(<QuizViewer {...defaultProps} />);
    expect(screen.getByText("Start Quiz")).toBeInTheDocument();
    expect(screen.getByText(/2 questions/i)).toBeInTheDocument();
    expect(screen.getByText(/passing score: 70%/i)).toBeInTheDocument();
  });

  it("shows retake button when there is a previous attempt", () => {
    render(
      <QuizViewer
        {...defaultProps}
        initialBestAttempt={{
          id: "att1",
          score: 1,
          totalQuestions: 2,
          passed: false,
          createdAt: new Date().toISOString(),
        }}
      />,
    );
    expect(screen.getByText("Retake Quiz")).toBeInTheDocument();
  });

  it("transitions to taking state on Start Quiz click", () => {
    render(<QuizViewer {...defaultProps} />);
    fireEvent.click(screen.getByText("Start Quiz"));
    // Questions should now be visible (text may be split across nodes)
    expect(screen.getByText(/What is 2\+2\?/)).toBeInTheDocument();
    expect(screen.getByText(/What is 3\+3\?/)).toBeInTheDocument();
  });

  it("renders radio buttons for each option in taking state", () => {
    render(<QuizViewer {...defaultProps} />);
    fireEvent.click(screen.getByText("Start Quiz"));
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4); // 2 questions × 2 options each
  });

  it("disables submit until all questions are answered", () => {
    render(<QuizViewer {...defaultProps} />);
    fireEvent.click(screen.getByText("Start Quiz"));
    const submitBtn = screen.getByText("Submit Quiz");
    expect(submitBtn).toBeDisabled();
  });

  it("enables submit when all questions are answered", () => {
    render(<QuizViewer {...defaultProps} />);
    fireEvent.click(screen.getByText("Start Quiz"));

    // Answer q1
    fireEvent.click(screen.getByDisplayValue("o2"));
    // Answer q2
    fireEvent.click(screen.getByDisplayValue("o4"));

    expect(screen.getByText("Submit Quiz")).not.toBeDisabled();
  });

  it("calls fetch with correct answers on submit", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        score: 2,
        totalQuestions: 2,
        percentage: 100,
        passed: true,
        passingScore: 70,
        answers: [
          { questionId: "q1", selectedOptionId: "o2", correctOptionId: "o2", correct: true },
          { questionId: "q2", selectedOptionId: "o4", correctOptionId: "o4", correct: true },
        ],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    render(<QuizViewer {...defaultProps} />);
    fireEvent.click(screen.getByText("Start Quiz"));
    fireEvent.click(screen.getByDisplayValue("o2"));
    fireEvent.click(screen.getByDisplayValue("o4"));
    fireEvent.click(screen.getByText("Submit Quiz"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/courses/c1/modules/m1/lessons/l1/quiz/attempt",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("shows pass state after successful submit with passing score", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          score: 2,
          totalQuestions: 2,
          percentage: 100,
          passed: true,
          passingScore: 70,
          answers: [
            { questionId: "q1", selectedOptionId: "o2", correctOptionId: "o2", correct: true },
            { questionId: "q2", selectedOptionId: "o4", correctOptionId: "o4", correct: true },
          ],
        }),
      }),
    );

    render(<QuizViewer {...defaultProps} />);
    fireEvent.click(screen.getByText("Start Quiz"));
    fireEvent.click(screen.getByDisplayValue("o2"));
    fireEvent.click(screen.getByDisplayValue("o4"));
    fireEvent.click(screen.getByText("Submit Quiz"));

    await waitFor(() => {
      expect(screen.getByText(/passed!/i)).toBeInTheDocument();
    });
    expect(screen.getByText("100%")).toBeInTheDocument();
    // No retry button when passed
    expect(screen.queryByText("Try Again")).not.toBeInTheDocument();
  });

  it("shows fail state with retry button when not passing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          score: 0,
          totalQuestions: 2,
          percentage: 0,
          passed: false,
          passingScore: 70,
          answers: [
            { questionId: "q1", selectedOptionId: "o1", correctOptionId: "o2", correct: false },
            { questionId: "q2", selectedOptionId: "o3", correctOptionId: "o4", correct: false },
          ],
        }),
      }),
    );

    render(<QuizViewer {...defaultProps} />);
    fireEvent.click(screen.getByText("Start Quiz"));
    fireEvent.click(screen.getByDisplayValue("o1"));
    fireEvent.click(screen.getByDisplayValue("o3"));
    fireEvent.click(screen.getByText("Submit Quiz"));

    await waitFor(() => {
      expect(screen.getByText(/not passed/i)).toBeInTheDocument();
    });
    expect(screen.getByText("Try Again")).toBeInTheDocument();
  });

  it("resets to taking state on Try Again click", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          score: 0,
          totalQuestions: 2,
          percentage: 0,
          passed: false,
          passingScore: 70,
          answers: [
            { questionId: "q1", selectedOptionId: "o1", correctOptionId: "o2", correct: false },
            { questionId: "q2", selectedOptionId: "o3", correctOptionId: "o4", correct: false },
          ],
        }),
      }),
    );

    render(<QuizViewer {...defaultProps} />);
    fireEvent.click(screen.getByText("Start Quiz"));
    fireEvent.click(screen.getByDisplayValue("o1"));
    fireEvent.click(screen.getByDisplayValue("o3"));
    fireEvent.click(screen.getByText("Submit Quiz"));

    await waitFor(() => {
      expect(screen.getByText("Try Again")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Try Again"));
    expect(screen.getByText("Submit Quiz")).toBeInTheDocument();
  });

  it("always starts in idle state even when initialBestAttempt.passed is true (no blank screen)", () => {
    render(
      <QuizViewer
        {...defaultProps}
        initialBestAttempt={{
          id: "att1",
          score: 2,
          totalQuestions: 2,
          passed: true,
          createdAt: new Date().toISOString(),
        }}
      />,
    );
    // Must NOT return null — idle state renders quiz info and a button
    expect(screen.getByText("Retake Quiz")).toBeInTheDocument();
    expect(screen.getByText(/2 questions/i)).toBeInTheDocument();
  });

  it("shows passed badge in idle state when initialBestAttempt.passed is true", () => {
    render(
      <QuizViewer
        {...defaultProps}
        initialBestAttempt={{
          id: "att1",
          score: 2,
          totalQuestions: 2,
          passed: true,
          createdAt: new Date().toISOString(),
        }}
      />,
    );
    expect(screen.getByText(/you passed this quiz/i)).toBeInTheDocument();
  });

  it("does not show passed badge when best attempt failed", () => {
    render(
      <QuizViewer
        {...defaultProps}
        initialBestAttempt={{
          id: "att1",
          score: 1,
          totalQuestions: 2,
          passed: false,
          createdAt: new Date().toISOString(),
        }}
      />,
    );
    expect(screen.queryByText(/you passed this quiz/i)).not.toBeInTheDocument();
  });

  it("shows error message when quiz submission network request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    render(<QuizViewer {...defaultProps} />);
    fireEvent.click(screen.getByText("Start Quiz"));
    fireEvent.click(screen.getByDisplayValue("o2"));
    fireEvent.click(screen.getByDisplayValue("o4"));
    fireEvent.click(screen.getByText("Submit Quiz"));

    await waitFor(() => {
      expect(
        screen.getByText(/an unexpected error occurred/i),
      ).toBeInTheDocument();
    });
  });

  it("shows error message when submission returns non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Internal server error" }),
      }),
    );

    render(<QuizViewer {...defaultProps} />);
    fireEvent.click(screen.getByText("Start Quiz"));
    fireEvent.click(screen.getByDisplayValue("o2"));
    fireEvent.click(screen.getByDisplayValue("o4"));
    fireEvent.click(screen.getByText("Submit Quiz"));

    await waitFor(() => {
      expect(screen.getByText("Internal server error")).toBeInTheDocument();
    });
  });
});
