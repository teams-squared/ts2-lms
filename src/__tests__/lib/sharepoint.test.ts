import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Graph client before sharepoint.ts is imported so the module-level
// warmSharePointCache() call doesn't hit a real network.
vi.mock("@/lib/graph-client", () => {
  const mockGet = vi.fn().mockResolvedValue({
    value: [],
    ok: true,
    text: async () => "[]",
  });
  const mockChain = {
    api: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    responseType: vi.fn().mockReturnThis(),
    get: mockGet,
  };
  return {
    getGraphClient: vi.fn(() => mockChain),
  };
});

import { getGraphClient } from "@/lib/graph-client";
import {
  clearCache,
  fetchCategoriesFromSharePoint,
  fetchDocListFromSharePoint,
  fetchDocContentFromSharePoint,
} from "@/lib/sharepoint";

type MockChain = Record<string, ReturnType<typeof vi.fn>>;

function getMockClient() {
  return vi.mocked(getGraphClient)() as unknown as MockChain;
}

function getMockGet() {
  return getMockClient().get;
}

beforeEach(() => {
  clearCache();
  vi.clearAllMocks();

  // Re-wire the chain after clearAllMocks
  const client = getMockClient();
  client.api.mockReturnThis();
  client.select.mockReturnThis();
  client.responseType.mockReturnThis();
});

// ── In-memory cache ────────────────────────────────────────────────────────
describe("withCache (via fetchCategoriesFromSharePoint)", () => {
  it("calls the fetcher on cache miss", async () => {
    getMockGet().mockResolvedValueOnce({ ok: true, text: async () => "[]" });
    await fetchCategoriesFromSharePoint();
    expect(getMockGet()).toHaveBeenCalledTimes(1);
  });

  it("returns cached value without calling fetcher again", async () => {
    getMockGet().mockResolvedValueOnce({ ok: true, text: async () => "[]" });
    await fetchCategoriesFromSharePoint();
    await fetchCategoriesFromSharePoint();
    expect(getMockGet()).toHaveBeenCalledTimes(1);
  });

  it("calls fetcher again after clearCache()", async () => {
    getMockGet()
      .mockResolvedValueOnce({ ok: true, text: async () => "[]" })
      .mockResolvedValueOnce({ ok: true, text: async () => "[]" });
    await fetchCategoriesFromSharePoint();
    clearCache();
    await fetchCategoriesFromSharePoint();
    expect(getMockGet()).toHaveBeenCalledTimes(2);
  });
});

// ── fetchDocListFromSharePoint ─────────────────────────────────────────────
describe("fetchDocListFromSharePoint", () => {
  it("returns only .mdx file names", async () => {
    getMockGet().mockResolvedValueOnce({
      value: [
        { name: "intro.mdx" },
        { name: "readme.txt" },
        { name: "guide.mdx" },
      ],
    });
    const files = await fetchDocListFromSharePoint("getting-started");
    expect(files).toEqual(["intro.mdx", "guide.mdx"]);
  });

  it("returns [] on 404 instead of throwing", async () => {
    getMockGet().mockRejectedValueOnce({ statusCode: 404, message: "Not Found" });
    const files = await fetchDocListFromSharePoint("parent-category");
    expect(files).toEqual([]);
  });

  it("re-throws non-404 errors", async () => {
    getMockGet().mockRejectedValueOnce({ statusCode: 500, message: "Server Error" });
    await expect(fetchDocListFromSharePoint("bad-category")).rejects.toMatchObject({
      statusCode: 500,
    });
  });
});

// ── fetchDocContentFromSharePoint ──────────────────────────────────────────
describe("fetchDocContentFromSharePoint", () => {
  it("returns the raw text content", async () => {
    getMockGet().mockResolvedValueOnce({
      ok: true,
      text: async () => "# Hello World\nSome content.",
    });
    const content = await fetchDocContentFromSharePoint("getting-started", "intro.mdx");
    expect(content).toBe("# Hello World\nSome content.");
  });

  it("throws when response is not ok", async () => {
    getMockGet().mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => "",
    });
    await expect(
      fetchDocContentFromSharePoint("getting-started", "secret.mdx")
    ).rejects.toThrow("403");
  });
});
