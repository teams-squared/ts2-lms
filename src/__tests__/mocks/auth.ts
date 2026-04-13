import { vi } from "vitest";
import type { Role } from "@/lib/types";

interface MockSessionOverrides {
  id?: string;
  name?: string;
  email?: string;
  role?: Role;
}

export function mockSession(overrides: MockSessionOverrides = {}) {
  return {
    user: {
      id: overrides.id ?? "test-user-id",
      name: overrides.name ?? "Test User",
      email: overrides.email ?? "test@teamssquared.com",
      role: overrides.role ?? "employee",
    },
    expires: new Date(Date.now() + 86400_000).toISOString(),
  };
}

export const mockAuth = vi.fn();
