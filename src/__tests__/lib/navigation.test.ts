import { describe, it, expect } from "vitest";
import { isNavActive } from "@/lib/navigation";

describe("isNavActive", () => {
  it("root '/' requires exact match", () => {
    expect(isNavActive("/", "/")).toBe(true);
  });

  it("root '/' does not match other paths", () => {
    expect(isNavActive("/", "/admin")).toBe(false);
    expect(isNavActive("/", "/profile")).toBe(false);
  });

  it("non-root matches exact path", () => {
    expect(isNavActive("/admin", "/admin")).toBe(true);
  });

  it("non-root matches nested paths (startsWith)", () => {
    expect(isNavActive("/admin", "/admin/users")).toBe(true);
    expect(isNavActive("/admin", "/admin/analytics")).toBe(true);
  });

  it("non-root does not match unrelated paths", () => {
    expect(isNavActive("/admin", "/")).toBe(false);
    expect(isNavActive("/admin", "/profile")).toBe(false);
  });
});
