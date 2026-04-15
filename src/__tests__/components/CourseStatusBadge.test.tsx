import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CourseStatusBadge } from "@/components/courses/CourseStatusBadge";
import type { CourseStatus } from "@/lib/types";

describe("CourseStatusBadge", () => {
  const statuses: CourseStatus[] = ["draft", "published", "archived"];

  it.each(statuses)("renders '%s' status text", (status) => {
    render(<CourseStatusBadge status={status} />);
    const capitalized = status.charAt(0).toUpperCase() + status.slice(1);
    expect(screen.getByText(capitalized)).toBeInTheDocument();
  });

  it("applies yellow classes for draft", () => {
    const { container } = render(<CourseStatusBadge status="draft" />);
    const span = container.firstChild as HTMLElement;
    expect(span.className).toContain("bg-yellow-100");
  });

  it("applies green classes for published", () => {
    const { container } = render(<CourseStatusBadge status="published" />);
    const span = container.firstChild as HTMLElement;
    expect(span.className).toContain("bg-green-100");
  });

  it("applies gray classes for archived", () => {
    const { container } = render(<CourseStatusBadge status="archived" />);
    const span = container.firstChild as HTMLElement;
    expect(span.className).toContain("bg-gray-100");
  });
});
