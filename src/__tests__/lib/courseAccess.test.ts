import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { canManageCourse, canViewCourse } = await import("@/lib/courseAccess");

describe("canManageCourse", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true for admin", async () => {
    const result = await canManageCourse("user-1", "admin", "course-1");
    expect(result).toBe(true);
  });

  it("returns true for course_manager regardless of course creator", async () => {
    const result = await canManageCourse("user-2", "course_manager", "course-1");
    expect(result).toBe(true);
  });

  it("returns false for employee", async () => {
    const result = await canManageCourse("user-4", "employee", "course-1");
    expect(result).toBe(false);
  });
});

describe("canViewCourse", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true for admin", async () => {
    const result = await canViewCourse("user-1", "admin", "course-1");
    expect(result).toBe(true);
  });

  it("returns true for course_manager", async () => {
    const result = await canViewCourse("user-2", "course_manager", "course-1");
    expect(result).toBe(true);
  });

  it("returns false for employee", async () => {
    const result = await canViewCourse("user-4", "employee", "course-1");
    expect(result).toBe(false);
  });
});
