import { describe, it, expect } from "vitest";
import {
  getDescendantCourseIds,
  getDescendantCourseIdsForNodes,
  flattenTree,
  countCoursesInSubtree,
} from "@/lib/courseNodes";
import type { NodeWithChildren } from "@/lib/courseNodes";

const mkCourse = (id: string) => ({ id, title: `Course ${id}`, status: "PUBLISHED" });

const tree: NodeWithChildren[] = [
  {
    id: "law",
    name: "Law Courses",
    description: null,
    order: 0,
    parentId: null,
    courses: [mkCourse("c1"), mkCourse("c2")],
    children: [
      {
        id: "property",
        name: "Property Law",
        description: null,
        order: 0,
        parentId: "law",
        courses: [mkCourse("c3")],
        children: [
          {
            id: "commercial",
            name: "Commercial Property",
            description: null,
            order: 0,
            parentId: "property",
            courses: [mkCourse("c4")],
            children: [],
          },
        ],
      },
    ],
  },
  {
    id: "it",
    name: "IT Courses",
    description: null,
    order: 1,
    parentId: null,
    courses: [mkCourse("c5")],
    children: [],
  },
];

describe("getDescendantCourseIds", () => {
  it("returns all courses under a root node", () => {
    const ids = getDescendantCourseIds(tree, "law");
    expect(ids.sort()).toEqual(["c1", "c2", "c3", "c4"]);
  });

  it("returns courses under a mid-level node", () => {
    const ids = getDescendantCourseIds(tree, "property");
    expect(ids.sort()).toEqual(["c3", "c4"]);
  });

  it("returns courses under a leaf node", () => {
    const ids = getDescendantCourseIds(tree, "commercial");
    expect(ids).toEqual(["c4"]);
  });

  it("returns empty array for non-existent node", () => {
    const ids = getDescendantCourseIds(tree, "nonexistent");
    expect(ids).toEqual([]);
  });
});

describe("getDescendantCourseIdsForNodes", () => {
  it("collects courses from multiple disjoint nodes", () => {
    const ids = getDescendantCourseIdsForNodes(tree, ["law", "it"]);
    expect(ids.sort()).toEqual(["c1", "c2", "c3", "c4", "c5"]);
  });

  it("deduplicates overlapping nodes", () => {
    const ids = getDescendantCourseIdsForNodes(tree, ["law", "property"]);
    // property is a subset of law — no duplicates
    expect(ids.sort()).toEqual(["c1", "c2", "c3", "c4"]);
  });
});

describe("flattenTree", () => {
  it("returns all nodes in depth-first order", () => {
    const flat = flattenTree(tree);
    expect(flat.map((n) => n.id)).toEqual(["law", "property", "commercial", "it"]);
  });

  it("returns correct number of items", () => {
    const flat = flattenTree(tree);
    expect(flat).toHaveLength(4);
  });

  it("items do not have children property", () => {
    const flat = flattenTree(tree);
    for (const item of flat) {
      expect(item).not.toHaveProperty("children");
    }
  });
});

describe("countCoursesInSubtree", () => {
  it("counts all courses under a root node with nested children", () => {
    expect(countCoursesInSubtree(tree[0])).toBe(4);
  });

  it("counts courses for a leaf node", () => {
    const leaf = tree[0].children[0].children[0]; // commercial
    expect(countCoursesInSubtree(leaf)).toBe(1);
  });

  it("returns 0 for an empty node", () => {
    const empty: NodeWithChildren = {
      id: "empty",
      name: "Empty",
      description: null,
      order: 0,
      parentId: null,
      courses: [],
      children: [],
    };
    expect(countCoursesInSubtree(empty)).toBe(0);
  });
});
