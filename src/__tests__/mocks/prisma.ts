import { vi } from "vitest";

export const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
  },
};
