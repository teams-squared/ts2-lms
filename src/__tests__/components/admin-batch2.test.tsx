/**
 * Smoke + key-behavior tests for the large admin components.
 *
 * These focus on visible-state rendering, empty states, and primary
 * interactions. Comprehensive coverage of every branch in the 250+ LOC
 * components would balloon the suite; this batch aims to lift each file
 * from 0% to ~50% with mostly render assertions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.unmock("@/components/ui/ToastProvider");

import { ToastProvider } from "@/components/ui/ToastProvider";
import { CourseNodeTree } from "@/components/admin/CourseNodeTree";
import { CourseProgressTable } from "@/components/admin/CourseProgressTable";
import { IsoAckLog } from "@/components/admin/IsoAckLog";
import { IsoCoverage } from "@/components/admin/IsoCoverage";
import { NodeManager } from "@/components/admin/NodeManager";
import { EnrollmentManager } from "@/components/admin/EnrollmentManager";
import { EmailSignatureForm } from "@/components/admin/EmailSignatureForm";
import { InviteEmailTemplateForm } from "@/components/admin/InviteEmailTemplateForm";
import { InviteUserForm } from "@/components/admin/InviteUserForm";
import { UserDetailManager } from "@/components/admin/UserDetailManager";

const fetchSpy = vi.fn();

beforeEach(() => {
  fetchSpy.mockReset();
  // @ts-expect-error happy-dom
  global.fetch = fetchSpy;
});

function wrap(node: React.ReactNode) {
  return render(<ToastProvider>{node}</ToastProvider>);
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const nodeTree = [
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
    children: [
      {
        id: "n-1-1",
        name: "Compliance",
        slug: "compliance",
        parentId: "n-1",
        courses: [],
        children: [],
      },
    ],
  },
];

// ─── CourseNodeTree ─────────────────────────────────────────────────────────

describe("CourseNodeTree", () => {
  it("renders top-level node names", () => {
    render(
      <CourseNodeTree
        nodes={nodeTree}
        selectedCourseIds={new Set()}
        onSelectionChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Security")).toBeInTheDocument();
  });

  it("filters branches by search query (auto-expanding matches)", () => {
    render(
      <CourseNodeTree
        nodes={nodeTree}
        selectedCourseIds={new Set()}
        onSelectionChange={vi.fn()}
      />,
    );
    const search = screen.getByPlaceholderText(/Search/i);
    fireEvent.change(search, { target: { value: "compliance" } });
    expect(screen.getByText("Compliance")).toBeInTheDocument();
  });

  it("renders both top-level nodes and child nodes via the search-driven expand", () => {
    render(
      <CourseNodeTree
        nodes={nodeTree}
        selectedCourseIds={new Set()}
        onSelectionChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/Search/i), {
      target: { value: "Auth" },
    });
    expect(screen.getByText("Auth Basics")).toBeInTheDocument();
  });

  it("respects showSearch=false to hide the input", () => {
    render(
      <CourseNodeTree
        nodes={nodeTree}
        selectedCourseIds={new Set()}
        onSelectionChange={vi.fn()}
        showSearch={false}
      />,
    );
    expect(screen.queryByPlaceholderText(/Search/i)).toBeNull();
  });
});

// ─── CourseProgressTable ────────────────────────────────────────────────────

describe("CourseProgressTable", () => {
  const segments = [
    {
      courseId: "c-1",
      title: "Auth Basics",
      enrolled: 5,
      completed: 3,
      overdue: 1,
      rows: [
        {
          userId: "u-1",
          name: "Alice",
          email: "alice@example.com",
          avatar: null,
          percent: 80,
          totalLessons: 5,
          completedLessons: 4,
          overdueCount: 0,
          isComplete: false,
          courseId: "c-1",
          enrolledAt: new Date().toISOString(),
        },
      ],
    },
  ];

  it("renders the course row + counts", () => {
    render(<CourseProgressTable segments={segments} />);
    expect(screen.getByText("Auth Basics")).toBeInTheDocument();
  });

  it("filters by search query", () => {
    render(<CourseProgressTable segments={segments} />);
    fireEvent.change(screen.getByPlaceholderText(/Search/i), {
      target: { value: "no-match" },
    });
    expect(screen.queryByText("Auth Basics")).toBeNull();
  });
});

// ─── IsoAckLog ──────────────────────────────────────────────────────────────

describe("IsoAckLog", () => {
  it("renders filter controls (From/To, presets, CSV download) on mount", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ acks: [], total: 0, page: 1, pageSize: 50 }),
    } as Response);
    render(<IsoAckLog />);
    // Filter controls render synchronously even before the fetch resolves.
    expect(screen.getByText("Last 30 days")).toBeInTheDocument();
    expect(screen.getByText("All time")).toBeInTheDocument();
    expect(screen.getByText("Download CSV")).toBeInTheDocument();
  });

  it("surfaces an error from the fetch", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Server down" }),
    } as Response);
    render(<IsoAckLog />);
    expect(await screen.findByText("Server down")).toBeInTheDocument();
  });
});

// ─── IsoCoverage ────────────────────────────────────────────────────────────

describe("IsoCoverage", () => {
  it("renders policy rows once data loads", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        policies: [
          {
            lessonId: "l-1",
            courseId: "c-1",
            courseTitle: "Compliance Course",
            documentTitle: "Privacy Policy",
            documentCode: "POL-001",
            currentVersion: "1.0",
            currentETag: "etag-1",
            enrolledCount: 10,
            ackedCount: 7,
            outstandingCount: 3,
            outstanding: [],
          },
        ],
      }),
    } as Response);
    render(<IsoCoverage />);
    expect(await screen.findByText("Privacy Policy")).toBeInTheDocument();
  });

  it("surfaces an error from the fetch", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Not authorised" }),
    } as Response);
    render(<IsoCoverage />);
    expect(await screen.findByText("Not authorised")).toBeInTheDocument();
  });
});

// ─── NodeManager ────────────────────────────────────────────────────────────

describe("NodeManager", () => {
  it("renders existing top-level nodes", () => {
    wrap(<NodeManager initialTree={nodeTree} />);
    expect(screen.getByText("Security")).toBeInTheDocument();
  });

  it("opens the inline add input when 'Add root node' is clicked", () => {
    wrap(<NodeManager initialTree={[]} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Add root node/i }),
    );
    // After clicking, a text input becomes available.
    const inputs = document.querySelectorAll(
      'input[type="text"], input:not([type])',
    );
    expect(inputs.length).toBeGreaterThan(0);
  });
});

// ─── EnrollmentManager ──────────────────────────────────────────────────────

describe("EnrollmentManager", () => {
  it("renders the existing enrollment rows", () => {
    wrap(
      <EnrollmentManager
        nodeTree={nodeTree}
        users={[
          { id: "u-1", name: "Alice", email: "alice@example.com" },
        ]}
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
    expect(screen.getByText("Auth Basics")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders the empty state when no enrollments exist", () => {
    wrap(
      <EnrollmentManager
        nodeTree={nodeTree}
        users={[]}
        initialEnrollments={[]}
      />,
    );
    expect(screen.getByText("No enrollments yet.")).toBeInTheDocument();
  });
});

// ─── EmailSignatureForm ────────────────────────────────────────────────────

describe("EmailSignatureForm", () => {
  const baseSig = {
    enabled: true,
    signOff: "Best,",
    name: "Akil",
    title: "PM",
    email: "akil@teamsquared.io",
    phone: "+1 555 0100",
    websiteUrl: "https://example.com",
    websiteLabel: "Visit us",
    addressLine: "123 Main St",
    logoUrl: "",
    disclaimer: "",
    defaultDisclaimer: "Default legal text.",
    updatedAt: null,
  };

  it("renders existing signature values in the form fields", () => {
    wrap(<EmailSignatureForm {...baseSig} />);
    expect(screen.getByDisplayValue("Akil")).toBeInTheDocument();
    expect(screen.getByDisplayValue("PM")).toBeInTheDocument();
  });

  it("renders the preview block reflecting the current values", () => {
    const { container } = wrap(<EmailSignatureForm {...baseSig} />);
    // Preview HTML should include the name somewhere.
    expect(container.innerHTML).toContain("Akil");
    expect(container.innerHTML).toContain("PM");
  });
});

// ─── InviteEmailTemplateForm ────────────────────────────────────────────────

describe("InviteEmailTemplateForm", () => {
  const props = {
    initialSubject: "Welcome",
    initialBodyText: "Hi {{firstName}}, join us at {{joinLink}}.",
    initialCc: [],
    defaultBodyText: "default body",
    updatedAt: null,
  };

  it("renders subject and body inputs prefilled", () => {
    wrap(<InviteEmailTemplateForm {...props} />);
    expect(screen.getByDisplayValue("Welcome")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        "Hi {{firstName}}, join us at {{joinLink}}.",
      ),
    ).toBeInTheDocument();
  });

  it("toggles the preview block on Show preview / Hide preview click", () => {
    const { container } = wrap(<InviteEmailTemplateForm {...props} />);
    // Preview is collapsed by default.
    expect(container.textContent).not.toContain("Jordan");
    fireEvent.click(screen.getByRole("button", { name: /Show preview/i }));
    expect(container.textContent).toContain("Jordan");
  });
});

// ─── InviteUserForm ─────────────────────────────────────────────────────────

describe("InviteUserForm", () => {
  it("renders at least one recipient row with email + name inputs", () => {
    wrap(
      <InviteUserForm
        nodeTree={nodeTree}
        inviterRole="admin"
        onCancel={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    // The first recipient row exposes an aria-labelled email input.
    expect(
      screen.getByLabelText("Email for recipient 1"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Name for recipient 1"),
    ).toBeInTheDocument();
  });

  it("calls onCancel when the Cancel button is clicked", () => {
    const onCancel = vi.fn();
    wrap(
      <InviteUserForm
        nodeTree={nodeTree}
        inviterRole="admin"
        onCancel={onCancel}
        onSuccess={vi.fn()}
      />,
    );
    // Multiple Cancel buttons may exist; click the first.
    fireEvent.click(screen.getAllByRole("button", { name: /Cancel/i })[0]);
    expect(onCancel).toHaveBeenCalled();
  });
});

// ─── UserDetailManager ──────────────────────────────────────────────────────

describe("UserDetailManager", () => {
  const baseProps = {
    userId: "u-1",
    userEmail: "alice@example.com",
    userName: "Alice",
    initialRole: "employee" as const,
    initialClearances: [],
    availableClearances: ["SECRET"],
    enrollmentCount: 0,
    authoredCourseCount: 0,
    sessionUserId: "admin-1",
    enrollments: [],
  };

  it("renders the danger-zone section heading", () => {
    wrap(<UserDetailManager {...baseProps} />);
    expect(screen.getByText("Danger zone")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Remove user/i }),
    ).toBeInTheDocument();
  });

  it("renders the role selector with the initial role selected", () => {
    wrap(<UserDetailManager {...baseProps} initialRole="course_manager" />);
    expect(screen.getByDisplayValue("Course Manager")).toBeInTheDocument();
  });

  it("renders the no-enrollments empty state when enrollments=[]", () => {
    wrap(<UserDetailManager {...baseProps} />);
    expect(
      screen.getByText("Not enrolled in any courses."),
    ).toBeInTheDocument();
  });
});
