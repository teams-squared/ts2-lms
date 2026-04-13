import { describe, it, expect } from "vitest";
import { ROLE_STYLES } from "@/lib/role-styles";
import type { Role } from "@/lib/types";

describe("ROLE_STYLES", () => {
  const roles: Role[] = ["admin", "manager", "employee"];

  it.each(roles)("has entry for '%s' role", (role) => {
    expect(ROLE_STYLES[role]).toBeDefined();
  });

  it.each(roles)("'%s' has badge, dot, and avatar string properties", (role) => {
    const style = ROLE_STYLES[role];
    expect(typeof style.badge).toBe("string");
    expect(typeof style.dot).toBe("string");
    expect(typeof style.avatar).toBe("string");
    expect(style.badge.length).toBeGreaterThan(0);
    expect(style.dot.length).toBeGreaterThan(0);
    expect(style.avatar.length).toBeGreaterThan(0);
  });
});
