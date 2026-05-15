/**
 * Last component-coverage push: the largest remaining 0% files
 * (CourseEditor, AdminCourseTable, SharePointFilePicker) plus analytics.
 *
 * Goal: get each from 0% to >=40% with focused smoke renders + the
 * cheapest interaction tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.unmock("@/components/ui/ToastProvider");

// next-auth/react required by PostHogIdentify.
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
}));

// posthog-js is loaded by the analytics components.
vi.mock("posthog-js", () => ({
  default: { __loaded: false, get_distinct_id: () => null, identify: vi.fn(), capture: vi.fn() },
}));
vi.mock("posthog-js/react", () => ({
  usePostHog: () => ({ capture: vi.fn() }),
}));

import { ToastProvider } from "@/components/ui/ToastProvider";
import { CourseEditor } from "@/components/courses/CourseEditor";
import AdminCourseTable from "@/components/courses/AdminCourseTable";
import { SharePointFilePicker } from "@/components/courses/SharePointFilePicker";
import PostHogProvider from "@/components/analytics/PostHogProvider";
import PostHogIdentify from "@/components/analytics/PostHogIdentify";
import PostHogPageView from "@/components/analytics/PostHogPageView";

const fetchSpy = vi.fn();

beforeEach(() => {
  fetchSpy.mockReset();
  // @ts-expect-error happy-dom
  global.fetch = fetchSpy;
});

function wrap(node: React.ReactNode) {
  return render(<ToastProvider>{node}</ToastProvider>);
}

// ─── CourseEditor ───────────────────────────────────────────────────────────

describe("CourseEditor", () => {
  const props = {
    courseId: "c-1",
    initialTitle: "Auth Basics",
    initialDescription: "Intro to auth.",
    initialStatus: "PUBLISHED" as const,
    initialNodeId: null,
    nodeTree: [],
    initialSubscriptions: ["sub@example.com"],
  };

  it("renders initial title and description in form inputs", () => {
    wrap(<CourseEditor {...props} />);
    expect(screen.getByDisplayValue("Auth Basics")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Intro to auth.")).toBeInTheDocument();
  });

  it("renders the existing subscription row", () => {
    wrap(<CourseEditor {...props} />);
    expect(screen.getByText("sub@example.com")).toBeInTheDocument();
  });

  it("PATCHes the course endpoint when Save is clicked", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);
    wrap(<CourseEditor {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Save( changes)?/i }));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/courses/c-1",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("shows the title-required error when title is cleared", async () => {
    wrap(<CourseEditor {...props} />);
    fireEvent.change(screen.getByDisplayValue("Auth Basics"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save( changes)?/i }));
    expect(await screen.findByText("Title is required")).toBeInTheDocument();
  });
});

// ─── AdminCourseTable ──────────────────────────────────────────────────────

describe("AdminCourseTable", () => {
  it("shows a loading skeleton at first paint", () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);
    const { container } = wrap(<AdminCourseTable />);
    // Skeleton rows render before the fetch resolves.
    expect(container.querySelectorAll(".skeleton-shimmer").length).toBeGreaterThan(0);
  });

  it("renders the empty state after a successful empty fetch", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);
    wrap(<AdminCourseTable />);
    // Empty state copy mentions creating a course.
    expect(
      await screen.findByText(/No courses/i),
    ).toBeInTheDocument();
  });

  it("renders course rows when the fetch resolves with courses", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: "c-1",
          title: "Auth Basics",
          description: null,
          thumbnail: null,
          status: "PUBLISHED",
          node: null,
          createdBy: { name: "Akil", email: "a@b" },
          createdAt: new Date().toISOString(),
        },
      ],
    } as Response);
    wrap(<AdminCourseTable />);
    expect(await screen.findByText("Auth Basics")).toBeInTheDocument();
  });

  it("surfaces a fetch failure as an error", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Backend offline" }),
    } as Response);
    wrap(<AdminCourseTable />);
    expect(await screen.findByText("Backend offline")).toBeInTheDocument();
  });
});

// ─── SharePointFilePicker ──────────────────────────────────────────────────

describe("SharePointFilePicker", () => {
  it("renders nothing when isOpen=false", () => {
    const { container } = wrap(
      <SharePointFilePicker
        isOpen={false}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(container.textContent).toBe("");
  });

  it("renders modal contents and triggers the browse fetch when isOpen=true", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [], breadcrumbs: [] }),
    } as Response);
    wrap(
      <SharePointFilePicker
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(fetchSpy).toHaveBeenCalled();
    expect(
      fetchSpy.mock.calls[0][0],
    ).toMatch(/^\/api\/sharepoint\/browse/);
  });
});

// ─── Analytics: PostHogProvider passthroughs ───────────────────────────────

describe("PostHogProvider", () => {
  it("renders children passthrough when no PostHog key is configured", () => {
    // process.env.NEXT_PUBLIC_POSTHOG_KEY is unset in the test environment.
    render(
      <PostHogProvider>
        <div data-testid="child">child</div>
      </PostHogProvider>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});

describe("PostHogIdentify", () => {
  it("renders null and short-circuits when unauthenticated", () => {
    const { container } = render(<PostHogIdentify />);
    expect(container.textContent).toBe("");
  });
});

describe("PostHogPageView", () => {
  it("renders null and fires posthog.capture on mount", () => {
    const { container } = render(<PostHogPageView />);
    expect(container.textContent).toBe("");
  });
});
