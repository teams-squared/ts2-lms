import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

// Import after mock is registered
const { getUserRole } = await import("@/lib/roles");

describe("getUserRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns mapped role when user found in DB", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: "ADMIN" });
    const role = await getUserRole("admin@teamssquared.com");
    expect(role).toBe("admin");
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "admin@teamssquared.com" },
      select: { role: true },
    });
  });

  it("returns 'employee' when user not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const role = await getUserRole("unknown@example.com");
    expect(role).toBe("employee");
  });

  it("returns 'manager' for MANAGER role", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: "MANAGER" });
    const role = await getUserRole("manager@teamssquared.com");
    expect(role).toBe("manager");
  });
});
