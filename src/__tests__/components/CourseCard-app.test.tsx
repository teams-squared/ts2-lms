import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CourseCard } from "@/components/app/CourseCard";

describe("CourseCard (components/app)", () => {
  it("renders the title and href on the anchor", () => {
    const { container } = render(
      <CourseCard href="/courses/c-1" title="Auth Basics" />,
    );
    expect(screen.getByText("Auth Basics")).toBeInTheDocument();
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "/courses/c-1",
    );
  });

  it("renders the category badge when category is supplied", () => {
    render(
      <CourseCard
        href="/x"
        title="x"
        category="Security"
      />,
    );
    expect(screen.getByText("Security")).toBeInTheDocument();
  });

  it("omits the description block when none supplied", () => {
    const { container } = render(<CourseCard href="/x" title="x" />);
    expect(container.querySelectorAll("p").length).toBe(0);
  });

  it("renders module count + duration meta row", () => {
    render(
      <CourseCard
        href="/x"
        title="x"
        moduleCount={6}
        durationLabel="2h 30m"
      />,
    );
    expect(screen.getByText("6 modules")).toBeInTheDocument();
    expect(screen.getByText("2h 30m")).toBeInTheDocument();
  });

  it("singularizes module count when 1", () => {
    render(<CourseCard href="/x" title="x" moduleCount={1} />);
    expect(screen.getByText("1 module")).toBeInTheDocument();
  });

  it("renders the progress bar when progress is a number", () => {
    render(<CourseCard href="/x" title="x" progress={42} />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
  });
});
