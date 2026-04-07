import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Category } from "@/lib/types";

// Mock sharepoint before importing docs
vi.mock("@/lib/sharepoint", () => ({
  fetchCategoriesFromSharePoint: vi.fn(),
  fetchDocListFromSharePoint: vi.fn(),
  fetchDocContentFromSharePoint: vi.fn(),
}));

import {
  fetchCategoriesFromSharePoint,
  fetchDocListFromSharePoint,
  fetchDocContentFromSharePoint,
} from "@/lib/sharepoint";
import {
  getAllDocs,
  getAccessibleCategories,
  getDocsByCategory,
  getDocContent,
  getTopLevelCategories,
  getSubcategoriesOf,
  getCategoryBySlug,
} from "@/lib/docs";

const mockFetchCategories = vi.mocked(fetchCategoriesFromSharePoint);
const mockFetchDocList = vi.mocked(fetchDocListFromSharePoint);
const mockFetchDocContent = vi.mocked(fetchDocContentFromSharePoint);

const CATEGORIES: Category[] = [
  { slug: "getting-started", title: "Getting Started", description: "", icon: "rocket", minRole: "employee", order: 1 },
  { slug: "management", title: "Management", description: "", icon: "briefcase", minRole: "manager", order: 2 },
  { slug: "security-ops", title: "Security Ops", description: "", icon: "shield", minRole: "admin", order: 3 },
  { slug: "cybersecurity", title: "Cybersecurity", description: "", icon: "shield", minRole: "employee", order: 4 },
  {
    slug: "cybersecurity-onboarding",
    title: "Cybersecurity Onboarding",
    description: "",
    icon: "book",
    minRole: "employee",
    order: 5,
    parentCategory: "cybersecurity",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchCategories.mockResolvedValue(CATEGORIES);
});

// ── getAccessibleCategories ────────────────────────────────────────────────
describe("getAccessibleCategories", () => {
  it("returns only employee-accessible categories for employee", async () => {
    const result = await getAccessibleCategories("employee");
    const slugs = result.map((c) => c.slug);
    expect(slugs).toContain("getting-started");
    expect(slugs).toContain("cybersecurity");
    expect(slugs).not.toContain("management");
    expect(slugs).not.toContain("security-ops");
  });

  it("returns employee + manager categories for manager", async () => {
    const result = await getAccessibleCategories("manager");
    const slugs = result.map((c) => c.slug);
    expect(slugs).toContain("getting-started");
    expect(slugs).toContain("management");
    expect(slugs).not.toContain("security-ops");
  });

  it("returns all categories for admin", async () => {
    const result = await getAccessibleCategories("admin");
    expect(result).toHaveLength(CATEGORIES.length);
  });
});

// ── getTopLevelCategories ──────────────────────────────────────────────────
describe("getTopLevelCategories", () => {
  it("excludes categories with a parentCategory", async () => {
    const result = await getTopLevelCategories("admin");
    expect(result.every((c) => !c.parentCategory)).toBe(true);
    expect(result.map((c) => c.slug)).not.toContain("cybersecurity-onboarding");
  });

  it("still applies role filtering", async () => {
    const result = await getTopLevelCategories("employee");
    expect(result.map((c) => c.slug)).not.toContain("management");
  });
});

// ── getSubcategoriesOf ─────────────────────────────────────────────────────
describe("getSubcategoriesOf", () => {
  it("returns only direct children of the given parent slug", async () => {
    const result = await getSubcategoriesOf("cybersecurity", "admin");
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("cybersecurity-onboarding");
  });

  it("returns empty array when parent has no children", async () => {
    const result = await getSubcategoriesOf("getting-started", "admin");
    expect(result).toHaveLength(0);
  });
});

// ── getCategoryBySlug ──────────────────────────────────────────────────────
describe("getCategoryBySlug", () => {
  it("returns the matching category", async () => {
    const result = await getCategoryBySlug("management");
    expect(result?.title).toBe("Management");
  });

  it("returns undefined for unknown slug", async () => {
    const result = await getCategoryBySlug("does-not-exist");
    expect(result).toBeUndefined();
  });
});

