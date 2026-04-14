import { describe, it, expect } from "vitest";
import { prismaRoleToApp, appRoleToPrisma } from "@/lib/types";

describe("prismaRoleToApp", () => {
  it("maps ADMIN → admin", () => {
    expect(prismaRoleToApp("ADMIN")).toBe("admin");
  });

  it("maps MANAGER → manager", () => {
    expect(prismaRoleToApp("MANAGER")).toBe("manager");
  });

  it("maps EMPLOYEE → employee", () => {
    expect(prismaRoleToApp("EMPLOYEE")).toBe("employee");
  });

  it("maps INSTRUCTOR → instructor", () => {
    expect(prismaRoleToApp("INSTRUCTOR")).toBe("instructor");
  });
});

describe("appRoleToPrisma", () => {
  it("maps admin → ADMIN", () => {
    expect(appRoleToPrisma("admin")).toBe("ADMIN");
  });

  it("maps manager → MANAGER", () => {
    expect(appRoleToPrisma("manager")).toBe("MANAGER");
  });

  it("maps employee → EMPLOYEE", () => {
    expect(appRoleToPrisma("employee")).toBe("EMPLOYEE");
  });

  it("maps instructor → INSTRUCTOR", () => {
    expect(appRoleToPrisma("instructor")).toBe("INSTRUCTOR");
  });
});

describe("roundtrip conversion", () => {
  it.each(["ADMIN", "MANAGER", "INSTRUCTOR", "EMPLOYEE"] as const)(
    "appRoleToPrisma(prismaRoleToApp(%s)) === %s",
    (prismaRole) => {
      expect(appRoleToPrisma(prismaRoleToApp(prismaRole))).toBe(prismaRole);
    }
  );
});
