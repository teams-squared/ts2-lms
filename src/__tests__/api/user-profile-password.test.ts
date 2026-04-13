import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

// Mock bcryptjs so tests don't do real hashing
vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
  compare: vi.fn(),
  hash: vi.fn(),
}));

import bcrypt from "bcryptjs";
const mockCompare = vi.mocked(bcrypt.compare);
const mockHash = vi.mocked(bcrypt.hash);

const { PATCH } = await import("@/app/api/user/profile/password/route");

const makeReq = (body: Record<string, unknown>) =>
  new Request("http://localhost/api/user/profile/password", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("PATCH /api/user/profile/password", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(makeReq({ currentPassword: "old", newPassword: "newpass1" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when fields are missing", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "u1" }));
    const res = await PATCH(makeReq({ currentPassword: "old" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it("returns 400 when new password is too short", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "u1" }));
    const res = await PATCH(makeReq({ currentPassword: "old", newPassword: "short" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/8 characters/i);
  });

  it("returns 400 for SSO-only users (no passwordHash)", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "u1" }));
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u1",
      passwordHash: null,
    });
    const res = await PATCH(makeReq({ currentPassword: "old", newPassword: "newpass1" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/SSO/i);
  });

  it("returns 400 when current password is incorrect", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "u1" }));
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u1",
      passwordHash: "$hashed",
    });
    mockCompare.mockResolvedValue(false as never);
    const res = await PATCH(makeReq({ currentPassword: "wrong", newPassword: "newpass123" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/incorrect/i);
  });

  it("returns 200 and updates password when current password is correct", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "u1" }));
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u1",
      passwordHash: "$hashed",
    });
    mockCompare.mockResolvedValue(true as never);
    mockHash.mockResolvedValue("$newhashed" as never);
    mockPrisma.user.update.mockResolvedValue({ id: "u1" });

    const res = await PATCH(makeReq({ currentPassword: "correct", newPassword: "newpass123" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { passwordHash: "$newhashed" },
      }),
    );
  });
});
