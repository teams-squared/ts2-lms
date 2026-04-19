import { describe, it, expect, vi, afterEach } from "vitest";
import {
  computeDeadline,
  getDeadlineStatus,
  formatDeadlineRelative,
} from "@/lib/deadlines";

describe("computeDeadline", () => {
  it("adds deadlineDays to enrolledAt", () => {
    const enrolled = new Date("2026-04-10T00:00:00Z");
    const deadline = computeDeadline(enrolled, 3);
    expect(deadline.toISOString()).toBe("2026-04-13T00:00:00.000Z");
  });

  it("handles month boundary", () => {
    const enrolled = new Date("2026-01-30T12:00:00Z");
    const deadline = computeDeadline(enrolled, 5);
    expect(deadline.getMonth()).toBe(1); // February
    expect(deadline.getDate()).toBe(4);
  });
});

describe("getDeadlineStatus", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'none' when deadlineDays is null", () => {
    const enrolled = new Date("2026-04-10");
    expect(getDeadlineStatus(enrolled, null, null)).toBe("none");
  });

  it("returns 'completed' when lesson is completed", () => {
    const enrolled = new Date("2026-04-10");
    const completed = new Date("2026-04-11");
    expect(getDeadlineStatus(enrolled, 3, completed)).toBe("completed");
  });

  it("returns 'completed' even if completed after deadline", () => {
    const enrolled = new Date("2026-04-10");
    const completed = new Date("2026-04-20"); // well past 3 days
    expect(getDeadlineStatus(enrolled, 3, completed)).toBe("completed");
  });

  it("returns 'overdue' when deadline has passed and not completed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T12:00:00Z"));

    const enrolled = new Date("2026-04-10T00:00:00Z");
    expect(getDeadlineStatus(enrolled, 3, null)).toBe("overdue");
  });

  it("returns 'due-soon' when within 24 hours of deadline", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T20:00:00Z"));

    const enrolled = new Date("2026-04-10T00:00:00Z"); // deadline: Apr 13 00:00
    expect(getDeadlineStatus(enrolled, 3, null)).toBe("due-soon");
  });

  it("returns 'upcoming' when deadline is more than 24h away", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-11T00:00:00Z"));

    const enrolled = new Date("2026-04-10T00:00:00Z"); // deadline: Apr 13 00:00
    expect(getDeadlineStatus(enrolled, 3, null)).toBe("upcoming");
  });
});

describe("formatDeadlineRelative", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'Overdue by X days' for past deadlines", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T12:00:00Z"));

    const deadline = new Date("2026-04-13T00:00:00Z");
    expect(formatDeadlineRelative(deadline)).toBe("Overdue by 2 days");
  });

  it("returns 'Overdue by 1 day' for singular", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T12:00:00Z"));

    const deadline = new Date("2026-04-13T00:00:00Z");
    expect(formatDeadlineRelative(deadline)).toBe("Overdue by 1 day");
  });

  it("returns 'Due today' when deadline is less than 24h away", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-13T06:00:00Z"));

    const deadline = new Date("2026-04-13T12:00:00Z");
    expect(formatDeadlineRelative(deadline)).toBe("Due today");
  });

  it("returns 'Due tomorrow' when 1 day away", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T12:00:00Z"));

    const deadline = new Date("2026-04-13T12:00:00Z");
    expect(formatDeadlineRelative(deadline)).toBe("Due tomorrow");
  });

  it("returns 'Due in X days' for 2-7 days away", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-10T00:00:00Z"));

    const deadline = new Date("2026-04-13T00:00:00Z");
    expect(formatDeadlineRelative(deadline)).toBe("Due in 3 days");
  });

  it("returns formatted date for deadlines > 7 days away", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T00:00:00Z"));

    const deadline = new Date("2026-04-20T00:00:00Z");
    expect(formatDeadlineRelative(deadline)).toMatch(/Due Apr 20/);
  });
});
