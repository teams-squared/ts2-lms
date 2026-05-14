import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "@/__tests__/mocks/prisma";

vi.mock("@/lib/prisma", () => ({ default: mockPrisma, prisma: mockPrisma }));

// Mock node:fs/promises so the filesystem-cache layer can be exercised
// without touching real disk. Mock factory is hoisted, so the vi.fn()
// instances are created inline and re-imported below for assertions.
vi.mock("node:fs/promises", () => {
  const fns = {
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn(),
    rm: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn(),
  };
  return { ...fns, default: fns };
});

import {
  getCachedFile,
  setCachedFile,
  cleanExpiredFiles,
  fileCacheExists,
  setCachedMetadata,
  extendCacheTTL,
} from "@/lib/sharepoint/cache";
import * as fs from "node:fs/promises";

const fsMock = fs as unknown as {
  mkdir: ReturnType<typeof vi.fn>;
  readFile: ReturnType<typeof vi.fn>;
  writeFile: ReturnType<typeof vi.fn>;
  rename: ReturnType<typeof vi.fn>;
  readdir: ReturnType<typeof vi.fn>;
  rm: ReturnType<typeof vi.fn>;
  stat: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  // Sensible defaults; individual tests override.
  fsMock.mkdir.mockResolvedValue(undefined);
  fsMock.writeFile.mockResolvedValue(undefined);
  fsMock.rename.mockResolvedValue(undefined);
  fsMock.rm.mockResolvedValue(undefined);
});

describe("getCachedFile", () => {
  it("returns null when meta file does not exist", async () => {
    fsMock.readFile.mockRejectedValueOnce(new Error("ENOENT"));

    const result = await getCachedFile("drive-1", "item-1");
    expect(result).toBeNull();
  });

  it("returns null when cached file is expired", async () => {
    fsMock.readFile.mockResolvedValueOnce(
      JSON.stringify({
        etag: "etag-1",
        mimeType: "application/pdf",
        fileName: "x.pdf",
        expiresAt: Date.now() - 1000,
      }),
    );

    const result = await getCachedFile("drive-1", "item-1");
    expect(result).toBeNull();
    // Should not have attempted to read the binary on expiry.
    expect(fsMock.readFile).toHaveBeenCalledTimes(1);
  });

  it("returns data + meta when cache is valid", async () => {
    const meta = {
      etag: "etag-1",
      mimeType: "application/pdf",
      fileName: "report.pdf",
      expiresAt: Date.now() + 60_000,
    };
    fsMock.readFile
      .mockResolvedValueOnce(JSON.stringify(meta))
      .mockResolvedValueOnce(Buffer.from("pdf-bytes"));

    const result = await getCachedFile("drive-1", "item-1");

    expect(result).not.toBeNull();
    expect(result!.meta.fileName).toBe("report.pdf");
    expect(result!.data.toString()).toBe("pdf-bytes");
  });

  it("returns null when binary read fails after a valid meta read", async () => {
    fsMock.readFile
      .mockResolvedValueOnce(
        JSON.stringify({
          etag: null,
          mimeType: "application/pdf",
          fileName: "x.pdf",
          expiresAt: Date.now() + 60_000,
        }),
      )
      .mockRejectedValueOnce(new Error("EIO"));

    const result = await getCachedFile("drive-1", "item-1");
    expect(result).toBeNull();
  });

  it("uses variant in the cache key so PDF and DOCX of the same item don't collide", async () => {
    fsMock.readFile.mockRejectedValueOnce(new Error("ENOENT"));
    await getCachedFile("drive-1", "item-1", "pdf");
    const pathArgPdf = fsMock.readFile.mock.calls[0][0] as string;

    fsMock.readFile.mockRejectedValueOnce(new Error("ENOENT"));
    await getCachedFile("drive-1", "item-1");
    const pathArgPlain = fsMock.readFile.mock.calls[1][0] as string;

    expect(pathArgPdf).not.toBe(pathArgPlain);
  });
});

