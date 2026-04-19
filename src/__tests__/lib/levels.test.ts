import { describe, it, expect } from "vitest";
import { calculateLevel } from "@/lib/levels";

describe("calculateLevel", () => {
  it("returns level 1 with 0 XP", () => {
    expect(calculateLevel(0)).toEqual({ level: 1, currentXp: 0, nextLevelXp: 100 });
  });

  it("returns level 1 with 50 XP", () => {
    expect(calculateLevel(50)).toEqual({ level: 1, currentXp: 50, nextLevelXp: 100 });
  });

  it("returns level 1 at the boundary (99 XP)", () => {
    expect(calculateLevel(99)).toEqual({ level: 1, currentXp: 99, nextLevelXp: 100 });
  });

  it("returns level 2 at exactly 100 XP", () => {
    expect(calculateLevel(100)).toEqual({ level: 2, currentXp: 0, nextLevelXp: 200 });
  });

  it("returns level 2 with 200 XP (mid-level)", () => {
    expect(calculateLevel(200)).toEqual({ level: 2, currentXp: 100, nextLevelXp: 200 });
  });

  it("returns level 2 at the boundary (299 XP)", () => {
    expect(calculateLevel(299)).toEqual({ level: 2, currentXp: 199, nextLevelXp: 200 });
  });

  it("returns level 3 at exactly 300 XP", () => {
    expect(calculateLevel(300)).toEqual({ level: 3, currentXp: 0, nextLevelXp: 300 });
  });

  it("returns level 3 at the boundary (599 XP)", () => {
    expect(calculateLevel(599)).toEqual({ level: 3, currentXp: 299, nextLevelXp: 300 });
  });

  it("returns level 4 at exactly 600 XP", () => {
    expect(calculateLevel(600)).toEqual({ level: 4, currentXp: 0, nextLevelXp: 400 });
  });

  it("returns a reasonable level for 10000 XP", () => {
    // Cumulative XP thresholds: 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500, 6600, 7800, 9100, 10500
    // 10000 >= 9100 (level 13→14 boundary) but < 10500 (level 14→15 boundary)
    // So 10000 XP = level 14, currentXp = 10000 - 9100 = 900, nextLevelXp = 14 * 100 = 1400
    const result = calculateLevel(10000);
    expect(result).toEqual({ level: 14, currentXp: 900, nextLevelXp: 1400 });
  });
});
