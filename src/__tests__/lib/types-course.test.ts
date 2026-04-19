import { describe, it, expect } from "vitest";
import { prismaStatusToApp, appStatusToPrisma } from "@/lib/types";

describe("prismaStatusToApp", () => {
  it("maps DRAFT → draft", () => {
    expect(prismaStatusToApp("DRAFT")).toBe("draft");
  });
  it("maps PUBLISHED → published", () => {
    expect(prismaStatusToApp("PUBLISHED")).toBe("published");
  });
  it("maps ARCHIVED → archived", () => {
    expect(prismaStatusToApp("ARCHIVED")).toBe("archived");
  });
});

describe("appStatusToPrisma", () => {
  it("maps draft → DRAFT", () => {
    expect(appStatusToPrisma("draft")).toBe("DRAFT");
  });
  it("maps published → PUBLISHED", () => {
    expect(appStatusToPrisma("published")).toBe("PUBLISHED");
  });
  it("maps archived → ARCHIVED", () => {
    expect(appStatusToPrisma("archived")).toBe("ARCHIVED");
  });
});

describe("CourseStatus roundtrip", () => {
  it.each(["DRAFT", "PUBLISHED", "ARCHIVED"] as const)(
    "appStatusToPrisma(prismaStatusToApp(%s)) === %s",
    (prismaStatus) => {
      expect(appStatusToPrisma(prismaStatusToApp(prismaStatus))).toBe(prismaStatus);
    }
  );
});