describe("setCachedFile", () => {
  it("writes tmp files, then renames atomically", async () => {
    await setCachedFile(
      "drive-1",
      "item-1",
      Buffer.from("content"),
      { etag: "e1", mimeType: "application/pdf", fileName: "x.pdf" },
    );

    expect(fsMock.mkdir).toHaveBeenCalledOnce();
    expect(fsMock.writeFile).toHaveBeenCalledTimes(2);
    expect(fsMock.rename).toHaveBeenCalledTimes(2);
    // Both rename targets should NOT end with `.tmp` (the final paths).
    const renameTargets = fsMock.rename.mock.calls.map((c) => c[1] as string);
    expect(renameTargets.every((t) => !t.endsWith(".tmp"))).toBe(true);
  });

  it("serialises meta with expiresAt that's ~15 min in the future", async () => {
    await setCachedFile(
      "drive-1",
      "item-1",
      Buffer.from("x"),
      { etag: null, mimeType: "text/plain", fileName: "f.txt" },
    );

    // Second writeFile call is the meta JSON.
    const metaJson = fsMock.writeFile.mock.calls[1][1] as string;
    const meta = JSON.parse(metaJson) as { expiresAt: number };
    const delta = meta.expiresAt - Date.now();
    expect(delta).toBeGreaterThan(14 * 60_000);
    expect(delta).toBeLessThan(16 * 60_000);
  });
});

describe("cleanExpiredFiles", () => {
  it("returns 0 when cache dir doesn't exist", async () => {
    fsMock.readdir.mockRejectedValueOnce(new Error("ENOENT"));
    const count = await cleanExpiredFiles();
    expect(count).toBe(0);
  });

  it("only removes entries past expiresAt and counts them", async () => {
    fsMock.readdir.mockResolvedValueOnce([
      "aaa.meta.json",
      "bbb.meta.json",
      "ccc.bin", // ignored — not a meta file
    ]);
    fsMock.readFile
      .mockResolvedValueOnce(
        JSON.stringify({
          etag: null,
          mimeType: "x",
          fileName: "x",
          expiresAt: Date.now() - 1000, // expired
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          etag: null,
          mimeType: "x",
          fileName: "x",
          expiresAt: Date.now() + 60_000, // fresh
        }),
      );

    const count = await cleanExpiredFiles();
    expect(count).toBe(1);
    // Two rm() calls per removed entry (meta + bin).
    expect(fsMock.rm).toHaveBeenCalledTimes(2);
  });

  it("skips malformed meta JSON entries silently", async () => {
    fsMock.readdir.mockResolvedValueOnce(["bad.meta.json"]);
    fsMock.readFile.mockResolvedValueOnce("not-json{{");

    const count = await cleanExpiredFiles();
    expect(count).toBe(0);
    expect(fsMock.rm).not.toHaveBeenCalled();
  });
});

describe("fileCacheExists", () => {
  it("returns true when meta file is present", async () => {
    fsMock.stat.mockResolvedValueOnce({ isFile: () => true });
    const result = await fileCacheExists("drive-1", "item-1");
    expect(result).toBe(true);
  });

  it("returns false when stat throws (missing)", async () => {
    fsMock.stat.mockRejectedValueOnce(new Error("ENOENT"));
    const result = await fileCacheExists("drive-1", "item-1");
    expect(result).toBe(false);
  });
});

describe("setCachedMetadata: etag-null branch", () => {
  it("persists etag: null when no etag is supplied", async () => {
    mockPrisma.sharePointCache.upsert.mockResolvedValueOnce({});
    await setCachedMetadata("key-1", { a: 1 });
    const call = mockPrisma.sharePointCache.upsert.mock.calls[0][0];
    expect(call.create.etag).toBeNull();
    expect(call.update.etag).toBeNull();
  });
});

describe("extendCacheTTL", () => {
  it("updates only the expiresAt field, ~15min ahead", async () => {
    mockPrisma.sharePointCache.update = vi.fn().mockResolvedValue({});
    await extendCacheTTL("key-1");
    expect(mockPrisma.sharePointCache.update).toHaveBeenCalledOnce();
    const call = mockPrisma.sharePointCache.update.mock.calls[0][0];
    expect(call.where.cacheKey).toBe("key-1");
    const ttlMs = call.data.expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(14 * 60_000);
    expect(ttlMs).toBeLessThan(16 * 60_000);
  });
});
