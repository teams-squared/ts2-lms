import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/types";

/**
 * Sector+tier clearance primitives, shared by courses and the internal-docs
 * repository. The model is a Bell-LaPadula compartment system:
 *
 *   - A SECTOR is a compartment (e.g. "cybersecurity", "finance").
 *   - A TIER is a non-negative integer where LOWER = MORE protected
 *     (0 = most restricted). A user holds at most one tier per sector.
 *   - A user satisfies a requirement (sector S, tier T_req) if they hold a
 *     grant in S with tier <= T_req — i.e. their clearance is at least as
 *     privileged as the requirement.
 *   - A resource carries zero or more requirements; READ access is
 *     ANY-satisfies (the viewer needs to satisfy any one).
 *
 * `admin` always bypasses (see the resource-level helpers).
 */

/** sectorId -> the tier the user holds in that sector. */
export type UserTierMap = Map<string, number>;

export interface ClearanceRequirement {
  sectorId: string;
  tier: number;
}

/** Load every sector grant a user holds, keyed by sectorId. */
export async function loadUserTiers(userId: string): Promise<UserTierMap> {
  const grants = await prisma.userClearance.findMany({
    where: { userId },
    select: { sectorId: true, tier: true },
  });
  return new Map(grants.map((g) => [g.sectorId, g.tier]));
}

/**
 * READ check — ANY-satisfies. A user passes if they satisfy any single
 * requirement. `emptyDefault` decides what a requirement-less resource means:
 * courses default OPEN (true); internal docs default DENY (false) so a doc with
 * no requirement is never world-readable.
 */
export function satisfiesClearance(
  reqs: ClearanceRequirement[],
  tiers: UserTierMap,
  emptyDefault = true,
): boolean {
  if (reqs.length === 0) return emptyDefault;
  return reqs.some((r) => {
    const held = tiers.get(r.sectorId);
    return held != null && held <= r.tier; // lower tier = more access
  });
}

/**
 * AUTHOR check — ALL-satisfies, and at least one requirement. An author may
 * create/edit a doc only if they satisfy EVERY requirement on it (so they have
 * visibility into every audience the doc targets) and may only stamp a
 * requirement that falls within their own clearance. Zero requirements is never
 * authorable (would make the doc unreachable / world-readable).
 */
export function canAuthorForRequirements(
  reqs: ClearanceRequirement[],
  tiers: UserTierMap,
): boolean {
  if (reqs.length === 0) return false;
  return reqs.every((r) => {
    const held = tiers.get(r.sectorId);
    return held != null && held <= r.tier;
  });
}

/** Resource-level READ check with admin bypass. */
export async function canAccessResource(
  userId: string,
  role: Role,
  reqs: ClearanceRequirement[],
  emptyDefault = true,
): Promise<boolean> {
  if (role === "admin") return true;
  return satisfiesClearance(reqs, await loadUserTiers(userId), emptyDefault);
}

/** Resource-level AUTHOR check with admin bypass. */
export async function canAuthorResource(
  userId: string,
  role: Role,
  reqs: ClearanceRequirement[],
): Promise<boolean> {
  if (role === "admin") return true;
  return canAuthorForRequirements(reqs, await loadUserTiers(userId));
}

/**
 * Batch READ filter — loads the user's tiers ONCE and evaluates N resources in
 * memory (no per-resource query). Returns the set of accessible ids. Admins get
 * everything. Pass `emptyDefault=false` for internal docs.
 */
export async function filterAccessibleDocIds(
  userId: string,
  role: Role,
  docs: { id: string; reqs: ClearanceRequirement[] }[],
  emptyDefault = false,
): Promise<Set<string>> {
  if (role === "admin") return new Set(docs.map((d) => d.id));
  const tiers = await loadUserTiers(userId);
  return new Set(
    docs
      .filter((d) => satisfiesClearance(d.reqs, tiers, emptyDefault))
      .map((d) => d.id),
  );
}

/** True if the user holds any clearance at all (i.e. is an "internal" member). */
export async function hasAnyClearance(userId: string): Promise<boolean> {
  const count = await prisma.userClearance.count({ where: { userId } });
  return count > 0;
}

/**
 * Sectors a user may stamp as a requirement when authoring, plus the minimum
 * tier they may set per sector (their own held tier — they can require their
 * tier or any less-protected/higher-numbered tier). Admins get every sector and
 * no minimum constraint.
 */
export async function loadAuthorSectorOptions(
  userId: string,
  role: Role,
): Promise<{ sectors: { id: string; label: string }[]; minTierBySector?: Record<string, number> }> {
  if (role === "admin") {
    const all = await prisma.sector.findMany({
      orderBy: { label: "asc" },
      select: { id: true, label: true },
    });
    return { sectors: all };
  }
  const grants = await prisma.userClearance.findMany({
    where: { userId },
    select: { tier: true, sector: { select: { id: true, label: true } } },
    orderBy: { sector: { label: "asc" } },
  });
  return {
    sectors: grants.map((g) => ({ id: g.sector.id, label: g.sector.label })),
    minTierBySector: Object.fromEntries(grants.map((g) => [g.sector.id, g.tier])),
  };
}

/**
 * Human-readable summary of a resource's requirements, e.g.
 * "Cybersecurity tier ≤2 or Finance tier ≤1". Used for course lock hints.
 */
export function describeRequirements(
  reqs: { tier: number; sector: { label: string } }[],
): string | null {
  if (reqs.length === 0) return null;
  return reqs
    .map((r) => `${r.sector.label} tier ≤${r.tier}`)
    .join(" or ");
}
