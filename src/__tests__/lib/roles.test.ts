import { describe, it, expect } from "vitest";
import { hasAccess } from "@/lib/roles";
import type { Role } from "@/lib/types";

describe("hasAccess", () => {
  const cases: [Role, Role, boolean][] = [
    // userRole, requiredRole, expected
    ["admin",    "admin",    true],
    ["admin",    "manager",  true],
    ["admin",    "employee", true],
    ["manager",  "admin",    false],
    ["manager",  "manager",  true],
    ["manager",  "employee", true],
    ["employee", "admin",    false],
    ["employee", "manager",  false],
    ["employee", "employee", true],
  ];

  it.each(cases)(
    "hasAccess(%s, %s) → %s",
    (userRole, requiredRole, expected) => {
      expect(hasAccess(userRole, requiredRole)).toBe(expected);
    }
  );
});
