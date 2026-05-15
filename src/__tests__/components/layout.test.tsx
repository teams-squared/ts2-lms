import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// next-auth/react is consumed by both DashboardShell and TopBar/Sidebar.
const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  signOut: vi.fn(),
}));

// useSignOut hook used by TopBar — return a no-op.
vi.mock("@/hooks/useSignOut", () => ({
  useSignOut: () => vi.fn(),
}));

// NotificationBell hits APIs we don't care about for layout tests.
vi.mock("@/components/layout/NotificationBell", () => ({
  NotificationBell: () => <span data-testid="bell-stub" />,
}));

// ThemeToggle keeps its own state but is fine to render — uses our
// ThemeProvider context, which has a safe default.
vi.mock("@/components/theme/ThemeToggle", () => ({
  ThemeToggle: () => <button data-testid="theme-toggle-stub">theme</button>,
}));

import { DashboardShell } from "@/components/layout/DashboardShell";
import { TopBar } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { LessonPlayerShell } from "@/components/layout/LessonPlayerShell";
import { usePathname, useRouter } from "next/navigation";

const mockedUsePathname = vi.mocked(usePathname);
const mockedUseRouter = vi.mocked(useRouter);

beforeEach(() => {
  mockUseSession.mockReset();
  try {
    localStorage.removeItem("sidebar-pinned");
    localStorage.removeItem("sidebar-collapsed");
  } catch {
    // ignore
  }
});

describe("DashboardShell", () => {
  it("renders children only (no chrome) on /login", () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    // next/navigation's usePathname is mocked globally to "/" in setup.ts.
    // For this test we want /login — re-mock locally via the setup-global.
    mockedUsePathname.mockReturnValueOnce("/login");

    render(
      <DashboardShell>
        <div data-testid="page">page</div>
      </DashboardShell>,
    );
    expect(screen.getByTestId("page")).toBeInTheDocument();
    expect(screen.queryByLabelText("Primary")).toBeNull();
  });

  it("renders chrome when authenticated", () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: "Akil", email: "a@b" } },
      status: "authenticated",
    });
    render(
      <DashboardShell>
        <div data-testid="page">page</div>
      </DashboardShell>,
    );
    expect(screen.getByLabelText("Primary")).toBeInTheDocument();
    expect(screen.getByText("Skip to main content")).toBeInTheDocument();
  });

  it("renders the skip-to-main-content link with sr-only / focus styles", () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: "Akil", email: "a@b" } },
      status: "authenticated",
    });
    const { container } = render(
      <DashboardShell>
        <div />
      </DashboardShell>,
    );
    const skip = container.querySelector('a[href="#main-content"]');
    expect(skip).toBeTruthy();
    expect(skip?.className).toContain("sr-only");
  });
});

describe("TopBar", () => {
  it("renders the search form by default and submits to /courses?q=", () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    // Replace the implementation (not just queue a return) so EVERY call
    // to useRouter from inside the rendered component yields the same push.
    const push = vi.fn();
    mockedUseRouter.mockImplementation(
      () =>
        ({
          push,
          replace: vi.fn(),
          refresh: vi.fn(),
          back: vi.fn(),
          forward: vi.fn(),
          prefetch: vi.fn(),
        }) as ReturnType<typeof useRouter>,
    );
    render(<TopBar />);
    const input = screen.getByPlaceholderText("Search courses");
    fireEvent.change(input, { target: { value: "auth basics" } });
    fireEvent.submit(input.closest("form")!);
    expect(push).toHaveBeenCalledWith("/courses?q=auth%20basics");
  });

  it("does not submit on empty query", () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    const push = vi.fn();
    mockedUseRouter.mockImplementation(
      () =>
        ({
          push,
          replace: vi.fn(),
          refresh: vi.fn(),
          back: vi.fn(),
          forward: vi.fn(),
          prefetch: vi.fn(),
        }) as ReturnType<typeof useRouter>,
    );
    render(<TopBar />);
    const input = screen.getByPlaceholderText("Search courses");
    fireEvent.submit(input.closest("form")!);
    expect(push).not.toHaveBeenCalled();
  });

  it("hides the search input in slim mode", () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    render(<TopBar slim />);
    expect(screen.queryByPlaceholderText("Search courses")).toBeNull();
  });

  it("renders a profile menu trigger when authenticated", () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: "Akil Fernando", email: "a@b" } },
      status: "authenticated",
    });
    render(<TopBar />);
    expect(screen.getByLabelText("Open user menu")).toBeInTheDocument();
  });

  it("hides the profile menu when no session", () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    render(<TopBar />);
    expect(screen.queryByLabelText("Open user menu")).toBeNull();
  });
});

