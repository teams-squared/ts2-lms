import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Graph client before sharepoint.ts is imported so the module-level
// warmSharePointCache() call doesn't hit a real network.
vi.mock("@/lib/graph-client", () => {
  const mockGet = vi.fn().mockResolvedValue({
    value: [],
    ok: true,
    text: async () => "[]",
  });
  const mockPut = vi.fn().mockResolvedValue({ ok: true });
  const mockChain = {
    api: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    responseType: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
    get: mockGet,
    put: mockPut,
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
  writeDocContentToSharePoint,
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
  client.header.mockReturnThis();
  client.put.mockResolvedValue({ ok: true });
  client.get.mockResolvedValue({ value: [], ok: true, text: async () => "[]" });
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

// ── writeDocContentToSharePoint ────────────────────────────────────────────
describe("writeDocContentToSharePoint", () => {
  it("calls Graph API PUT with the correct path", async () => {
    const client = getMockClient();
    await writeDocContentToSharePoint("engineering", "setup.mdx", "# Setup");
    expect(client.api).toHaveBeenCalledWith(
      expect.stringContaining("engineering/setup.mdx:/content")
    );
    expect(client.put).toHaveBeenCalledTimes(1);
  });

  it("sends a Buffer body (not a raw string)", async () => {
    const client = getMockClient();
    const content = "---\ntitle: Test\n---\n\nBody.";
    await writeDocContentToSharePoint("engineering", "setup.mdx", content);
    const [body] = client.put.mock.calls[0] as [unknown];
    expect(Buffer.isBuffer(body)).toBe(true);
    expect((body as Buffer).toString("utf-8")).toBe(content);
  });

  it("sets Content-Type: text/plain header", async () => {
    const client = getMockClient();
    await writeDocContentToSharePoint("engineering", "setup.mdx", "content");
    expect(client.header).toHaveBeenCalledWith("Content-Type", "text/plain");
  });

  it("clears the entire cache after a successful write", async () => {
    // Warm the cache with one categories fetch
    getMockClient().get
      .mockResolvedValueOnce({ ok: true, text: async () => "[]" }) // categories fetch
      .mockResolvedValueOnce({ ok: true, text: async () => "[]" }); // post-write fetch

    await fetchCategoriesFromSharePoint(); // populates cache
    await writeDocContentToSharePoint("engineering", "setup.mdx", "content"); // clears cache
    await fetchCategoriesFromSharePoint(); // should call fetcher again

    // get should have been called twice (once before write, once after)
    expect(getMockClient().get).toHaveBeenCalledTimes(2);
  });

  it("throws a descriptive error when the Graph API returns non-ok", async () => {
    getMockClient().put.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    });
    await expect(
      writeDocContentToSharePoint("engineering", "setup.mdx", "content")
    ).rejects.toThrow("403");
  });
});
