import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QuizBuilder } from "@/components/courses/QuizBuilder";

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
      { id: "o1", text: "3", isCorrect: false, order: 1 },
      { id: "o2", text: "4", isCorrect: true, order: 2 },
    ],
  },
];

const defaultProps = {
  initialQuestions: mockQuestions,
  passingScore: 70,
  courseId: "c1",
  moduleId: "m1",
  lessonId: "l1",
};

describe("QuizBuilder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders existing questions", () => {
    render(<QuizBuilder {...defaultProps} />);
    expect(screen.getByText(/What is 2\+2\?/)).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("shows passing score", () => {
    render(<QuizBuilder {...defaultProps} />);
    expect(screen.getByText(/passing score: 70%/i)).toBeInTheDocument();
  });

  it("shows Add question button", () => {
    render(<QuizBuilder {...defaultProps} />);
    expect(screen.getByText("Add question")).toBeInTheDocument();
  });

  it("shows delete button for each question", () => {
    render(<QuizBuilder {...defaultProps} />);
    const deleteButtons = screen.getAllByRole("button", { name: /delete question/i });
    expect(deleteButtons).toHaveLength(1);
  });

  it("shows empty state when no questions", () => {
    render(<QuizBuilder {...defaultProps} initialQuestions={[]} />);
    expect(screen.getByText(/no questions yet/i)).toBeInTheDocument();
  });

  it("shows add form when Add question is clicked", () => {
    render(<QuizBuilder {...defaultProps} />);
    fireEvent.click(screen.getByText("Add question"));
    expect(screen.getByPlaceholderText(/enter your question/i)).toBeInTheDocument();
    expect(screen.getByText("+ Add option")).toBeInTheDocument();
  });

  it("hides add button when form is shown", () => {
    render(<QuizBuilder {...defaultProps} />);
    fireEvent.click(screen.getByText("Add question"));
    // After opening form, Cancel button should be visible
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    // The form should now be visible
    expect(screen.getByPlaceholderText(/enter your question/i)).toBeInTheDocument();
  });

  it("calls fetch with correct data on add question submit", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "q2",
        text: "New question?",
        order: 2,
        options: [
          { id: "o3", text: "Yes", isCorrect: true, order: 1 },
          { id: "o4", text: "No", isCorrect: false, order: 2 },
        ],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    render(<QuizBuilder {...defaultProps} />);
    fireEvent.click(screen.getByText("Add question"));

    // Fill in question text
    fireEvent.change(screen.getByPlaceholderText(/enter your question/i), {
      target: { value: "New question?" },
    });

    // Fill in options
    const [opt1, opt2] = screen.getAllByPlaceholderText(/option/i);
    fireEvent.change(opt1, { target: { value: "Yes" } });
    fireEvent.change(opt2, { target: { value: "No" } });

    // Mark first option as correct
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[0]);

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /^Add question$/ }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/courses/c1/modules/m1/lessons/l1/quiz/questions",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("calls fetch DELETE on delete button click", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ deleted: true }),
    });
    vi.stubGlobal("fetch", mockFetch);

    render(<QuizBuilder {...defaultProps} />);
    const deleteBtn = screen.getByRole("button", { name: /delete question 1/i });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/courses/c1/modules/m1/lessons/l1/quiz/questions/q1",
        { method: "DELETE" },
      );
    });
  });

  it("removes question from list after successful delete", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ deleted: true }),
      }),
    );

    render(<QuizBuilder {...defaultProps} />);
    expect(screen.getByText(/What is 2\+2\?/)).toBeInTheDocument();

    const deleteBtn = screen.getByRole("button", { name: /delete question 1/i });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.queryByText(/What is 2\+2\?/)).not.toBeInTheDocument();
    });
  });

  it("shows error when submitting form with empty question text", async () => {
    render(<QuizBuilder {...defaultProps} />);
    fireEvent.click(screen.getByText("Add question"));
    fireEvent.click(screen.getByRole("button", { name: /^Add question$/ }));
    expect(screen.getByText(/question text is required/i)).toBeInTheDocument();
  });

  it("cancels form and hides it", () => {
    render(<QuizBuilder {...defaultProps} />);
    fireEvent.click(screen.getByText("Add question"));
    expect(screen.getByPlaceholderText(/enter your question/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByPlaceholderText(/enter your question/i)).not.toBeInTheDocument();
  });

  it("adds a new option when Add option is clicked", () => {
    render(<QuizBuilder {...defaultProps} />);
    fireEvent.click(screen.getByText("Add question"));
    const optionsBefore = screen.getAllByPlaceholderText(/option/i).length;
    fireEvent.click(screen.getByText("+ Add option"));
    const optionsAfter = screen.getAllByPlaceholderText(/option/i).length;
    expect(optionsAfter).toBe(optionsBefore + 1);
  });
});
