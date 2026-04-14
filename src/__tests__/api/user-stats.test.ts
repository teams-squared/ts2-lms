import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { GET } = await import("@/app/api/user/stats/route");

describe("GET /api/user/stats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns default values when no stats record exists", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1", role: "employee" }));
    mockPrisma.userStats.findUnique.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({
      xp: 0,
      streak: 0,
      level: 1,
      currentXp: 0,
      nextLevelXp: 100,
      lastActivityDate: null,
    });
  });

  it("returns computed level info from XP", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1", role: "employee" }));
    mockPrisma.userStats.findUnique.mockResolvedValue({
      xp: 350,
      streak: 5,
      lastActivityDate: new Date("2026-01-15"),
    });

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({
      xp: 350,
      streak: 5,
      level: 3,
      currentXp: 50,
      nextLevelXp: 300,
      lastActivityDate: "2026-01-15T00:00:00.000Z",
    });
  });
});
