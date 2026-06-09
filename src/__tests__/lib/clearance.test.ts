import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const {
  satisfiesClearance,
  canAuthorForRequirements,
  canAccessResource,
  canAuthorResource,
  filterAccessibleDocIds,
  loadUserTiers,
  hasAnyClearance,
  describeRequirements,
} = await import("@/lib/clearance");

// Helper to build a tier map quickly.
const tiers = (entries: Record<string, number>) =>
  new Map(Object.entries(entries));

describe("satisfiesClearance (READ — ANY-satisfies)", () => {
  it("empty requirements honour emptyDefault", () => {
    expect(satisfiesClearance([], tiers({}), true)).toBe(true);
    expect(satisfiesClearance([], tiers({}), false)).toBe(false);
  });

  it("grants access when user tier <= required tier (more privileged)", () => {
    // user holds cyber tier 1; doc requires cyber tier 3 (less protected)
    expect(
      satisfiesClearance([{ sectorId: "cyber", tier: 3 }], tiers({ cyber: 1 })),
    ).toBe(true);
  });

  it("denies access when user tier > required tier (less privileged)", () => {
    // user holds cyber tier 3; doc requires cyber tier 1 (more protected)
    expect(
      satisfiesClearance([{ sectorId: "cyber", tier: 1 }], tiers({ cyber: 3 })),
    ).toBe(false);
  });

  it("grants when exact tier match", () => {
    expect(
      satisfiesClearance([{ sectorId: "cyber", tier: 2 }], tiers({ cyber: 2 })),
    ).toBe(true);
  });

  it("denies when user holds no grant in the required sector", () => {
    expect(
      satisfiesClearance([{ sectorId: "finance", tier: 5 }], tiers({ cyber: 0 })),
    ).toBe(false);
  });

  it("ANY-satisfies: passes if any single requirement is met", () => {
    const reqs = [
      { sectorId: "cyber", tier: 0 }, // user can't meet (holds tier 2)
      { sectorId: "finance", tier: 2 }, // user meets (holds tier 1)
    ];
    expect(satisfiesClearance(reqs, tiers({ cyber: 2, finance: 1 }))).toBe(true);
  });

  it("ANY-satisfies: denies if no requirement is met", () => {
    const reqs = [
      { sectorId: "cyber", tier: 0 },
      { sectorId: "finance", tier: 0 },
    ];
    expect(satisfiesClearance(reqs, tiers({ cyber: 2, finance: 1 }))).toBe(false);
  });
});

describe("canAuthorForRequirements (AUTHOR — ALL-satisfies, >=1)", () => {
  it("rejects zero requirements", () => {
    expect(canAuthorForRequirements([], tiers({ cyber: 0 }))).toBe(false);
  });

  it("allows when author satisfies the single requirement", () => {
    // author holds cyber tier 1; may author for cyber tier 1 and higher numbers
    expect(
      canAuthorForRequirements([{ sectorId: "cyber", tier: 1 }], tiers({ cyber: 1 })),
    ).toBe(true);
    expect(
      canAuthorForRequirements([{ sectorId: "cyber", tier: 2 }], tiers({ cyber: 1 })),
    ).toBe(true);
  });

  it("rejects authoring above own clearance (more protected tier)", () => {
    // author holds cyber tier 1; cannot author for cyber tier 0
    expect(
      canAuthorForRequirements([{ sectorId: "cyber", tier: 0 }], tiers({ cyber: 1 })),
    ).toBe(false);
  });

  it("requires ALL requirements satisfied (not any)", () => {
    const reqs = [
      { sectorId: "cyber", tier: 2 }, // author meets (holds 1)
      { sectorId: "finance", tier: 2 }, // author lacks finance entirely
    ];
    expect(canAuthorForRequirements(reqs, tiers({ cyber: 1 }))).toBe(false);
  });

  it("allows multi-sector when author satisfies every requirement", () => {
    const reqs = [
      { sectorId: "cyber", tier: 2 },
      { sectorId: "finance", tier: 3 },
    ];
    expect(canAuthorForRequirements(reqs, tiers({ cyber: 1, finance: 1 }))).toBe(true);
  });
});

