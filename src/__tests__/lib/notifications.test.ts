import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { createNotificationsForCourse } = await import("@/lib/notifications");

describe("createNotificationsForCourse", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does nothing when no enrollments exist", async () => {
    mockPrisma.enrollment.findMany.mockResolvedValue([]);
    await createNotificationsForCourse("c1", "course_published", "Course is live");
    expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
  });

  it("creates one notification per enrolled user", async () => {
    mockPrisma.enrollment.findMany.mockResolvedValue([
      { userId: "u1" },
      { userId: "u2" },
    ]);
    mockPrisma.notification.createMany.mockResolvedValue({ count: 2 });

    await createNotificationsForCourse("c1", "course_published", "Course is live");

    expect(mockPrisma.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          { userId: "u1", type: "course_published", message: "Course is live", courseId: "c1" },
          { userId: "u2", type: "course_published", message: "Course is live", courseId: "c1" },
        ],
        skipDuplicates: true,
      })
    );
  });

  it("passes the correct type and message", async () => {
    mockPrisma.enrollment.findMany.mockResolvedValue([{ userId: "u1" }]);
    mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });

    await createNotificationsForCourse("c2", "new_lesson", "New lesson added");

    const call = mockPrisma.notification.createMany.mock.calls[0][0];
    expect(call.data[0].type).toBe("new_lesson");
    expect(call.data[0].message).toBe("New lesson added");
  });
});
