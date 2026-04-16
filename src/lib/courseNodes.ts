import { prisma } from "@/lib/prisma";

/** Shape returned by getNodeTree — recursive node with children and courses */
export interface NodeWithChildren {
  id: string;
  name: string;
  description: string | null;
  order: number;
  parentId: string | null;
  children: NodeWithChildren[];
  courses: { id: string; title: string; status: string }[];
}

/**
 * Fetch the full course-node tree (up to 4 levels deep).
 * Returns root-level nodes with nested children and their published courses.
 */
export async function getNodeTree(opts?: {
  publishedOnly?: boolean;
}): Promise<NodeWithChildren[]> {
  const courseWhere = opts?.publishedOnly ? { status: "PUBLISHED" as const } : {};
  const courseSelect = { id: true, title: true, status: true };

  const roots = await prisma.courseNode.findMany({
    where: { parentId: null },
    orderBy: { order: "asc" },
    include: {
      courses: { where: courseWhere, select: courseSelect, orderBy: { title: "asc" } },
      children: {
        orderBy: { order: "asc" },
        include: {
          courses: { where: courseWhere, select: courseSelect, orderBy: { title: "asc" } },
          children: {
            orderBy: { order: "asc" },
            include: {
              courses: { where: courseWhere, select: courseSelect, orderBy: { title: "asc" } },
              children: {
                orderBy: { order: "asc" },
                include: {
                  courses: { where: courseWhere, select: courseSelect, orderBy: { title: "asc" } },
                },
              },
            },
          },
        },
      },
    },
  });

  // Normalize Prisma's typed result into our recursive interface
  return roots.map(normalize);
}

/** Recursively normalize a Prisma node (with up to 4 levels) into NodeWithChildren */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(node: any): NodeWithChildren {
  return {
    id: node.id,
    name: node.name,
    description: node.description,
    order: node.order,
    parentId: node.parentId,
    courses: node.courses ?? [],
    children: (node.children ?? []).map(normalize),
  };
}

/**
 * Recursively collect all course IDs under a node subtree.
 * Works on an in-memory tree (call getNodeTree first).
 */
export function getDescendantCourseIds(
  nodes: NodeWithChildren[],
  targetNodeId: string,
): string[] {
  const ids: string[] = [];

  function walk(node: NodeWithChildren) {
    for (const c of node.courses) ids.push(c.id);
    for (const child of node.children) walk(child);
  }

  function find(nodeList: NodeWithChildren[]): boolean {
    for (const n of nodeList) {
      if (n.id === targetNodeId) {
        walk(n);
        return true;
      }
      if (find(n.children)) return true;
    }
    return false;
  }

  find(nodes);
  return ids;
}

/**
 * Get all descendant course IDs for a set of node IDs.
 * Useful for catalog filtering.
 */
export function getDescendantCourseIdsForNodes(
  tree: NodeWithChildren[],
  nodeIds: string[],
): string[] {
  const all = new Set<string>();
  for (const nid of nodeIds) {
    for (const cid of getDescendantCourseIds(tree, nid)) {
      all.add(cid);
    }
  }
  return Array.from(all);
}

/** Flatten a tree into a flat array of nodes (without children nesting) */
export function flattenTree(
  nodes: NodeWithChildren[],
): Omit<NodeWithChildren, "children">[] {
  const result: Omit<NodeWithChildren, "children">[] = [];
  function walk(list: NodeWithChildren[]) {
    for (const n of list) {
      result.push({
        id: n.id,
        name: n.name,
        description: n.description,
        order: n.order,
        parentId: n.parentId,
        courses: n.courses,
      });
      walk(n.children);
    }
  }
  walk(nodes);
  return result;
}

/** Count total courses under a node (including descendants) */
export function countCoursesInSubtree(node: NodeWithChildren): number {
  let count = node.courses.length;
  for (const child of node.children) {
    count += countCoursesInSubtree(child);
  }
  return count;
}
