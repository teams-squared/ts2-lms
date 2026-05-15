import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  CatalogSidebar,
  type SidebarNode,
} from "@/components/courses/CatalogSidebar";
import { useRouter, useSearchParams } from "next/navigation";

const mockedUseRouter = vi.mocked(useRouter);
const mockedUseSearchParams = vi.mocked(useSearchParams);
let pushSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  pushSpy = vi.fn();
  mockedUseRouter.mockImplementation(
    () =>
      ({
        push: pushSpy,
        replace: vi.fn(),
        refresh: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        prefetch: vi.fn(),
      }) as ReturnType<typeof useRouter>,
  );
  mockedUseSearchParams.mockImplementation(
    () => new URLSearchParams() as ReturnType<typeof useSearchParams>,
  );
});

const tree: SidebarNode[] = [
  {
    id: "root-A",
    name: "Security",
    courseCount: 3,
    children: [
      {
        id: "child-A1",
        name: "Compliance",
        courseCount: 2,
        children: [],
      },
    ],
  },
  {
    id: "root-B",
    name: "Engineering",
    courseCount: 0,
    children: [],
  },
];

describe("CatalogSidebar", () => {
  it("renders the All Courses option active when no activeNodeId", () => {
    render(<CatalogSidebar nodes={tree} activeNodeId={null} />);
    const allBtn = screen.getByText("All Courses").closest("button");
    expect(allBtn?.className).toContain("bg-primary-subtle");
  });

  it("renders each top-level node with its course count", () => {
    render(<CatalogSidebar nodes={tree} activeNodeId={null} />);
    expect(screen.getByText("Security")).toBeInTheDocument();
    expect(screen.getByText("Engineering")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("collapses child nodes by default", () => {
    render(<CatalogSidebar nodes={tree} activeNodeId={null} />);
    expect(screen.queryByText("Compliance")).toBeNull();
  });

  it("expands a node when its chevron is clicked", () => {
    const { container } = render(
      <CatalogSidebar nodes={tree} activeNodeId={null} />,
    );
    // The first chevron is the expand toggle for the first node with children.
    const chevron = container.querySelector("button svg")?.closest("button");
    fireEvent.click(chevron!);
    expect(screen.getByText("Compliance")).toBeInTheDocument();
  });

  it("auto-expands the path to the active descendant on mount", () => {
    render(<CatalogSidebar nodes={tree} activeNodeId="child-A1" />);
    // Child should be visible because the ancestor is auto-expanded.
    expect(screen.getByText("Compliance")).toBeInTheDocument();
  });

  it("pushes /courses?node=<id> when a node is clicked", () => {
    render(<CatalogSidebar nodes={tree} activeNodeId={null} />);
    fireEvent.click(screen.getByText("Security"));
    expect(pushSpy).toHaveBeenCalledWith("/courses?node=root-A");
  });

  it("pushes /courses (no params) when All Courses is clicked", () => {
    render(<CatalogSidebar nodes={tree} activeNodeId="root-A" />);
    fireEvent.click(screen.getByText("All Courses"));
    expect(pushSpy).toHaveBeenCalledWith("/courses");
  });

  it("preserves existing query params and drops the legacy 'category'", () => {
    mockedUseSearchParams.mockImplementation(
      () =>
        new URLSearchParams("q=auth&category=old") as ReturnType<
          typeof useSearchParams
        >,
    );
    render(<CatalogSidebar nodes={tree} activeNodeId={null} />);
    fireEvent.click(screen.getByText("Security"));
    expect(pushSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^\/courses\?(q=auth&node=root-A|node=root-A&q=auth)$/),
    );
    // category=old is dropped.
    const url = pushSpy.mock.calls[0][0] as string;
    expect(url).not.toContain("category=");
  });
});
