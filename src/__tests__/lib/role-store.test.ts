import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock SharePoint so role-store never hits the real Graph API in tests.
// Default: SharePoint unavailable → local-file path is exercised.
// Individual tests can override these to test the SharePoint path.
// ---------------------------------------------------------------------------
vi.mock("@/lib/sharepoint", () => ({
  isSharePointAvailable: vi.fn(() => false),
  fetchRolesFromSharePoint: vi.fn(async () => null),
  writeRolesToSharePoint: vi.fn(async () => undefined),
}));

// Mock fs so role-store never touches the real filesystem.
// The module-level bootstrap (existsSync / copyFileSync) also runs on import,
// so we stub it out first.
vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(() => true),   // pretend file already exists → skip copy
    mkdirSync: vi.fn(),
    copyFileSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  copyFileSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

import fs from "fs";
import * as sharepoint from "@/lib/sharepoint";
import {
  getRoleConfig,
  setUserRole,
  removeUserRole,
  getAllElevatedUsers,
} from "@/lib/role-store";

const mockReadFileSync = vi.mocked(fs.readFileSync);
const mockWriteFileSync = vi.mocked(fs.writeFileSync);
const mockIsSharePointAvailable = vi.mocked(sharepoint.isSharePointAvailable);
const mockFetchRoles = vi.mocked(sharepoint.fetchRolesFromSharePoint);
const mockWriteRoles = vi.mocked(sharepoint.writeRolesToSharePoint);

function seedConfig(admins: string[] = [], managers: string[] = []) {
  const config = { admins, managers, defaultRole: "employee" };
  mockReadFileSync.mockReturnValue(JSON.stringify(config));
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: SharePoint not available → use local file
  mockIsSharePointAvailable.mockReturnValue(false);
  mockFetchRoles.mockResolvedValue(null);
  mockWriteRoles.mockResolvedValue(undefined);
  seedConfig();
});

// ── getRoleConfig ──────────────────────────────────────────────────────────
describe("getRoleConfig", () => {
  it("reads and parses the JSON file", async () => {
    seedConfig(["alice@example.com"], ["bob@example.com"]);
    const config = await getRoleConfig();
    expect(config.admins).toContain("alice@example.com");
    expect(config.managers).toContain("bob@example.com");
    expect(config.defaultRole).toBe("employee");
  });
});

// ── setUserRole ────────────────────────────────────────────────────────────
describe("setUserRole", () => {
  it("promotes to admin by adding to admins list", async () => {
    seedConfig([], []);
    await setUserRole("alice@example.com", "admin");
    const written = JSON.parse((mockWriteFileSync.mock.calls[0][1] as string).trim());
    expect(written.admins).toContain("alice@example.com");
    expect(written.managers).not.toContain("alice@example.com");
  });

  it("promotes to manager by adding to managers list", async () => {
    seedConfig([], []);
    await setUserRole("bob@example.com", "manager");
    const written = JSON.parse((mockWriteFileSync.mock.calls[0][1] as string).trim());
    expect(written.managers).toContain("bob@example.com");
    expect(written.admins).not.toContain("bob@example.com");
  });

  it("demotes to employee by removing from all lists", async () => {
    seedConfig(["alice@example.com"], []);
    await setUserRole("alice@example.com", "employee");
    const written = JSON.parse((mockWriteFileSync.mock.calls[0][1] as string).trim());
    expect(written.admins).not.toContain("alice@example.com");
    expect(written.managers).not.toContain("alice@example.com");
  });

  it("moves user from managers to admins on promotion", async () => {
    seedConfig([], ["alice@example.com"]);
    await setUserRole("alice@example.com", "admin");
    const written = JSON.parse((mockWriteFileSync.mock.calls[0][1] as string).trim());
    expect(written.admins).toContain("alice@example.com");
    expect(written.managers).not.toContain("alice@example.com");
  });
});

// ── removeUserRole ─────────────────────────────────────────────────────────
describe("removeUserRole", () => {
  it("removes admin from the admins list", async () => {
    seedConfig(["alice@example.com"], []);
    await removeUserRole("alice@example.com");
    const written = JSON.parse((mockWriteFileSync.mock.calls[0][1] as string).trim());
    expect(written.admins).not.toContain("alice@example.com");
  });

  it("removes manager from the managers list", async () => {
    seedConfig([], ["bob@example.com"]);
    await removeUserRole("bob@example.com");
    const written = JSON.parse((mockWriteFileSync.mock.calls[0][1] as string).trim());
    expect(written.managers).not.toContain("bob@example.com");
  });

  it("is a no-op for a user not in any list", async () => {
    seedConfig([], []);
    await removeUserRole("nobody@example.com");
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1); // still writes (harmless)
  });
});

// ── getAllElevatedUsers ────────────────────────────────────────────────────
describe("getAllElevatedUsers", () => {
  it("returns admins with admin role", async () => {
    seedConfig(["alice@example.com"], []);
    const users = await getAllElevatedUsers();
    expect(users).toContainEqual({ email: "alice@example.com", role: "admin" });
  });

  it("returns managers with manager role", async () => {
    seedConfig([], ["bob@example.com"]);
    const users = await getAllElevatedUsers();
    expect(users).toContainEqual({ email: "bob@example.com", role: "manager" });
  });

  it("returns empty array when no elevated users", async () => {
    seedConfig([], []);
    const users = await getAllElevatedUsers();
    expect(users).toHaveLength(0);
  });

  it("returns both admins and managers combined", async () => {
    seedConfig(["alice@example.com"], ["bob@example.com"]);
    const users = await getAllElevatedUsers();
    expect(users).toHaveLength(2);
  });
});

// ── SharePoint path ────────────────────────────────────────────────────────
describe("SharePoint integration", () => {
  const spConfig = {
    admins: ["sp-admin@example.com"],
    managers: ["sp-manager@example.com"],
    defaultRole: "employee",
  };

  beforeEach(() => {
    mockIsSharePointAvailable.mockReturnValue(true);
    mockFetchRoles.mockResolvedValue(spConfig);
  });

  it("getRoleConfig reads from SharePoint when available", async () => {
    const config = await getRoleConfig();
    expect(config.admins).toContain("sp-admin@example.com");
    expect(mockFetchRoles).toHaveBeenCalledTimes(1);
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it("setUserRole writes to SharePoint and does not touch the local file", async () => {
    await setUserRole("new@example.com", "admin");
    expect(mockWriteRoles).toHaveBeenCalledTimes(1);
    const saved = mockWriteRoles.mock.calls[0][0];
    expect(saved.admins).toContain("new@example.com");
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("removeUserRole writes to SharePoint and does not touch the local file", async () => {
    await removeUserRole("sp-admin@example.com");
    expect(mockWriteRoles).toHaveBeenCalledTimes(1);
    const saved = mockWriteRoles.mock.calls[0][0];
    expect(saved.admins).not.toContain("sp-admin@example.com");
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("falls back to local file when _roles.json does not exist in SharePoint yet", async () => {
    mockFetchRoles.mockResolvedValue(null); // file not in SP yet
    seedConfig(["local-admin@example.com"], []);
    const config = await getRoleConfig();
    expect(config.admins).toContain("local-admin@example.com");
    expect(mockReadFileSync).toHaveBeenCalledTimes(1);
  });
});
