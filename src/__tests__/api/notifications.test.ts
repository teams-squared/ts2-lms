import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { GET, PATCH } = await import("@/app/api/notifications/route");

describe("GET /api/notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns notifications and unread count", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1", role: "employee" }));
    mockPrisma.notification.findMany.mockResolvedValue([
      { id: "n1", message: "Test", read: false },
    ]);
    mockPrisma.notification.count.mockResolvedValue(2);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({
      notifications: [{ id: "n1", message: "Test", read: false }],
      unreadCount: 2,
    });
  });

  it("returns empty list when no notifications", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1", role: "employee" }));
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockPrisma.notification.count.mockResolvedValue(0);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ notifications: [], unreadCount: 0 });
  });
});

describe("PATCH /api/notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH();
    expect(res.status).toBe(401);
  });

  it("marks all unread notifications as read", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1", role: "employee" }));
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 3 });

    const res = await PATCH();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ success: true });

    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", read: false },
      data: { read: true },
    });
  });
});
