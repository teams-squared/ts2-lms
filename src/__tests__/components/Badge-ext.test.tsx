import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge, RoleBadge } from "@/components/ui/Badge";

describe("Badge", () => {
  it("renders with the default variant and data-slot", () => {
    const { container } = render(<Badge>Hello</Badge>);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute("data-slot")).toBe("badge");
    expect(el.getAttribute("data-variant")).toBe("default");
  });

  it("applies the secondary variant class when variant=secondary", () => {
    const { container } = render(<Badge variant="secondary">x</Badge>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("bg-surface-muted");
  });

  it("applies the destructive variant class when variant=destructive", () => {
    const { container } = render(<Badge variant="destructive">x</Badge>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("bg-danger");
  });

  it("applies the outline variant class when variant=outline", () => {
    const { container } = render(<Badge variant="outline">x</Badge>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("border-border");
  });

  it("renders inside a Slot when asChild is true", () => {
    const { container } = render(
      <Badge asChild>
        <a href="/x">link badge</a>
      </Badge>,
    );
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/x");
  });
});

describe("RoleBadge", () => {
  it("renders Admin label for admin role", () => {
    render(<RoleBadge role="admin" />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("renders Course Manager label for course_manager role", () => {
    render(<RoleBadge role="course_manager" />);
    expect(screen.getByText("Course Manager")).toBeInTheDocument();
  });

  it("renders Employee label for employee role", () => {
    render(<RoleBadge role="employee" />);
    expect(screen.getByText("Employee")).toBeInTheDocument();
  });

  it("merges custom className", () => {
    const { container } = render(<RoleBadge role="admin" className="ml-2" />);
    expect((container.firstChild as HTMLElement).className).toContain("ml-2");
  });
});
