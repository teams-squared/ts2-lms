import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  GRAPH_BASE_URL,
  METADATA_CACHE_TTL_MS,
  ALLOWED_MIME_TYPES,
  getSharePointConfig,
  getTokenUrl,
  assertConfigured,
} from "@/lib/sharepoint/config";

const ENV_KEYS = [
  "AZURE_AD_TENANT_ID",
  "AZURE_AD_CLIENT_ID",
  "AZURE_AD_CLIENT_SECRET",
  "SHAREPOINT_SITE_URL",
  "SHAREPOINT_ROOT_FOLDER",
] as const;

const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
});

describe("constants", () => {
  it("GRAPH_BASE_URL points at the v1.0 Microsoft Graph endpoint", () => {
    expect(GRAPH_BASE_URL).toBe("https://graph.microsoft.com/v1.0");
  });

  it("metadata cache TTL is 15 minutes", () => {
    expect(METADATA_CACHE_TTL_MS).toBe(15 * 60 * 1000);
  });

  it("ALLOWED_MIME_TYPES gates exactly the office + plain-text + common image set", () => {
    expect(ALLOWED_MIME_TYPES.has("application/pdf")).toBe(true);
    expect(ALLOWED_MIME_TYPES.has("image/png")).toBe(true);
    expect(ALLOWED_MIME_TYPES.has("application/zip")).toBe(false);
    expect(ALLOWED_MIME_TYPES.has("application/x-msdownload")).toBe(false);
    expect(ALLOWED_MIME_TYPES.size).toBe(12);
  });
});

describe("getSharePointConfig", () => {
  it("falls back to safe defaults when env is unset", () => {
    const cfg = getSharePointConfig();
    expect(cfg.tenantId).toBe("");
    expect(cfg.clientId).toBe("");
    expect(cfg.clientSecret).toBe("");
    expect(cfg.siteUrl).toBe("teamssquared.sharepoint.com/sites/cybersecurity");
    expect(cfg.rootFolder).toBe("LMS Materials");
  });

  it("reads every key from process.env when set", () => {
    process.env.AZURE_AD_TENANT_ID = "tenant-x";
    process.env.AZURE_AD_CLIENT_ID = "client-x";
    process.env.AZURE_AD_CLIENT_SECRET = "secret-x";
    process.env.SHAREPOINT_SITE_URL = "tenant.sharepoint.com/sites/lms";
    process.env.SHAREPOINT_ROOT_FOLDER = "Compliance";

    const cfg = getSharePointConfig();
    expect(cfg).toEqual({
      tenantId: "tenant-x",
      clientId: "client-x",
      clientSecret: "secret-x",
      siteUrl: "tenant.sharepoint.com/sites/lms",
      rootFolder: "Compliance",
    });
  });
});

describe("getTokenUrl", () => {
  it("interpolates the tenant id into the v2 token endpoint", () => {
    expect(getTokenUrl("tenant-abc")).toBe(
      "https://login.microsoftonline.com/tenant-abc/oauth2/v2.0/token",
    );
  });
});

describe("assertConfigured", () => {
  it("throws when tenantId is missing", () => {
    process.env.AZURE_AD_CLIENT_ID = "c";
    process.env.AZURE_AD_CLIENT_SECRET = "s";
    expect(() => assertConfigured()).toThrow(/AZURE_AD_TENANT_ID/);
  });

  it("throws when clientId is missing", () => {
    process.env.AZURE_AD_TENANT_ID = "t";
    process.env.AZURE_AD_CLIENT_SECRET = "s";
    expect(() => assertConfigured()).toThrow(/AZURE_AD_CLIENT_ID/);
  });

  it("throws when clientSecret is missing", () => {
    process.env.AZURE_AD_TENANT_ID = "t";
    process.env.AZURE_AD_CLIENT_ID = "c";
    expect(() => assertConfigured()).toThrow(/AZURE_AD_CLIENT_SECRET/);
  });

  it("does not throw when all three creds are set", () => {
    process.env.AZURE_AD_TENANT_ID = "t";
    process.env.AZURE_AD_CLIENT_ID = "c";
    process.env.AZURE_AD_CLIENT_SECRET = "s";
    expect(() => assertConfigured()).not.toThrow();
  });
});
