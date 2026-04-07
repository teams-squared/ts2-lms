import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fs and path so role-store.ts never touches the real filesystem.
// The module-level bootstrap code (existsSync / copyFileSync) also runs on
// import, so we stub it out first.
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
import {
  getRoleConfig,
  setUserRole,
  removeUserRole,
  getAllElevatedUsers,
} from "@/lib/role-store";

const mockReadFileSync = vi.mocked(fs.readFileSync);
const mockWriteFileSync = vi.mocked(fs.writeFileSync);

function seedConfig(admins: string[] = [], managers: string[] = []) {
  const config = { admins, managers, defaultRole: "employee" };
  mockReadFileSync.mockReturnValue(JSON.stringify(config));
}

beforeEach(() => {
  vi.clearAllMocks();
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
