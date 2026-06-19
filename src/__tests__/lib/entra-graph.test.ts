import { describe, it, expect, vi, beforeEach } from "vitest";

// Env must be set before importing the module — it reads these at load time.
process.env.AZURE_AD_TENANT_ID = "tenant-1";
process.env.AZURE_AD_CLIENT_ID = "client-1";
process.env.AZURE_AD_CLIENT_SECRET = "secret-1";

const { lookupTenantUser, searchTenantUsers, isDirectoryLookupConfigured } =
  await import("@/lib/entra/graph");

const fetchSpy = vi.fn();
beforeEach(() => {
  fetchSpy.mockReset();
  // @ts-expect-error test global
  global.fetch = fetchSpy;
});

const tokenResponse = {
  ok: true,
  json: async () => ({ access_token: "tok", expires_in: 3600 }),
};

/** Route token requests to a token; graph requests to `userPayload`. */
function routeFetch(userResponse: { ok: boolean; json?: () => Promise<unknown>; status?: number }) {
  fetchSpy.mockImplementation((url: string) => {
    if (String(url).includes("/oauth2/")) return Promise.resolve(tokenResponse);
    return Promise.resolve(userResponse);
  });
}

describe("lookupTenantUser", () => {
  it("reports configured when env credentials are present", () => {
    expect(isDirectoryLookupConfigured()).toBe(true);
  });

  it("returns found with accountEnabled + displayName when Graph has a hit", async () => {
    routeFetch({
      ok: true,
      json: async () => ({
        value: [{ accountEnabled: true, displayName: "Akil Fernando" }],
      }),
    });
    const result = await lookupTenantUser("akil@teamsquared.io");
    expect(result).toEqual({
      status: "found",
      accountEnabled: true,
      displayName: "Akil Fernando",
    });
  });

  it("returns not_found when Graph returns an empty set", async () => {
    routeFetch({ ok: true, json: async () => ({ value: [] }) });
    const result = await lookupTenantUser("ghost@teamsquared.io");
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns unknown when Graph rejects (e.g. missing User.Read.All)", async () => {
    routeFetch({ ok: false, status: 403 });
    const result = await lookupTenantUser("akil@teamsquared.io");
    expect(result).toEqual({ status: "unknown" });
  });

  it("returns unknown for empty input without calling Graph", async () => {
    const result = await lookupTenantUser("   ");
    expect(result).toEqual({ status: "unknown" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("searchTenantUsers", () => {
  it("maps hits, prefers mail over UPN, and sorts by display name", async () => {
    routeFetch({
      ok: true,
      json: async () => ({
        value: [
          {
            mail: "akil.pereira@teamsquared.io",
            userPrincipalName: "akil.pereira@teamsquared.io",
            displayName: "Akil Pereira",
            accountEnabled: true,
          },
          {
            mail: null,
            userPrincipalName: "akil.fernando@teamsquared.io",
            displayName: "Akil Fernando",
            accountEnabled: false,
          },
        ],
      }),
    });
    const result = await searchTenantUsers("akil");
    expect(result).toEqual([
      {
        email: "akil.fernando@teamsquared.io",
        displayName: "Akil Fernando",
        accountEnabled: false,
      },
      {
        email: "akil.pereira@teamsquared.io",
        displayName: "Akil Pereira",
        accountEnabled: true,
      },
    ]);
  });

  it("returns [] for a too-short prefix without calling Graph", async () => {
    const result = await searchTenantUsers("a");
    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns [] when Graph rejects (fails open)", async () => {
    routeFetch({ ok: false, status: 403 });
    const result = await searchTenantUsers("akil");
    expect(result).toEqual([]);
  });

  it("drops entries with no usable email address", async () => {
    routeFetch({
      ok: true,
      json: async () => ({
        value: [{ mail: null, userPrincipalName: null, displayName: "No Mail" }],
      }),
    });
    const result = await searchTenantUsers("nomail");
    expect(result).toEqual([]);
  });
});
