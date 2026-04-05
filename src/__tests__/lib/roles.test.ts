import { describe, it, expect } from "vitest";
import { hasAccess } from "@/lib/roles";

describe("hasAccess", () => {
  describe("same-role access", () => {
    it("employee can access employee content", () => {
      expect(hasAccess("employee", "employee")).toBe(true);
    });
    it("manager can access manager content", () => {
      expect(hasAccess("manager", "manager")).toBe(true);
    });
    it("admin can access admin content", () => {
      expect(hasAccess("admin", "admin")).toBe(true);
    });
  });

  describe("upward access (higher role ≥ lower requirement)", () => {
    it("manager can access employee content", () => {
      expect(hasAccess("manager", "employee")).toBe(true);
    });
    it("admin can access employee content", () => {
      expect(hasAccess("admin", "employee")).toBe(true);
    });
    it("admin can access manager content", () => {
      expect(hasAccess("admin", "manager")).toBe(true);
    });
  });

  describe("downward access denied (lower role < higher requirement)", () => {
    it("employee cannot access manager content", () => {
      expect(hasAccess("employee", "manager")).toBe(false);
    });
    it("employee cannot access admin content", () => {
      expect(hasAccess("employee", "admin")).toBe(false);
    });
    it("manager cannot access admin content", () => {
      expect(hasAccess("manager", "admin")).toBe(false);
    });
  });
});
