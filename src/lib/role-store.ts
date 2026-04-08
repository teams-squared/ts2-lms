import fs from "fs";
import path from "path";
import type { Role, RoleConfig } from "./types";
import {
  isSharePointAvailable,
  fetchRolesFromSharePoint,
  writeRolesToSharePoint,
} from "./sharepoint";

export type { RoleConfig };

// ---------------------------------------------------------------------------
// Local-filesystem fallback (used in development or when SharePoint is absent)
// ---------------------------------------------------------------------------

const BUNDLED_ROLES_FILE = path.join(
  process.cwd(),
  "src",
  "content",
  "_roles.json"
);
const ROLES_FILE = process.env.ROLES_DATA_DIR
  ? path.join(process.env.ROLES_DATA_DIR, "_roles.json")
  : BUNDLED_ROLES_FILE;

// Seed persistent volume from bundled defaults on first boot.
if (process.env.ROLES_DATA_DIR && !fs.existsSync(ROLES_FILE)) {
  fs.mkdirSync(process.env.ROLES_DATA_DIR, { recursive: true });
  fs.copyFileSync(BUNDLED_ROLES_FILE, ROLES_FILE);
}

function readLocalConfig(): RoleConfig {
  const raw = fs.readFileSync(ROLES_FILE, "utf-8");
  return JSON.parse(raw) as RoleConfig;
}

function writeLocalConfig(config: RoleConfig): void {
  fs.writeFileSync(
    ROLES_FILE,
    JSON.stringify(config, null, 2) + "\n",
    "utf-8"
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read the current role configuration.
 * Uses SharePoint when configured; falls back to the local JSON file
 * (which also serves as the seed when SharePoint is used for the first time).
 */
export async function getRoleConfig(): Promise<RoleConfig> {
  if (isSharePointAvailable()) {
    const spConfig = await fetchRolesFromSharePoint();
    if (spConfig !== null) return spConfig;
    // _roles.json doesn't exist in SharePoint yet — return local config
    // so the first write seeds SharePoint with the existing roles.
  }
  return readLocalConfig();
}

/**
 * Assign a role to a user.
 * Persists to SharePoint when available, local file otherwise.
 */
export async function setUserRole(email: string, role: Role): Promise<void> {
  const config = await getRoleConfig();

  // Remove from all role lists first.
  config.admins = config.admins.filter((e) => e !== email);
  config.managers = config.managers.filter((e) => e !== email);

  if (role === "admin") config.admins.push(email);
  else if (role === "manager") config.managers.push(email);
  // "employee" means absent from all lists (the default).

  if (isSharePointAvailable()) {
    await writeRolesToSharePoint(config);
  } else {
    writeLocalConfig(config);
  }
}

/**
 * Remove a user from all elevated-role lists (reverts them to "employee").
 * Persists to SharePoint when available, local file otherwise.
 */
export async function removeUserRole(email: string): Promise<void> {
  const config = await getRoleConfig();
  config.admins = config.admins.filter((e) => e !== email);
  config.managers = config.managers.filter((e) => e !== email);

  if (isSharePointAvailable()) {
    await writeRolesToSharePoint(config);
  } else {
    writeLocalConfig(config);
  }
}

/**
 * Return every user with an explicitly elevated role (admin or manager).
 * Employees are omitted — they are the default.
 */
export async function getAllElevatedUsers(): Promise<
  { email: string; role: Role }[]
> {
  const config = await getRoleConfig();
  const users: { email: string; role: Role }[] = [];
  for (const email of config.admins) users.push({ email, role: "admin" });
  for (const email of config.managers) users.push({ email, role: "manager" });
  return users;
}
