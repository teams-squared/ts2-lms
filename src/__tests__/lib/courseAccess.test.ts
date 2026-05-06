import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { canManageCourse, canViewCourse, listManagedCourseIds } = await import(
  "@/lib/courseAccess"
);

describe("canManageCourse", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true for admin without checking the relation", async () => {
    const result = await canManageCourse("user-1", "admin", "course-1");
    expect(result).toBe(true);
    expect(mockPrisma.course.findFirst).not.toHaveBeenCalled();
  });

  it("returns true for course_manager linked to the course", async () => {
    mockPrisma.course.findFirst.mockResolvedValueOnce({ id: "course-1" });
    const result = await canManageCourse("user-2", "course_manager", "course-1");
    expect(result).toBe(true);
    expect(mockPrisma.course.findFirst).toHaveBeenCalledWith({
      where: { id: "course-1", managers: { some: { id: "user-2" } } },
      select: { id: true },
    });
  });

  it("returns false for course_manager not linked to the course", async () => {
    mockPrisma.course.findFirst.mockResolvedValueOnce(null);
    const result = await canManageCourse("user-3", "course_manager", "course-1");
    expect(result).toBe(false);
  });

  it("returns false for employee", async () => {
    const result = await canManageCourse("user-4", "employee", "course-1");
    expect(result).toBe(false);
    expect(mockPrisma.course.findFirst).not.toHaveBeenCalled();
  });
});

describe("canViewCourse", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true for admin", async () => {
    const result = await canViewCourse("user-1", "admin", "course-1");
    expect(result).toBe(true);
  });

  it("returns true for course_manager linked to the course", async () => {
    mockPrisma.course.findFirst.mockResolvedValueOnce({ id: "course-1" });
    const result = await canViewCourse("user-2", "course_manager", "course-1");
    expect(result).toBe(true);
  });

  it("returns false for course_manager not linked to the course", async () => {
    mockPrisma.course.findFirst.mockResolvedValueOnce(null);
    const result = await canViewCourse("user-3", "course_manager", "course-1");
    expect(result).toBe(false);
  });

  it("returns false for employee", async () => {
    const result = await canViewCourse("user-4", "employee", "course-1");
    expect(result).toBe(false);
  });
});

describe("listManagedCourseIds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null for admin (sentinel meaning 'all')", async () => {
    const result = await listManagedCourseIds("user-1", "admin");
    expect(result).toBeNull();
    expect(mockPrisma.course.findMany).not.toHaveBeenCalled();
  });

  it("returns the linked course IDs for course_manager", async () => {
    mockPrisma.course.findMany.mockResolvedValueOnce([
      { id: "course-1" },
      { id: "course-2" },
    ]);
    const result = await listManagedCourseIds("user-2", "course_manager");
    expect(result).toEqual(["course-1", "course-2"]);
    expect(mockPrisma.course.findMany).toHaveBeenCalledWith({
      where: { managers: { some: { id: "user-2" } } },
      select: { id: true },
    });
  });

  it("returns empty array for employee", async () => {
    const result = await listManagedCourseIds("user-3", "employee");
    expect(result).toEqual([]);
    expect(mockPrisma.course.findMany).not.toHaveBeenCalled();
  });
});
