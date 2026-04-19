import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoleBadge } from "@/components/ui/Badge";
import { ROLE_STYLES } from "@/lib/role-styles";
import type { Role } from "@/lib/types";

const LABELS: Record<Role, string> = {
  admin: "Admin",
  course_manager: "Course Manager",
  employee: "Employee",
};

describe("RoleBadge", () => {
  const roles: Role[] = ["admin", "course_manager", "employee"];

  it.each(roles)("renders '%s' role text", (role) => {
    render(<RoleBadge role={role} />);
    expect(screen.getByText(LABELS[role])).toBeInTheDocument();
  });

  it.each(roles)("applies correct ROLE_STYLES classes for '%s'", (role) => {
    const { container } = render(<RoleBadge role={role} />);
    const span = container.firstChild as HTMLElement;
    const expectedClasses = ROLE_STYLES[role].badge.split(" ");
    expectedClasses.forEach((cls) => {
      expect(span.className).toContain(cls);
    });
  });
});
