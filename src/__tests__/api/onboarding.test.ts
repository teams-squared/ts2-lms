import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { POST } = await import("@/app/api/user/onboarding/route");

describe("POST /api/user/onboarding", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("stamps onboardedAt only when still null (idempotent)", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "u1" }));
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST();
    expect(res.status).toBe(200);
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1", onboardedAt: null },
        data: expect.objectContaining({ onboardedAt: expect.any(Date) }),
      }),
    );
  });
});