describe("Sidebar", () => {
  it("renders Home + Courses for employees", () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: "x", email: "x@y", role: "employee" } },
      status: "authenticated",
    });
    render(<Sidebar />);
    expect(screen.getByLabelText("Primary")).toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Courses")).toBeInTheDocument();
    expect(screen.queryByText("Admin")).toBeNull();
    expect(screen.queryByText("Course Management")).toBeNull();
  });

  it("adds the Admin link for admins", () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: "x", email: "x@y", role: "admin" } },
      status: "authenticated",
    });
    render(<Sidebar />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.queryByText("Course Management")).toBeNull();
  });

  it("adds the Course Management link for course managers", () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: "x", email: "x@y", role: "course_manager" } },
      status: "authenticated",
    });
    render(<Sidebar />);
    expect(screen.getByText("Course Management")).toBeInTheDocument();
    expect(screen.queryByText("Admin")).toBeNull();
  });

  it("toggles pin state and persists to localStorage", () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: "x", email: "x@y", role: "employee" } },
      status: "authenticated",
    });
    render(<Sidebar />);
    const pinBtn = screen.getByLabelText("Pin sidebar");
    fireEvent.click(pinBtn);
    expect(localStorage.getItem("sidebar-pinned")).toBe("true");
    // After click the label flips.
    expect(screen.getByLabelText("Unpin sidebar")).toBeInTheDocument();
  });

  it("migrates the legacy sidebar-collapsed=false key to pinned=true", () => {
    localStorage.setItem("sidebar-collapsed", "false");
    mockUseSession.mockReturnValue({
      data: { user: { name: "x", email: "x@y", role: "employee" } },
      status: "authenticated",
    });
    render(<Sidebar />);
    // After mount the migration runs and removes the legacy key.
    expect(localStorage.getItem("sidebar-collapsed")).toBeNull();
  });
});

describe("LessonPlayerShell", () => {
  it("renders the outline, content, and progress label", () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    render(
      <LessonPlayerShell
        outline={<div data-testid="outline">outline</div>}
        progressLabel="Lesson 3 of 8"
        progressPercent={37}
      >
        <div data-testid="content">content body</div>
      </LessonPlayerShell>,
    );
    expect(screen.getByTestId("outline")).toBeInTheDocument();
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.getByText("Lesson 3 of 8")).toBeInTheDocument();
  });

  it("renders disabled Previous when no prev provided", () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    render(
      <LessonPlayerShell
        outline={null}
        progressLabel="x"
        progressPercent={0}
      >
        x
      </LessonPlayerShell>,
    );
    const prev = screen.getByText("Previous").closest("button");
    expect(prev?.hasAttribute("disabled")).toBe(true);
  });

  it("renders the next link when supplied", () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    render(
      <LessonPlayerShell
        outline={null}
        next={{ href: "/courses/c/lessons/next-l" }}
        progressLabel="x"
        progressPercent={0}
      >
        x
      </LessonPlayerShell>,
    );
    // "Next lesson" appears as the Link content.
    const next = screen
      .getAllByText("Next lesson")[0]
      .closest("a");
    expect(next?.getAttribute("href")).toBe("/courses/c/lessons/next-l");
  });

  it("conditionally renders the side rail when provided", () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    const { rerender } = render(
      <LessonPlayerShell
        outline={null}
        progressLabel="x"
        progressPercent={0}
      >
        x
      </LessonPlayerShell>,
    );
    expect(screen.queryByLabelText("Lesson resources")).toBeNull();

    rerender(
      <LessonPlayerShell
        outline={null}
        side={<div>side</div>}
        progressLabel="x"
        progressPercent={0}
      >
        x
      </LessonPlayerShell>,
    );
    expect(screen.getByLabelText("Lesson resources")).toBeInTheDocument();
  });
});