// ── getDocsByCategory ──────────────────────────────────────────────────────
describe("getDocsByCategory", () => {
  const MDX_EMPLOYEE = `---
title: Intro Guide
description: Getting started
minRole: employee
order: 2
author: Alice
tags: [onboarding]
---
# Content`;

  const MDX_MANAGER = `---
title: Manager Handbook
description: For managers
minRole: manager
order: 1
---
# Content`;

  beforeEach(() => {
    mockFetchDocList.mockResolvedValue(["intro-guide.mdx", "manager-handbook.mdx"]);
    mockFetchDocContent.mockImplementation((_cat, name) =>
      Promise.resolve(name === "intro-guide.mdx" ? MDX_EMPLOYEE : MDX_MANAGER)
    );
  });

  it("parses frontmatter fields correctly", async () => {
    const docs = await getDocsByCategory("getting-started");
    const intro = docs.find((d) => d.slug === "intro-guide");
    expect(intro).toBeDefined();
    expect(intro?.title).toBe("Intro Guide");
    expect(intro?.description).toBe("Getting started");
    expect(intro?.author).toBe("Alice");
    expect(intro?.tags).toEqual(["onboarding"]);
    expect(intro?.minRole).toBe("employee");
  });

  it("strips .mdx extension from slug", async () => {
    const docs = await getDocsByCategory("getting-started");
    expect(docs.map((d) => d.slug)).toContain("intro-guide");
  });

  it("sorts by order field ascending", async () => {
    const docs = await getDocsByCategory("getting-started");
    expect(docs[0].slug).toBe("manager-handbook"); // order 1
    expect(docs[1].slug).toBe("intro-guide");       // order 2
  });

  it("filters out docs above user role when role provided", async () => {
    const docs = await getDocsByCategory("getting-started", "employee");
    expect(docs.map((d) => d.slug)).not.toContain("manager-handbook");
  });

  it("returns all docs when no role provided", async () => {
    const docs = await getDocsByCategory("getting-started");
    expect(docs).toHaveLength(2);
  });

  it("returns empty array when category has no files", async () => {
    mockFetchDocList.mockResolvedValue([]);
    const docs = await getDocsByCategory("empty-category");
    expect(docs).toHaveLength(0);
  });
});

// ── getAllDocs ─────────────────────────────────────────────────────────────
describe("getAllDocs", () => {
  const MDX_EMPLOYEE = `---\ntitle: Employee Doc\nminRole: employee\norder: 1\n---\n# Content`;
  const MDX_ADMIN = `---\ntitle: Admin Doc\nminRole: admin\norder: 2\n---\n# Content`;

  beforeEach(() => {
    mockFetchDocList.mockResolvedValue(["employee-doc.mdx", "admin-doc.mdx"]);
    mockFetchDocContent.mockImplementation((_cat, name) =>
      Promise.resolve(name === "employee-doc.mdx" ? MDX_EMPLOYEE : MDX_ADMIN)
    );
  });

  it("returns all docs across all categories when no role provided", async () => {
    const docs = await getAllDocs();
    // CATEGORIES has 5 entries, each with 2 docs = 10 total
    expect(docs).toHaveLength(CATEGORIES.length * 2);
  });

  it("filters both categories and docs by employee role", async () => {
    const docs = await getAllDocs("employee");
    // employee can access: getting-started, cybersecurity, cybersecurity-onboarding (3 categories)
    // each has 1 employee-accessible doc = 3 docs
    expect(docs.every((d) => d.minRole === "employee")).toBe(true);
    expect(docs).toHaveLength(3);
  });

  it("filters both categories and docs by manager role", async () => {
    const docs = await getAllDocs("manager");
    // manager can access: getting-started, management, cybersecurity, cybersecurity-onboarding (4 categories)
    // each has 1 employee doc; management also has 1 admin doc filtered out = 4 docs
    expect(docs).toHaveLength(4);
  });

  it("returns all docs for admin role", async () => {
    const docs = await getAllDocs("admin");
    expect(docs).toHaveLength(CATEGORIES.length * 2);
  });
});

// ── getDocContent ──────────────────────────────────────────────────────────
describe("getDocContent", () => {
  const RAW = `---
title: Security Basics
minRole: employee
---
The body content here.`;

  beforeEach(() => {
    mockFetchDocList.mockResolvedValue(["security-basics.mdx"]);
    mockFetchDocContent.mockResolvedValue(RAW);
  });

  it("returns null when slug not found in file list", async () => {
    const result = await getDocContent("getting-started", "nonexistent");
    expect(result).toBeNull();
  });

  it("returns parsed meta and raw content for valid slug", async () => {
    const result = await getDocContent("getting-started", "security-basics");
    expect(result).not.toBeNull();
    expect(result?.meta.title).toBe("Security Basics");
    expect(result?.content).toContain("The body content here.");
  });
});
