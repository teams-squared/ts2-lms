import { describe, it, expect } from "vitest";
import { prismaLessonTypeToApp, appLessonTypeToPrisma } from "@/lib/types";

describe("prismaLessonTypeToApp", () => {
  it("maps TEXT → text", () => {
    expect(prismaLessonTypeToApp("TEXT")).toBe("text");
  });
  it("maps VIDEO → video", () => {
    expect(prismaLessonTypeToApp("VIDEO")).toBe("video");
  });
  it("maps QUIZ → quiz", () => {
    expect(prismaLessonTypeToApp("QUIZ")).toBe("quiz");
  });
  it("maps DOCUMENT → document", () => {
    expect(prismaLessonTypeToApp("DOCUMENT")).toBe("document");
  });
});

describe("appLessonTypeToPrisma", () => {
  it("maps text → TEXT", () => {
    expect(appLessonTypeToPrisma("text")).toBe("TEXT");
  });
  it("maps video → VIDEO", () => {
    expect(appLessonTypeToPrisma("video")).toBe("VIDEO");
  });
  it("maps quiz → QUIZ", () => {
    expect(appLessonTypeToPrisma("quiz")).toBe("QUIZ");
  });
  it("maps document → DOCUMENT", () => {
    expect(appLessonTypeToPrisma("document")).toBe("DOCUMENT");
  });
});

describe("LessonType roundtrip", () => {
  it.each(["TEXT", "VIDEO", "QUIZ", "DOCUMENT"] as const)(
    "appLessonTypeToPrisma(prismaLessonTypeToApp(%s)) === %s",
    (prismaType) => {
      expect(appLessonTypeToPrisma(prismaLessonTypeToApp(prismaType))).toBe(prismaType);
    }
  );
});