describe("resource-level helpers (admin bypass)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("canAccessResource: admin bypasses without querying", async () => {
    const ok = await canAccessResource("u1", "admin", [{ sectorId: "cyber", tier: 0 }], false);
    expect(ok).toBe(true);
    expect(mockPrisma.userClearance.findMany).not.toHaveBeenCalled();
  });

  it("canAccessResource: employee gated by loaded tiers", async () => {
    mockPrisma.userClearance.findMany.mockResolvedValue([{ sectorId: "cyber", tier: 2 }]);
    expect(
      await canAccessResource("u1", "employee", [{ sectorId: "cyber", tier: 3 }], false),
    ).toBe(true);
    expect(
      await canAccessResource("u1", "employee", [{ sectorId: "cyber", tier: 1 }], false),
    ).toBe(false);
  });

  it("canAccessResource: internal-doc empty reqs deny for non-admin", async () => {
    mockPrisma.userClearance.findMany.mockResolvedValue([{ sectorId: "cyber", tier: 0 }]);
    expect(await canAccessResource("u1", "employee", [], false)).toBe(false);
  });

  it("canAuthorResource: admin bypasses", async () => {
    expect(await canAuthorResource("u1", "admin", [])).toBe(true);
  });

  it("canAuthorResource: employee must satisfy all reqs", async () => {
    mockPrisma.userClearance.findMany.mockResolvedValue([{ sectorId: "cyber", tier: 1 }]);
    expect(await canAuthorResource("u1", "employee", [{ sectorId: "cyber", tier: 2 }])).toBe(true);
    expect(await canAuthorResource("u1", "employee", [{ sectorId: "cyber", tier: 0 }])).toBe(false);
  });
});

describe("filterAccessibleDocIds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("admin sees every doc, no query", async () => {
    const docs = [
      { id: "d1", reqs: [{ sectorId: "cyber", tier: 0 }] },
      { id: "d2", reqs: [] },
    ];
    const set = await filterAccessibleDocIds("u1", "admin", docs, false);
    expect(set).toEqual(new Set(["d1", "d2"]));
    expect(mockPrisma.userClearance.findMany).not.toHaveBeenCalled();
  });

  it("loads tiers ONCE and filters in memory", async () => {
    mockPrisma.userClearance.findMany.mockResolvedValue([{ sectorId: "cyber", tier: 2 }]);
    const docs = [
      { id: "d1", reqs: [{ sectorId: "cyber", tier: 3 }] }, // accessible (2<=3)
      { id: "d2", reqs: [{ sectorId: "cyber", tier: 1 }] }, // not (2>1)
      { id: "d3", reqs: [] }, // empty -> denied (emptyDefault false)
      { id: "d4", reqs: [{ sectorId: "finance", tier: 5 }] }, // no grant
    ];
    const set = await filterAccessibleDocIds("u1", "employee", docs, false);
    expect(set).toEqual(new Set(["d1"]));
    expect(mockPrisma.userClearance.findMany).toHaveBeenCalledTimes(1);
  });
});

describe("loadUserTiers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps sector grants to tiers", async () => {
    mockPrisma.userClearance.findMany.mockResolvedValue([
      { sectorId: "cyber", tier: 1 },
      { sectorId: "finance", tier: 3 },
    ]);
    const map = await loadUserTiers("u1");
    expect(map.get("cyber")).toBe(1);
    expect(map.get("finance")).toBe(3);
    expect(map.size).toBe(2);
  });
});

describe("hasAnyClearance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("true when user holds >=1 grant", async () => {
    mockPrisma.userClearance.count.mockResolvedValue(2);
    expect(await hasAnyClearance("u1")).toBe(true);
  });

  it("false when user holds none", async () => {
    mockPrisma.userClearance.count.mockResolvedValue(0);
    expect(await hasAnyClearance("u1")).toBe(false);
  });
});

describe("describeRequirements", () => {
  it("returns null for empty", () => {
    expect(describeRequirements([])).toBeNull();
  });

  it("joins requirements with 'or'", () => {
    expect(
      describeRequirements([
        { tier: 2, sector: { label: "Cybersecurity" } },
        { tier: 1, sector: { label: "Finance" } },
      ]),
    ).toBe("Cybersecurity tier ≤2 or Finance tier ≤1");
  });
});
