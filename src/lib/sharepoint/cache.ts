import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { METADATA_CACHE_TTL_MS } from "./config";

// ─── Layer A: Metadata cache (PostgreSQL) ──────────────────────────────────

export async function getCachedMetadata<T>(key: string): Promise<{ data: T; etag: string | null } | null> {
  const entry = await prisma.sharePointCache.findUnique({ where: { cacheKey: key } });
  if (!entry) return null;
  if (entry.expiresAt < new Date()) return null;
  return { data: JSON.parse(entry.data) as T, etag: entry.etag };
}

export async function setCachedMetadata<T>(
  key: string,
  data: T,
  etag?: string | null
): Promise<void> {
  const expiresAt = new Date(Date.now() + METADATA_CACHE_TTL_MS);
  await prisma.sharePointCache.upsert({
    where: { cacheKey: key },
    create: {
      cacheKey: key,
      data: JSON.stringify(data),
      etag: etag ?? null,
      expiresAt,
    },
    update: {
      data: JSON.stringify(data),
      etag: etag ?? null,
      expiresAt,
    },
  });
}

export async function extendCacheTTL(key: string): Promise<void> {
  const expiresAt = new Date(Date.now() + METADATA_CACHE_TTL_MS);
  await prisma.sharePointCache.update({
    where: { cacheKey: key },
    data: { expiresAt },
  });
}

export async function cleanExpiredMetadata(): Promise<number> {
  const result = await prisma.sharePointCache.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

// ─── Layer B: File content cache (filesystem) ─────────────────────────────

const CACHE_DIR = path.join(process.cwd(), ".cache", "sharepoint");

function fileCacheHash(driveId: string, itemId: string): string {
  return createHash("sha256").update(`${driveId}:${itemId}`).digest("hex");
}

function fileCachePath(hash: string): string {
  return path.join(CACHE_DIR, `${hash}.bin`);
}

function fileMetaPath(hash: string): string {
  return path.join(CACHE_DIR, `${hash}.meta.json`);
}

interface FileCacheMeta {
  etag: string | null;
  mimeType: string;
  fileName: string;
  expiresAt: number;
}

export async function getCachedFile(
  driveId: string,
  itemId: string
): Promise<{ data: Buffer; meta: FileCacheMeta } | null> {
  const hash = fileCacheHash(driveId, itemId);
  try {
    const metaRaw = await readFile(fileMetaPath(hash), "utf-8");
    const meta: FileCacheMeta = JSON.parse(metaRaw);
    if (Date.now() > meta.expiresAt) return null;
    const data = await readFile(fileCachePath(hash));
    return { data, meta };
  } catch {
    return null;
  }
}

export async function setCachedFile(
  driveId: string,
  itemId: string,
  data: Buffer,
  meta: Omit<FileCacheMeta, "expiresAt">
): Promise<void> {
  const hash = fileCacheHash(driveId, itemId);
  const fullMeta: FileCacheMeta = { ...meta, expiresAt: Date.now() + METADATA_CACHE_TTL_MS };

  await mkdir(CACHE_DIR, { recursive: true });

  // Write to temp files then rename for atomic writes
  const tmpBin = fileCachePath(hash) + ".tmp";
  const tmpMeta = fileMetaPath(hash) + ".tmp";
  await writeFile(tmpBin, data);
  await writeFile(tmpMeta, JSON.stringify(fullMeta));
  await rename(tmpBin, fileCachePath(hash));
  await rename(tmpMeta, fileMetaPath(hash));
}

export async function cleanExpiredFiles(): Promise<number> {
  let count = 0;
  try {
    const entries = await readdir(CACHE_DIR);
    for (const entry of entries) {
      if (!entry.endsWith(".meta.json")) continue;
      const metaFile = path.join(CACHE_DIR, entry);
      try {
        const metaRaw = await readFile(metaFile, "utf-8");
        const meta: FileCacheMeta = JSON.parse(metaRaw);
        if (Date.now() > meta.expiresAt) {
          const binFile = metaFile.replace(".meta.json", ".bin");
          await rm(metaFile, { force: true });
          await rm(binFile, { force: true });
          count++;
        }
      } catch {
        // Skip malformed entries
      }
    }
  } catch {
    // Cache directory may not exist yet
  }
  return count;
}

/** Check file existence without reading (for cache stats). */
export async function fileCacheExists(driveId: string, itemId: string): Promise<boolean> {
  const hash = fileCacheHash(driveId, itemId);
  try {
    await stat(fileMetaPath(hash));
    return true;
  } catch {
    return false;
  }
}
