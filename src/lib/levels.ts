/** Calculate level from XP. Each level requires progressively more XP. */
export function calculateLevel(xp: number): { level: number; currentXp: number; nextLevelXp: number } {
  // Level formula: level N requires N*100 XP total
  // Level 1: 0-99, Level 2: 100-299, Level 3: 300-599, etc.
  let level = 1;
  let xpRequired = 100;
  let xpAccumulated = 0;

  while (xp >= xpAccumulated + xpRequired) {
    xpAccumulated += xpRequired;
    level++;
    xpRequired = level * 100;
  }

  return {
    level,
    currentXp: xp - xpAccumulated,
    nextLevelXp: xpRequired,
  };
}
