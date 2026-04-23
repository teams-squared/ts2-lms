import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { mockSignOut, mockReset } = vi.hoisted(() => ({
  mockSignOut: vi.fn(),
  mockReset: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  signOut: mockSignOut,
}));

vi.mock("posthog-js", () => ({
  default: {
    get __loaded() {
      return true;
    },
    reset: mockReset,
  },
}));

import { useSignOut } from "@/hooks/useSignOut";

describe("useSignOut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls posthog.reset before next-auth signOut", async () => {
    mockSignOut.mockResolvedValue(undefined);
    const { result } = renderHook(() => useSignOut());

    await act(async () => {
      await result.current({ callbackUrl: "/login" });
    });

    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: "/login" });

    const resetOrder = mockReset.mock.invocationCallOrder[0];
    const signOutOrder = mockSignOut.mock.invocationCallOrder[0];
    expect(resetOrder).toBeLessThan(signOutOrder);
  });
});
