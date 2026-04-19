import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { GET } = await import("@/app/api/user/achievements/route");

describe("GET /api/user/achievements", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns all achievements with unlockedAt null for locked ones", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1", role: "employee" }));
    mockPrisma.achievement.findMany.mockResolvedValue([
      {
        id: "a1",
        key: "first",
        title: "First",
        description: "Desc",
        icon: "\u{1F3C6}",
        xpReward: 10,
        category: "onboarding",
        threshold: 1,
      },
    ]);
    mockPrisma.userAchievement.findMany.mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual([
      {
        id: "a1",
        key: "first",
        title: "First",
        description: "Desc",
        icon: "\u{1F3C6}",
        xpReward: 10,
        category: "onboarding",
        unlockedAt: null,
      },
    ]);
  });

  it("includes unlockedAt as ISO string for earned achievements", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1", role: "employee" }));
    mockPrisma.achievement.findMany.mockResolvedValue([
      {
        id: "a1",
        key: "first",
        title: "First",
        description: "Desc",
        icon: "\u{1F3C6}",
        xpReward: 10,
        category: "onboarding",
        threshold: 1,
      },
    ]);
    mockPrisma.userAchievement.findMany.mockResolvedValue([
      { achievementId: "a1", unlockedAt: new Date("2026-01-01") },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body[0].unlockedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("returns empty array when no achievements defined", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1", role: "employee" }));
    mockPrisma.achievement.findMany.mockResolvedValue([]);
    mockPrisma.userAchievement.findMany.mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual([]);
  });
});
