import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { canManageCourse, canViewCourse } = await import("@/lib/courseAccess");

describe("canManageCourse", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true for admin without DB lookup", async () => {
    const result = await canManageCourse("user-1", "admin", "course-1");
    expect(result).toBe(true);
    expect(mockPrisma.course.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.courseInstructor.findUnique).not.toHaveBeenCalled();
  });

  it("returns true for manager who created the course", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({ createdById: "user-2" });
    const result = await canManageCourse("user-2", "manager", "course-1");
    expect(result).toBe(true);
    expect(mockPrisma.course.findUnique).toHaveBeenCalledWith({
      where: { id: "course-1" },
      select: { createdById: true },
    });
  });

  it("returns false for manager who did not create the course", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({ createdById: "other-user" });
    const result = await canManageCourse("user-2", "manager", "course-1");
    expect(result).toBe(false);
  });

  it("returns false for manager when course not found", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(null);
    const result = await canManageCourse("user-2", "manager", "course-1");
    expect(result).toBe(false);
  });

  it("returns true for instructor assigned to the course", async () => {
    mockPrisma.courseInstructor.findUnique.mockResolvedValue({
      courseId: "course-1",
      userId: "user-3",
    });
    const result = await canManageCourse("user-3", "instructor", "course-1");
    expect(result).toBe(true);
    expect(mockPrisma.courseInstructor.findUnique).toHaveBeenCalledWith({
      where: { courseId_userId: { courseId: "course-1", userId: "user-3" } },
    });
  });

  it("returns false for instructor not assigned to the course", async () => {
    mockPrisma.courseInstructor.findUnique.mockResolvedValue(null);
    const result = await canManageCourse("user-3", "instructor", "course-1");
    expect(result).toBe(false);
  });

  it("returns false for employee", async () => {
    const result = await canManageCourse("user-4", "employee", "course-1");
    expect(result).toBe(false);
    expect(mockPrisma.course.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.courseInstructor.findUnique).not.toHaveBeenCalled();
  });
});

describe("canViewCourse", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true for admin", async () => {
    const result = await canViewCourse("user-1", "admin", "course-1");
    expect(result).toBe(true);
  });

  it("returns true for manager who created the course", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({ createdById: "user-2" });
    const result = await canViewCourse("user-2", "manager", "course-1");
    expect(result).toBe(true);
  });

  it("returns false for manager who did not create the course", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({ createdById: "other-user" });
    const result = await canViewCourse("user-2", "manager", "course-1");
    expect(result).toBe(false);
  });

  it("returns true for instructor assigned to the course", async () => {
    mockPrisma.courseInstructor.findUnique.mockResolvedValue({
      courseId: "course-1",
      userId: "user-3",
    });
    const result = await canViewCourse("user-3", "instructor", "course-1");
    expect(result).toBe(true);
  });

  it("returns false for instructor not assigned to the course", async () => {
    mockPrisma.courseInstructor.findUnique.mockResolvedValue(null);
    const result = await canViewCourse("user-3", "instructor", "course-1");
    expect(result).toBe(false);
  });

  it("returns false for employee", async () => {
    const result = await canViewCourse("user-4", "employee", "course-1");
    expect(result).toBe(false);
  });
});
