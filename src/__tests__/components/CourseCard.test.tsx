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
    render(<CourseCard {...defaultProps} />);
    expect(screen.getByText("Test Course")).toBeInTheDocument();
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
    expect(screen.getByText("published")).toBeInTheDocument();
  });

  it("links to course detail page", () => {
    render(<CourseCard {...defaultProps} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/courses/c1");
  });

  it("shows initial letter when no thumbnail", () => {
    render(<CourseCard {...defaultProps} thumbnail={null} />);
    expect(screen.getByText("T")).toBeInTheDocument();
  });
});
