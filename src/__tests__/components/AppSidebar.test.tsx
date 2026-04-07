import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppSidebar from "@/components/layout/AppSidebar";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/docs"),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
    onClick,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
  }) => (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  ),
}));

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/components/Logo", () => ({
  default: ({ showText }: { showText?: boolean }) => (
    <div data-testid="logo">{showText ? "Teams Squared" : "TS"}</div>
  ),
}));

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
const mockUseSession = vi.mocked(useSession);
const mockUsePathname = vi.mocked(usePathname);

const SESSION_EMPLOYEE = {
  data: { expires: "2099-01-01", user: { name: "Alice", email: "alice@example.com", role: "employee" as const } },
  status: "authenticated" as const,
  update: vi.fn(),
};
const SESSION_ADMIN = {
  data: { expires: "2099-01-01", user: { name: "Bob", email: "bob@example.com", role: "admin" as const } },
  status: "authenticated" as const,
  update: vi.fn(),
};
const NO_SESSION = { data: null, status: "unauthenticated" as const, update: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mockUsePathname.mockReturnValue("/docs");
  // Stub localStorage
  Object.defineProperty(window, "localStorage", {
    value: { getItem: vi.fn(() => null), setItem: vi.fn() },
    writable: true,
  });
});

describe("AppSidebar — mobile header", () => {
  it("renders a hamburger button", () => {
    mockUseSession.mockReturnValue(SESSION_EMPLOYEE);
    render(<AppSidebar />);
    expect(
      screen.getByRole("button", { name: /open navigation menu/i })
    ).toBeInTheDocument();
  });

  it("hamburger button is hidden on desktop (md:hidden class)", () => {
    mockUseSession.mockReturnValue(SESSION_EMPLOYEE);
    render(<AppSidebar />);
    const header = screen.getByRole("banner");
    expect(header.className).toContain("md:hidden");
  });

  it("does not render on login page", () => {
    mockUsePathname.mockReturnValue("/login");
    mockUseSession.mockReturnValue(NO_SESSION);
    const { container } = render(<AppSidebar />);
    expect(container.firstChild).toBeNull();
  });
});

describe("AppSidebar — mobile drawer", () => {
  it("drawer is not visible initially", () => {
    mockUseSession.mockReturnValue(SESSION_EMPLOYEE);
    render(<AppSidebar />);
    expect(screen.queryByRole("navigation", { name: /mobile navigation/i })).not.toBeInTheDocument();
  });

  it("opens drawer when hamburger is clicked", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(SESSION_EMPLOYEE);
    render(<AppSidebar />);
    await user.click(screen.getByRole("button", { name: /open navigation menu/i }));
    expect(screen.getByRole("navigation", { name: /mobile navigation/i })).toBeInTheDocument();
  });

  it("closes drawer when close button is clicked", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(SESSION_EMPLOYEE);
    render(<AppSidebar />);
    await user.click(screen.getByRole("button", { name: /open navigation menu/i }));
    await user.click(screen.getByRole("button", { name: /close navigation menu/i }));
    expect(screen.queryByRole("navigation", { name: /mobile navigation/i })).not.toBeInTheDocument();
  });

  it("closes drawer when backdrop is clicked", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(SESSION_EMPLOYEE);
    render(<AppSidebar />);
    await user.click(screen.getByRole("button", { name: /open navigation menu/i }));
    // Click the backdrop (aria-hidden div behind drawer)
    const backdrop = document.querySelector("[aria-hidden='true']") as HTMLElement;
    await user.click(backdrop);
    expect(screen.queryByRole("navigation", { name: /mobile navigation/i })).not.toBeInTheDocument();
  });

  it("closes drawer when Escape is pressed", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(SESSION_EMPLOYEE);
    render(<AppSidebar />);
    await user.click(screen.getByRole("button", { name: /open navigation menu/i }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("navigation", { name: /mobile navigation/i })).not.toBeInTheDocument();
  });

  it("drawer contains Home link", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(SESSION_EMPLOYEE);
    render(<AppSidebar />);
    await user.click(screen.getByRole("button", { name: /open navigation menu/i }));
    const nav = screen.getByRole("navigation", { name: /mobile navigation/i });
    expect(nav.querySelector("a[href='/']")).toBeInTheDocument();
  });

  it("drawer contains Documentation link for authenticated users", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(SESSION_EMPLOYEE);
    render(<AppSidebar />);
    await user.click(screen.getByRole("button", { name: /open navigation menu/i }));
    const nav = screen.getByRole("navigation", { name: /mobile navigation/i });
    expect(nav.querySelector("a[href='/docs']")).toBeInTheDocument();
  });

  it("drawer shows Admin link only for admin role", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(SESSION_ADMIN);
    render(<AppSidebar />);
    await user.click(screen.getByRole("button", { name: /open navigation menu/i }));
    const nav = screen.getByRole("navigation", { name: /mobile navigation/i });
    expect(nav.querySelector("a[href='/admin']")).toBeInTheDocument();
  });

  it("drawer does not show Admin link for employee role", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(SESSION_EMPLOYEE);
    render(<AppSidebar />);
    await user.click(screen.getByRole("button", { name: /open navigation menu/i }));
    const nav = screen.getByRole("navigation", { name: /mobile navigation/i });
    expect(nav.querySelector("a[href='/admin']")).not.toBeInTheDocument();
  });

  it("closes drawer when a nav link is clicked", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(SESSION_EMPLOYEE);
    render(<AppSidebar />);
    await user.click(screen.getByRole("button", { name: /open navigation menu/i }));
    const nav = screen.getByRole("navigation", { name: /mobile navigation/i });
    const docsLink = nav.querySelector("a[href='/docs']") as HTMLElement;
    await user.click(docsLink);
    expect(screen.queryByRole("navigation", { name: /mobile navigation/i })).not.toBeInTheDocument();
  });
});
