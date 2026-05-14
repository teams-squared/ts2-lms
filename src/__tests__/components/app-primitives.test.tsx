import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { ProgressBar } from "@/components/app/ProgressBar";
import { StatusBadge, type StatusKind } from "@/components/app/StatusBadge";
import {
  LessonOutline,
  type OutlineModule,
} from "@/components/app/LessonOutline";

describe("ProgressBar", () => {
  it("renders an aria-labelled progressbar with the rounded value", () => {
    render(<ProgressBar value={66.7} label="Course progress" />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-label")).toBe("Course progress");
    expect(bar.getAttribute("aria-valuenow")).toBe("67");
  });

  it("clamps values below 0 and above 100", () => {
    const { rerender } = render(<ProgressBar value={-5} label="x" />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "0",
    );
    rerender(<ProgressBar value={150} label="x" />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "100",
    );
  });

  it("shows the percent suffix when showPercent is true", () => {
    render(<ProgressBar value={42} label="x" showPercent />);
    expect(screen.getByText("42%")).toBeInTheDocument();
  });

  it("renders a leading caption when provided", () => {
    render(<ProgressBar value={42} label="x" caption="7 of 12 lessons" />);
    expect(screen.getByText("7 of 12 lessons")).toBeInTheDocument();
  });

  it("applies h-2 for size=md and h-1.5 for size=sm (default)", () => {
    const { rerender } = render(<ProgressBar value={50} label="x" />);
    expect(screen.getByRole("progressbar").className).toContain("h-1.5");
    rerender(<ProgressBar value={50} label="x" size="md" />);
    expect(screen.getByRole("progressbar").className).toContain("h-2");
  });

  it("omits the caption row entirely when no caption + no percent", () => {
    const { container } = render(<ProgressBar value={50} label="x" />);
    // The only child should be the bar itself, no caption div.
    expect(container.textContent).toBe("");
  });
});

describe("StatusBadge", () => {
  const kinds: StatusKind[] = [
    "completed",
    "in-progress",
    "not-started",
    "overdue",
    "required",
  ];

  for (const kind of kinds) {
    it(`renders the ${kind} variant with its canonical label`, () => {
      render(<StatusBadge status={kind} />);
      // Each kind has a single canonical label text.
      const labels: Record<StatusKind, string> = {
        completed: "Completed",
        "in-progress": "In progress",
        "not-started": "Not started",
        overdue: "Overdue",
        required: "Required",
      };
      expect(screen.getByText(labels[kind])).toBeInTheDocument();
    });
  }

  it("overrides the label when one is supplied", () => {
    render(<StatusBadge status="overdue" label="Due in 3 days" />);
    expect(screen.getByText("Due in 3 days")).toBeInTheDocument();
    expect(screen.queryByText("Overdue")).toBeNull();
  });

  it("hides the icon when hideIcon is set", () => {
    const { container } = render(
      <StatusBadge status="completed" hideIcon />,
    );
    // The Lucide icon is the only SVG inside the badge.
    expect(container.querySelector("svg")).toBeNull();
  });

  it("uses bg-success-subtle on completed and bg-danger-subtle on overdue", () => {
    const { container: ok } = render(<StatusBadge status="completed" />);
    const { container: bad } = render(<StatusBadge status="overdue" />);
    expect((ok.firstChild as HTMLElement).className).toContain(
      "bg-success-subtle",
    );
    expect((bad.firstChild as HTMLElement).className).toContain(
      "bg-danger-subtle",
    );
  });
});

describe("LessonOutline", () => {
  const modules: OutlineModule[] = [
    {
      id: "m1",
      title: "Intro",
      lessons: [
        {
          id: "l1",
          title: "Welcome",
          href: "/courses/c/lessons/l1",
          kind: "text",
          completed: true,
        },
        {
          id: "l2",
          title: "Watch the video",
          href: "/courses/c/lessons/l2",
          kind: "video",
          active: true,
        },
        {
          id: "l3",
          title: "Read the handbook",
          href: "/courses/c/lessons/l3",
          kind: "document",
        },
        {
          id: "l4",
          title: "Quick quiz",
          href: "/courses/c/lessons/l4",
          kind: "quiz",
        },
      ],
    },
  ];

  it("renders module title with 1-indexed prefix", () => {
    render(<LessonOutline modules={modules} />);
    expect(screen.getByText("Intro")).toBeInTheDocument();
    expect(screen.getByText("1.")).toBeInTheDocument();
  });

  it("renders one Link per lesson with the right href", () => {
    const { container } = render(<LessonOutline modules={modules} />);
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(4);
    expect(links[0].getAttribute("href")).toBe("/courses/c/lessons/l1");
  });

  it("marks the active lesson with aria-current=page", () => {
    render(<LessonOutline modules={modules} />);
    const active = screen.getByText("Watch the video").closest("a");
    expect(active?.getAttribute("aria-current")).toBe("page");
  });

  it("renders the correct kind icon for each lesson type", () => {
    const { container } = render(<LessonOutline modules={modules} />);
    // Four lessons → four lucide icons (svg elements).
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBe(4);
  });
});
