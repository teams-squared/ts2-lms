import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CourseCard } from "@/components/courses/CourseCard";

describe("CourseCard", () => {
  const defaultProps = {
    id: "c1",
    title: "Test Course",
    description: "A test description",
    status: "published" as const,
    thumbnail: null,
    createdBy: { name: "Author", email: "author@test.com" },
  };

  it("renders title and description", () => {
    render(<CourseCard {...defaultProps} thumbnail={null} />);
    // Title appears in both the thumbnail fallback and the card heading
    expect(screen.getAllByText("Test Course").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("A test description")).toBeInTheDocument();
  });

  it("renders author name", () => {
    render(<CourseCard {...defaultProps} />);
    expect(screen.getByText("by Author")).toBeInTheDocument();
  });

  it("renders author email when name is null", () => {
    render(
      <CourseCard
        {...defaultProps}
        createdBy={{ name: null, email: "author@test.com" }}
      />
    );
    expect(screen.getByText("by author@test.com")).toBeInTheDocument();
  });

  it("renders status badge", () => {
    render(<CourseCard {...defaultProps} />);
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("links to course detail page", () => {
    render(<CourseCard {...defaultProps} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/courses/c1");
  });

  it("shows title text in thumbnail area when no thumbnail", () => {
    render(<CourseCard {...defaultProps} thumbnail={null} />);
    // Thumbnail fallback now shows a gradient with the title text instead of a single letter
    expect(screen.getAllByText("Test Course").length).toBeGreaterThanOrEqual(2);
  });
});
