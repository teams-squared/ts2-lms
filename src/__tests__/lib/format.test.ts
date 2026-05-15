import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatActivityTime } from "@/lib/format";

const NOW = new Date("2026-05-14T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function minutesAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 60_000);
}

function hoursAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 60 * 60_000);
}

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 24 * 60 * 60_000);
}

describe("formatActivityTime", () => {
  it('returns "Just now" for sub-minute deltas', () => {
    expect(formatActivityTime(new Date(NOW.getTime() - 30_000))).toBe("Just now");
    expect(formatActivityTime(NOW)).toBe("Just now");
  });

  it("returns minutes ago for <60min", () => {
    expect(formatActivityTime(minutesAgo(1))).toBe("1m ago");
    expect(formatActivityTime(minutesAgo(45))).toBe("45m ago");
    expect(formatActivityTime(minutesAgo(59))).toBe("59m ago");
  });

  it("returns hours ago for <24h", () => {
    expect(formatActivityTime(hoursAgo(1))).toBe("1h ago");
    expect(formatActivityTime(hoursAgo(5))).toBe("5h ago");
    expect(formatActivityTime(hoursAgo(23))).toBe("23h ago");
  });

  it('returns "Yesterday" exactly one day ago', () => {
    expect(formatActivityTime(daysAgo(1))).toBe("Yesterday");
  });

  it("returns days ago for 2–6 days", () => {
    expect(formatActivityTime(daysAgo(2))).toBe("2d ago");
    expect(formatActivityTime(daysAgo(6))).toBe("6d ago");
  });

  it("returns localized month + day for >=7 days", () => {
    const out = formatActivityTime(daysAgo(7));
    // Localised string varies; assert it contains a recognisable month abbr.
    expect(out).toMatch(/[A-Z][a-z]{2} \d{1,2}/);
  });
});
