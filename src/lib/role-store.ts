import fs from "fs";
import path from "path";
import type { Role } from "./types";

export interface RoleConfig {
  admins: string[];
  managers: string[];
  defaultRole: string;
}

const BUNDLED_ROLES_FILE = path.join(process.cwd(), "src", "content", "_roles.json");
const ROLES_FILE = process.env.ROLES_DATA_DIR
  ? path.join(process.env.ROLES_DATA_DIR, "_roles.json")
  : BUNDLED_ROLES_FILE;

// Seed persistent volume from bundled default on first boot
if (process.env.ROLES_DATA_DIR && !fs.existsSync(ROLES_FILE)) {
  fs.mkdirSync(process.env.ROLES_DATA_DIR, { recursive: true });
  fs.copyFileSync(BUNDLED_ROLES_FILE, ROLES_FILE);
}

export async function getRoleConfig(): Promise<RoleConfig> {
  const raw = fs.readFileSync(ROLES_FILE, "utf-8");
  return JSON.parse(raw);
}

export async function setUserRole(
  email: string,
  role: Role
): Promise<void> {
  const config = await getRoleConfig();

  // Remove from all lists first
  config.admins = config.admins.filter((e) => e !== email);
  config.managers = config.managers.filter((e) => e !== email);

  // Add to the appropriate list
  if (role === "admin") {
    config.admins.push(email);
  } else if (role === "manager") {
    config.managers.push(email);
  }
  // "employee" = not in any list (default)

  fs.writeFileSync(ROLES_FILE, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export async function removeUserRole(email: string): Promise<void> {
  const config = await getRoleConfig();
  config.admins = config.admins.filter((e) => e !== email);
  config.managers = config.managers.filter((e) => e !== email);
  fs.writeFileSync(ROLES_FILE, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export async function getAllElevatedUsers(): Promise<
  { email: string; role: Role }[]
> {
  const config = await getRoleConfig();
  const users: { email: string; role: Role }[] = [];
  for (const email of config.admins) {
    users.push({ email, role: "admin" });
  }
  for (const email of config.managers) {
    users.push({ email, role: "manager" });
  }
  return users;
}
