import { describe, it, expect } from "vitest";
import {
  scopeSetFromRows,
  filterModulesByScope,
  isModuleInScope,
} from "@/lib/enrollmentScope";

describe("scopeSetFromRows", () => {
  it("returns null (= whole course) for zero rows", () => {
    expect(scopeSetFromRows([])).toBeNull();
  });

  it("returns null for null/undefined input", () => {
    expect(scopeSetFromRows(null)).toBeNull();
    expect(scopeSetFromRows(undefined)).toBeNull();
  });

  it("returns a Set of module ids when rows are present", () => {
    const set = scopeSetFromRows([{ moduleId: "A" }, { moduleId: "C" }]);
    expect(set).toBeInstanceOf(Set);
    expect([...set!].sort()).toEqual(["A", "C"]);
  });
});

describe("filterModulesByScope", () => {
  const modules = [{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }];

  it("returns all modules when scope is null", () => {
    expect(filterModulesByScope(modules, null)).toEqual(modules);
  });

  it("filters to the scoped modules only", () => {
    const scope = new Set(["A", "C"]);
    expect(filterModulesByScope(modules, scope).map((m) => m.id)).toEqual([
      "A",
      "C",
    ]);
  });

  it("ignores scope ids that don't match any module", () => {
    const scope = new Set(["A", "Z"]);
    expect(filterModulesByScope(modules, scope).map((m) => m.id)).toEqual(["A"]);
  });
});

describe("isModuleInScope", () => {
  it("includes every module when scope is null", () => {
    expect(isModuleInScope("anything", null)).toBe(true);
  });

  it("includes only modules in the scope set", () => {
    const scope = new Set(["A", "C"]);
    expect(isModuleInScope("A", scope)).toBe(true);
    expect(isModuleInScope("B", scope)).toBe(false);
  });
});
