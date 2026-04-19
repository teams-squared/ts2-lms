import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LessonCompleteButton } from "@/components/courses/LessonCompleteButton";

vi.mock("@/components/icons", () => ({
  CheckCircleIcon: (props: Record<string, unknown>) => (
    <svg data-testid="check-circle" {...props} />
  ),
}));

// useRouter is globally mocked in setup.ts via next/navigation
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

const defaultProps = {
  courseId: "c1",
  moduleId: "m1",
  lessonId: "l1",
  initialCompleted: false,
};

describe("LessonCompleteButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders Mark complete button when initialCompleted is false", () => {
    render(<LessonCompleteButton {...defaultProps} />);
    expect(screen.getByTestId("mark-complete-button")).toBeInTheDocument();
    expect(screen.getByTestId("mark-complete-button")).toHaveTextContent("Mark complete");
  });

  it("renders completed state when initialCompleted is true", () => {
    render(<LessonCompleteButton {...defaultProps} initialCompleted={true} />);
    expect(screen.getByTestId("lesson-completed-state")).toBeInTheDocument();
    expect(screen.queryByTestId("mark-complete-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("mark-incomplete-button")).toBeInTheDocument();
  });

  it("calls fetch with correct URL on button click", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ completed: true, completedAt: new Date().toISOString() }),
    });
    vi.stubGlobal("fetch", mockFetch);

    render(<LessonCompleteButton {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mark-complete-button"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/courses/c1/modules/m1/lessons/l1/complete",
        { method: "POST" },
      );
    });
  });

  it("calls router.refresh() after successful mark complete", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ completed: true }),
    }));

    render(<LessonCompleteButton {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mark-complete-button"));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("shows completed state after successful mark complete", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ completed: true }),
    }));

    render(<LessonCompleteButton {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mark-complete-button"));

    await waitFor(() => {
      expect(screen.getByTestId("lesson-completed-state")).toBeInTheDocument();
    });
  });

  it("disables button while loading", async () => {
    let resolveFetch!: () => void;
    const pendingFetch = new Promise<Response>((resolve) => {
      resolveFetch = () =>
        resolve({
          ok: true,
          json: async () => ({ completed: true }),
        } as Response);
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pendingFetch));

    render(<LessonCompleteButton {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mark-complete-button"));

    await waitFor(() => {
      expect(screen.getByTestId("mark-complete-button")).toBeDisabled();
    });

    resolveFetch();
  });

  it("shows error message and re-enables button on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Must be enrolled to track progress" }),
    }));

    render(<LessonCompleteButton {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mark-complete-button"));

    await waitFor(() => {
      expect(screen.getByTestId("complete-error")).toBeInTheDocument();
      expect(screen.getByTestId("complete-error")).toHaveTextContent(
        "Must be enrolled to track progress",
      );
      expect(screen.getByTestId("mark-complete-button")).not.toBeDisabled();
    });
  });

  it("calls DELETE when mark-incomplete is clicked", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ completed: false }),
    });
    vi.stubGlobal("fetch", mockFetch);

    render(<LessonCompleteButton {...defaultProps} initialCompleted={true} />);
    fireEvent.click(screen.getByTestId("mark-incomplete-button"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/courses/c1/modules/m1/lessons/l1/complete",
        { method: "DELETE" },
      );
    });
  });

  it("reverts to not-completed state after marking incomplete", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ completed: false }),
    }));

    render(<LessonCompleteButton {...defaultProps} initialCompleted={true} />);
    fireEvent.click(screen.getByTestId("mark-incomplete-button"));

    await waitFor(() => {
      expect(screen.getByTestId("mark-complete-button")).toBeInTheDocument();
      expect(screen.queryByTestId("lesson-completed-state")).not.toBeInTheDocument();
    });
  });
});
