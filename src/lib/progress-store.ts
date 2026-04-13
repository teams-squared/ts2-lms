import fs from "fs";
import path from "path";
import type { DocProgress, UserProgress } from "./types";

// ---------------------------------------------------------------------------
// Storage directory — reuses the same persistent volume as role-store
// ---------------------------------------------------------------------------

const PROGRESS_DIR = process.env.ROLES_DATA_DIR
  ? path.join(process.env.ROLES_DATA_DIR, "progress")
  : path.join(process.cwd(), "data", "progress");

if (!fs.existsSync(PROGRESS_DIR)) {
  fs.mkdirSync(PROGRESS_DIR, { recursive: true });
}

function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim().replace(/[^a-z0-9@._-]/g, "_");
}

function userFilePath(email: string): string {
  return path.join(PROGRESS_DIR, `${sanitizeEmail(email)}.json`);
}

function emptyProgress(): UserProgress {
  return {
    docs: {},
    badges: [],
    streak: { currentStreak: 0, longestStreak: 0, lastActivityDate: "" },
    lastSyncedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getUserProgress(email: string): UserProgress {
  const filePath = userFilePath(email);
  if (!fs.existsSync(filePath)) return emptyProgress();
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as UserProgress;
  } catch {
    return emptyProgress();
  }
}

export function saveUserProgress(email: string, progress: UserProgress): void {
  progress.lastSyncedAt = new Date().toISOString();
  fs.writeFileSync(
    userFilePath(email),
    JSON.stringify(progress, null, 2) + "\n",
    "utf-8"
  );
}

export function updateDocProgress(
  email: string,
  docKey: string,
  update: Partial<DocProgress>
): UserProgress {
  const progress = getUserProgress(email);
  const existing = progress.docs[docKey] || {
    completedAt: null,
    quizScore: null,
    quizPassedAt: null,
    quizAttempts: 0,
  };

  progress.docs[docKey] = { ...existing, ...update };

  // Update streak
  const today = new Date().toISOString().slice(0, 10);
  if (progress.streak.lastActivityDate !== today) {
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .slice(0, 10);
    if (progress.streak.lastActivityDate === yesterday) {
      progress.streak.currentStreak += 1;
    } else {
      progress.streak.currentStreak = 1;
    }
    progress.streak.longestStreak = Math.max(
      progress.streak.longestStreak,
      progress.streak.currentStreak
    );
    progress.streak.lastActivityDate = today;
  }

  saveUserProgress(email, progress);
  return progress;
}

/**
 * Return all user progress files for admin reporting.
 */
export function getOrgProgress(): { email: string; progress: UserProgress }[] {
  if (!fs.existsSync(PROGRESS_DIR)) return [];
  const files = fs.readdirSync(PROGRESS_DIR).filter((f) => f.endsWith(".json"));
  return files.map((file) => {
    const email = file.replace(".json", "");
    const raw = fs.readFileSync(path.join(PROGRESS_DIR, file), "utf-8");
    return { email, progress: JSON.parse(raw) as UserProgress };
  });
}
