import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoleBadge } from "@/components/ui/Badge";
import { ROLE_STYLES } from "@/lib/role-styles";
import type { Role } from "@/lib/types";

describe("RoleBadge", () => {
  const roles: Role[] = ["admin", "manager", "employee"];

  it.each(roles)("renders '%s' role text", (role) => {
    render(<RoleBadge role={role} />);
    const capitalized = role.charAt(0).toUpperCase() + role.slice(1);
    expect(screen.getByText(capitalized)).toBeInTheDocument();
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
