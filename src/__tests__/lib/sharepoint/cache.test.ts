import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "@/__tests__/mocks/prisma";

vi.mock("@/lib/prisma", () => ({ default: mockPrisma, prisma: mockPrisma }));

import {
  getCachedMetadata,
  setCachedMetadata,
  cleanExpiredMetadata,
} from "@/lib/sharepoint/cache";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCachedMetadata", () => {
  it("returns data when cache entry is valid", async () => {
    mockPrisma.sharePointCache.findUnique.mockResolvedValueOnce({
      cacheKey: "test-key",
      data: JSON.stringify({ items: [1, 2, 3] }),
      etag: "etag-1",
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await getCachedMetadata<{ items: number[] }>("test-key");

    expect(result).not.toBeNull();
    expect(result!.data.items).toEqual([1, 2, 3]);
    expect(result!.etag).toBe("etag-1");
  });

  it("returns null when cache entry is expired", async () => {
    mockPrisma.sharePointCache.findUnique.mockResolvedValueOnce({
      cacheKey: "test-key",
      data: JSON.stringify({ items: [] }),
      etag: null,
      expiresAt: new Date(Date.now() - 1000),
    });

    const result = await getCachedMetadata("test-key");

    expect(result).toBeNull();
  });

  it("returns null when no entry exists", async () => {
    mockPrisma.sharePointCache.findUnique.mockResolvedValueOnce(null);

    const result = await getCachedMetadata("missing-key");

    expect(result).toBeNull();
  });
});

describe("setCachedMetadata", () => {
  it("upserts cache entry with correct TTL", async () => {
    mockPrisma.sharePointCache.upsert.mockResolvedValueOnce({});

    await setCachedMetadata("key-1", { hello: "world" }, "etag-2");

    expect(mockPrisma.sharePointCache.upsert).toHaveBeenCalledOnce();
    const call = mockPrisma.sharePointCache.upsert.mock.calls[0][0];
    expect(call.where.cacheKey).toBe("key-1");
    expect(call.create.data).toBe(JSON.stringify({ hello: "world" }));
    expect(call.create.etag).toBe("etag-2");
    expect(call.create.expiresAt).toBeInstanceOf(Date);
    // TTL should be ~15 minutes from now
    const ttlMs = call.create.expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(14 * 60 * 1000);
    expect(ttlMs).toBeLessThan(16 * 60 * 1000);
  });
});

describe("cleanExpiredMetadata", () => {
  it("deletes expired entries and returns count", async () => {
    mockPrisma.sharePointCache.deleteMany.mockResolvedValueOnce({ count: 5 });

    const count = await cleanExpiredMetadata();

    expect(count).toBe(5);
    expect(mockPrisma.sharePointCache.deleteMany).toHaveBeenCalledOnce();
    const call = mockPrisma.sharePointCache.deleteMany.mock.calls[0][0];
    expect(call.where.expiresAt.lt).toBeInstanceOf(Date);
  });
});
