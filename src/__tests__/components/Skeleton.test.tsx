import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonCourseCard,
  SkeletonTableRow,
} from "@/components/ui/Skeleton";

describe("Skeleton", () => {
  it("renders the canonical shimmer + rounded-md classes", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("skeleton-shimmer");
    expect(el.className).toContain("rounded-md");
    expect(el.getAttribute("data-slot")).toBe("skeleton");
  });

  it("merges custom className", () => {
    const { container } = render(<Skeleton className="h-4 w-64" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("h-4");
    expect(el.className).toContain("w-64");
  });
});

describe("SkeletonText", () => {
  it("renders one Skeleton per line, last one narrower", () => {
    const { container } = render(<SkeletonText lines={4} />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons).toHaveLength(4);
    // Last line uses w-3/4 (narrower) per the source.
    expect((skeletons[3] as HTMLElement).className).toContain("w-3/4");
    expect((skeletons[0] as HTMLElement).className).toContain("w-full");
  });

  it("defaults to 3 lines when no count is supplied", () => {
    const { container } = render(<SkeletonText />);
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3);
  });
});

describe("SkeletonCard", () => {
  it("renders three Skeleton bars inside a bordered card", () => {
    const { container } = render(<SkeletonCard />);
    expect(
      container.querySelectorAll('[data-slot="skeleton"]'),
    ).toHaveLength(3);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe("SkeletonCourseCard", () => {
  it("renders the canonical 5-bar course-card skeleton", () => {
    const { container } = render(<SkeletonCourseCard />);
    // 1 thumbnail bar + 4 content bars.
    expect(
      container.querySelectorAll('[data-slot="skeleton"]'),
    ).toHaveLength(5);
  });
});

describe("SkeletonTableRow", () => {
  it("renders cols=4 cells by default", () => {
    const { container } = render(
      <table>
        <tbody>
          <SkeletonTableRow />
        </tbody>
      </table>,
    );
    expect(container.querySelectorAll("td")).toHaveLength(4);
  });

  it("renders the requested number of columns", () => {
    const { container } = render(
      <table>
        <tbody>
          <SkeletonTableRow cols={7} />
        </tbody>
      </table>,
    );
    expect(container.querySelectorAll("td")).toHaveLength(7);
  });
});
