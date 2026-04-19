import { describe, it, expect } from "vitest";
import { prismaRoleToApp, appRoleToPrisma } from "@/lib/types";

describe("prismaRoleToApp", () => {
  it("maps ADMIN → admin", () => {
    expect(prismaRoleToApp("ADMIN")).toBe("admin");
  });

  it("maps COURSE_MANAGER → course_manager", () => {
    expect(prismaRoleToApp("COURSE_MANAGER")).toBe("course_manager");
  });

  it("maps EMPLOYEE → employee", () => {
    expect(prismaRoleToApp("EMPLOYEE")).toBe("employee");
  });
});

describe("appRoleToPrisma", () => {
  it("maps admin → ADMIN", () => {
    expect(appRoleToPrisma("admin")).toBe("ADMIN");
  });

  it("maps course_manager → COURSE_MANAGER", () => {
    expect(appRoleToPrisma("course_manager")).toBe("COURSE_MANAGER");
  });

  it("maps employee → EMPLOYEE", () => {
    expect(appRoleToPrisma("employee")).toBe("EMPLOYEE");
  });
});

describe("roundtrip conversion", () => {
  it.each(["ADMIN", "COURSE_MANAGER", "EMPLOYEE"] as const)(
    "appRoleToPrisma(prismaRoleToApp(%s)) === %s",
    (prismaRole) => {
      expect(appRoleToPrisma(prismaRoleToApp(prismaRole))).toBe(prismaRole);
    }
  );
});
