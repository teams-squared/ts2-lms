import type { Badge, UserProgress, DocMeta, Category } from "./types";

interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  check: (
    progress: UserProgress,
    allDocs: DocMeta[],
    categories: Category[]
  ) => boolean;
}

const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "first-steps",
    name: "First Steps",
    description: "Complete your first document",
    icon: "&#128214;",
    check: (progress) =>
      Object.values(progress.docs).some((d) => d.completedAt !== null),
  },
  {
    id: "quiz-ace",
    name: "Quiz Ace",
    description: "Score 100% on any quiz",
    icon: "&#11088;",
    check: (progress) =>
      Object.values(progress.docs).some((d) => d.quizScore === 1),
  },
  {
    id: "quiz-master",
    name: "Quiz Master",
    description: "Pass 5 quizzes with a perfect score",
    icon: "&#127942;",
    check: (progress) =>
      Object.values(progress.docs).filter((d) => d.quizScore === 1).length >= 5,
  },
  {
    id: "streak-3",
    name: "On a Roll",
    description: "Maintain a 3-day learning streak",
    icon: "&#128293;",
    check: (progress) => progress.streak.longestStreak >= 3,
  },
  {
    id: "streak-7",
    name: "Week Warrior",
    description: "Maintain a 7-day learning streak",
    icon: "&#9889;",
    check: (progress) => progress.streak.longestStreak >= 7,
  },
  {
    id: "halfway",
    name: "Halfway There",
    description: "Complete 50% of all available documents",
    icon: "&#127793;",
    check: (progress, allDocs) => {
      if (allDocs.length === 0) return false;
      const completed = Object.values(progress.docs).filter(
        (d) => d.completedAt !== null
      ).length;
      return completed >= allDocs.length / 2;
    },
  },
  {
    id: "completionist",
    name: "Completionist",
    description: "Complete every available document",
    icon: "&#127775;",
    check: (progress, allDocs) => {
      if (allDocs.length === 0) return false;
      const completed = Object.values(progress.docs).filter(
        (d) => d.completedAt !== null
      ).length;
      return completed >= allDocs.length;
    },
  },
];

/**
 * Evaluate all badge definitions against user progress.
 * Returns the full list of earned badges, including any newly earned ones.
 */
export function evaluateBadges(
  progress: UserProgress,
  allDocs: DocMeta[],
  categories: Category[]
): { allBadges: Badge[]; newBadges: Badge[] } {
  const existingIds = new Set(progress.badges.map((b) => b.id));
  const newBadges: Badge[] = [];

  for (const def of BADGE_DEFINITIONS) {
    if (existingIds.has(def.id)) continue;
    if (def.check(progress, allDocs, categories)) {
      newBadges.push({
        id: def.id,
        name: def.name,
        description: def.description,
        icon: def.icon,
        earnedAt: new Date().toISOString(),
      });
    }
  }

  // Also generate category champion badges dynamically
  for (const cat of categories) {
    const badgeId = `champion-${cat.slug}`;
    if (existingIds.has(badgeId)) continue;
    const catDocs = allDocs.filter((d) => d.category === cat.slug);
    if (catDocs.length === 0) continue;
    const allComplete = catDocs.every((d) => {
      const dp = progress.docs[`${d.category}/${d.slug}`];
      return dp?.completedAt !== null && dp?.completedAt !== undefined;
    });
    if (allComplete) {
      newBadges.push({
        id: badgeId,
        name: `${cat.title} Champion`,
        description: `Complete all documents in ${cat.title}`,
        icon: "&#127941;",
        earnedAt: new Date().toISOString(),
      });
    }
  }

  const allBadges = [...progress.badges, ...newBadges];
  return { allBadges, newBadges };
}

/**
 * Return all possible badge definitions (for showing unearned badges).
 */
export function getAllBadgeDefinitions(): { id: string; name: string; description: string; icon: string }[] {
  return BADGE_DEFINITIONS.map(({ id, name, description, icon }) => ({
    id,
    name,
    description,
    icon,
  }));
}
