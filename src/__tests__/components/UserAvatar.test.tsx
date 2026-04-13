import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UserAvatar } from "@/components/ui/UserAvatar";

describe("UserAvatar", () => {
  it("renders first letter of name uppercased", () => {
    render(<UserAvatar name="alice" />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("renders '?' for null name", () => {
    render(<UserAvatar name={null} />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("renders '?' for undefined name", () => {
    render(<UserAvatar />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("applies sm size classes by default", () => {
    const { container } = render(<UserAvatar name="Bob" />);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain("w-7");
    expect(div.className).toContain("h-7");
  });

  it("applies md size classes", () => {
    const { container } = render(<UserAvatar name="Bob" size="md" />);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain("w-9");
    expect(div.className).toContain("h-9");
  });

  it("applies lg size classes", () => {
    const { container } = render(<UserAvatar name="Bob" size="lg" />);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain("w-14");
    expect(div.className).toContain("h-14");
  });
});
