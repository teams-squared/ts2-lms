/**
 * Final coverage push — adds tests for EnrollmentManager interactions,
 * NodeManager, CourseProgressTable, and a few smaller files.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.unmock("@/components/ui/ToastProvider");

vi.mock("@/components/admin/CourseNodeTree", () => ({
  CourseNodeTree: ({
    onSelectionChange,
  }: {
    onSelectionChange: (s: Set<string>) => void;
  }) => (
    <button
      data-testid="tree-stub-select-course"
      onClick={() => onSelectionChange(new Set(["course-a"]))}
    >
      tree-select-course-a
    </button>
  ),
}));

import { ToastProvider } from "@/components/ui/ToastProvider";
import { EnrollmentManager } from "@/components/admin/EnrollmentManager";
import { NodeManager } from "@/components/admin/NodeManager";
import { CourseProgressTable } from "@/components/admin/CourseProgressTable";

const fetchSpy = vi.fn();
beforeEach(() => {
  fetchSpy.mockReset();
  // @ts-expect-error happy-dom
  global.fetch = fetchSpy;
});

function wrap(node: React.ReactNode) {
  return render(<ToastProvider>{node}</ToastProvider>);
}

const enrollmentBase = {
  nodeTree: [
    {
      id: "n-1",
      name: "Security",
      slug: "security",
      parentId: null,
      courses: [
        {
          id: "course-a",
          title: "Auth Basics",
          thumbnail: null,
          status: "PUBLISHED" as const,
        },
      ],
      children: [],
    },
  ],
  users: [
    { id: "u-1", name: "Alice", email: "alice@example.com" },
    { id: "u-2", name: null, email: "bob@example.com" },
  ],
};

describe("EnrollmentManager — enroll flow", () => {
  it("renders 'Select user…' as the default option", () => {
    wrap(
      <EnrollmentManager {...enrollmentBase} initialEnrollments={[]} />,
    );
    expect(screen.getByText("Select user…")).toBeInTheDocument();
  });

  it("renders the no-published-courses notice when nodeTree is empty", () => {
    wrap(
      <EnrollmentManager
        nodeTree={[]}
        users={enrollmentBase.users}
        initialEnrollments={[]}
      />,
    );
    expect(
      screen.getByText(/No published courses available/i),
    ).toBeInTheDocument();
  });

  it("disables Enroll button until both a course and a user are selected", () => {
    wrap(
      <EnrollmentManager {...enrollmentBase} initialEnrollments={[]} />,
    );
    const enrollBtn = screen.getByText(/Enroll in 0 courses/i);
    expect(
      enrollBtn.closest("button")?.hasAttribute("disabled"),
    ).toBe(true);
  });

  it("selecting a course via the (stubbed) tree updates the button label", () => {
    wrap(
      <EnrollmentManager {...enrollmentBase} initialEnrollments={[]} />,
    );
    fireEvent.click(screen.getByTestId("tree-stub-select-course"));
    expect(screen.getByText(/Enroll in 1 course\b/)).toBeInTheDocument();
  });

  it("POSTs to /api/admin/enrollments/batch on Enroll click", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        enrollments: [
          {
            id: "e-new",
            course: { id: "course-a", title: "Auth Basics" },
            user: { id: "u-1", name: "Alice", email: "alice@example.com" },
            enrolledBy: null,
            enrolledAt: new Date().toISOString(),
          },
        ],
      }),
    } as Response);
    wrap(
      <EnrollmentManager {...enrollmentBase} initialEnrollments={[]} />,
    );
    fireEvent.click(screen.getByTestId("tree-stub-select-course"));
    fireEvent.change(screen.getByLabelText("Select user to enroll"), {
      target: { value: "u-1" },
    });
    fireEvent.click(screen.getByText(/Enroll in 1 course\b/));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/admin/enrollments/batch",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("opens the unenroll confirm dialog when Unenroll is clicked", () => {
    wrap(
      <EnrollmentManager
        {...enrollmentBase}
        initialEnrollments={[
          {
            id: "e-1",
            course: { id: "course-a", title: "Auth Basics" },
            user: { id: "u-1", name: "Alice", email: "alice@example.com" },
            enrolledBy: null,
            enrolledAt: new Date().toISOString(),
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByLabelText("Unenroll Alice"));
    expect(screen.getByText("Unenroll user?")).toBeInTheDocument();
  });
});

describe("NodeManager — expanded interactions", () => {
  const tree = [
    {
      id: "n-1",
      name: "Root A",
      slug: "root-a",
      parentId: null,
      courses: [],
      children: [
        {
          id: "n-1-1",
          name: "Child",
          slug: "child",
          parentId: "n-1",
          courses: [],
          children: [],
        },
      ],
    },
  ];

  it("renders the root nodes (children hidden by default)", () => {
    wrap(<NodeManager initialTree={tree} />);
    expect(screen.getByText("Root A")).toBeInTheDocument();
    expect(screen.queryByText("Child")).toBeNull();
  });

  it("POSTs to /api/admin/nodes when adding a root node", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => tree,
    } as Response);
    wrap(<NodeManager initialTree={[]} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Add root node/i }),
    );
    const input = document.querySelector(
      'input[type="text"], input:not([type])',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "New Root" } });
    // Submit by pressing Enter on the input.
    fireEvent.keyDown(input, { key: "Enter" });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/admin/nodes",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("CourseProgressTable — row expand", () => {
  const segments = [
    {
      courseId: "c-1",
      title: "Auth Basics",
      totalLessons: 5,
      enrolledCount: 2,
      completedCount: 1,
      overdueCount: 1,
      rows: [
        {
          userId: "u-1",
          name: "Alice",
          email: "alice@example.com",
          avatar: null,
          percent: 100,
          totalLessons: 5,
          completedLessons: 5,
          enrollmentCompleted: true,
          overdueLessons: [],
        },
        {
          userId: "u-2",
          name: "Bob",
          email: "bob@example.com",
          avatar: null,
          percent: 40,
          totalLessons: 5,
          completedLessons: 2,
          enrollmentCompleted: false,
          overdueLessons: ["l-overdue"],
        },
      ],
    },
  ];

  it("filters to course rows that match the query in the student name", () => {
    render(<CourseProgressTable segments={segments} />);
    fireEvent.change(screen.getByPlaceholderText(/Search/i), {
      target: { value: "Bob" },
    });
    // Auth Basics row should still appear because Bob matched.
    expect(screen.getByText("Auth Basics")).toBeInTheDocument();
  });

  it("expands a course row when its toggle is clicked", () => {
    render(<CourseProgressTable segments={segments} />);
    fireEvent.click(screen.getByText("Auth Basics"));
    // Student rows now visible.
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });
});
