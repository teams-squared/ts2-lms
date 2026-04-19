import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock config before importing graph-client
vi.mock("@/lib/sharepoint/config", () => ({
  GRAPH_BASE_URL: "https://graph.microsoft.com/v1.0",
  getSharePointConfig: () => ({
    tenantId: "test-tenant",
    clientId: "test-client-id",
    clientSecret: "test-secret",
    siteUrl: "example.sharepoint.com/sites/test",
    rootFolder: "Documents",
  }),
  getTokenUrl: (tenantId: string) =>
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import {
  getAccessToken,
  getSiteId,
  listDriveItems,
  getDriveItemContent,
  getDriveItemMetadata,
  _resetTokenCache,
} from "@/lib/sharepoint/graph-client";

function tokenResponse(token: string, expiresIn = 3600) {
  return new Response(JSON.stringify({ access_token: token, expires_in: expiresIn }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetTokenCache();
});

describe("getAccessToken", () => {
  it("fetches a token from the token endpoint", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse("tok-1"));

    const token = await getAccessToken();

    expect(token).toBe("tok-1");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://login.microsoftonline.com/test-tenant/oauth2/v2.0/token");
    expect(options.method).toBe("POST");
  });

  it("returns cached token on subsequent calls", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse("tok-cached"));

    await getAccessToken();
    const second = await getAccessToken();

    expect(second).toBe("tok-cached");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("refreshes token when expired", async () => {
    // First token expires immediately (expiresIn = 0)
    fetchMock.mockResolvedValueOnce(tokenResponse("tok-old", 0));
    fetchMock.mockResolvedValueOnce(tokenResponse("tok-new", 3600));

    await getAccessToken();
    const second = await getAccessToken();

    expect(second).toBe("tok-new");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws on non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }));

    await expect(getAccessToken()).rejects.toThrow("Token request failed (401)");
  });
});

describe("getSiteId", () => {
  it("resolves a site URL to a site ID", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse("tok"));
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "site-123" }), { status: 200 })
    );

    const id = await getSiteId("example.sharepoint.com/sites/test");

    expect(id).toBe("site-123");
    const graphCall = fetchMock.mock.calls[1];
    expect(graphCall[0]).toBe(
      "https://graph.microsoft.com/v1.0/sites/example.sharepoint.com:/sites/test"
    );
  });
});

describe("listDriveItems", () => {
  it("lists root children when no folderId", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse("tok"));
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ value: [{ id: "item-1" }] }), { status: 200 })
    );

    const result = await listDriveItems("site-1", "drive-1");

    expect(result.value).toHaveLength(1);
    const graphCall = fetchMock.mock.calls[1];
    expect(graphCall[0]).toContain("/sites/site-1/drive/root/children");
  });

  it("lists folder children when folderId provided", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse("tok"));
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ value: [] }), { status: 200 })
    );

    await listDriveItems("site-1", "drive-1", "folder-99");

    const graphCall = fetchMock.mock.calls[1];
    expect(graphCall[0]).toContain("/drives/drive-1/items/folder-99/children");
  });
});

describe("getDriveItemContent", () => {
  it("returns the raw response for streaming", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse("tok"));
    fetchMock.mockResolvedValueOnce(
      new Response("file-bytes", { status: 200, headers: { "Content-Type": "application/pdf" } })
    );

    const res = await getDriveItemContent("drive-1", "item-1");

    expect(res.status).toBe(200);
    const graphCall = fetchMock.mock.calls[1];
    expect(graphCall[0]).toContain("/drives/drive-1/items/item-1/content");
  });
});

describe("getDriveItemMetadata", () => {
  it("returns item metadata with correct select params", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse("tok"));
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "item-1", name: "test.pdf" }), { status: 200 })
    );

    const meta = await getDriveItemMetadata("drive-1", "item-1");

    expect(meta.name).toBe("test.pdf");
    const graphCall = fetchMock.mock.calls[1];
    expect(graphCall[0]).toContain("/drives/drive-1/items/item-1");
    expect(graphCall[0]).toContain("$select=");
  });
});
