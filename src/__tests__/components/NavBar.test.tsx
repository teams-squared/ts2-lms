import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname } from "next/navigation";

// Use vi.hoisted so the fn references exist before vi.mock hoists
const { mockUseSession, mockSignOut } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockSignOut: vi.fn(),
}));
vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  signOut: mockSignOut,
}));

// Mock components that NavBar imports
vi.mock("@/components/Logo", () => ({
  default: ({ size, showText }: { size: number; showText: boolean }) => (
    <span data-testid="logo">Logo {size} {showText ? "text" : ""}</span>
  ),
}));
vi.mock("@/components/theme/ThemeToggle", () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Theme</button>,
}));
vi.mock("@/components/icons", () => ({
  HomeIcon: (props: Record<string, unknown>) => <svg data-testid="home-icon" {...props} />,
  ShieldIcon: (props: Record<string, unknown>) => <svg data-testid="shield-icon" {...props} />,
  HamburgerIcon: (props: Record<string, unknown>) => <svg data-testid="hamburger-icon" {...props} />,
  CloseIcon: (props: Record<string, unknown>) => <svg data-testid="close-icon" {...props} />,
  SignOutIcon: (props: Record<string, unknown>) => <svg data-testid="signout-icon" {...props} />,
}));

import NavBar from "@/components/layout/NavBar";

describe("NavBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePathname).mockReturnValue("/");
  });

  it("returns null on /login", () => {
    vi.mocked(usePathname).mockReturnValue("/login");
    mockUseSession.mockReturnValue({ data: null });
    const { container } = render(<NavBar />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when unauthenticated", () => {
    mockUseSession.mockReturnValue({ data: null });
    const { container } = render(<NavBar />);
    expect(container.firstChild).toBeNull();
  });

  it("shows Home link for authenticated user", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { name: "Test", email: "test@test.com", role: "employee" },
        expires: "2099-01-01",
      },
    });
    render(<NavBar />);
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("shows Admin link only for admin role", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { name: "Admin", email: "admin@test.com", role: "admin" },
        expires: "2099-01-01",
      },
    });
    render(<NavBar />);
    expect(screen.getByRole("link", { name: /Admin/ })).toBeInTheDocument();
  });

  it("does not show Admin link for non-admin", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { name: "Employee", email: "emp@test.com", role: "employee" },
        expires: "2099-01-01",
      },
    });
    render(<NavBar />);
    expect(screen.queryByRole("link", { name: /Admin/ })).not.toBeInTheDocument();
  });

  it("opens user menu and shows Profile + Sign out", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({
      data: {
        user: { name: "Test User", email: "test@test.com", role: "employee" },
        expires: "2099-01-01",
      },
    });
    render(<NavBar />);

    // Click the user avatar button to open menu
    const avatarButton = screen.getByText("T").closest("button")!;
    await user.click(avatarButton);

    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });

  it("calls signOut when Sign out is clicked", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({
      data: {
        user: { name: "Test", email: "test@test.com", role: "employee" },
        expires: "2099-01-01",
      },
    });
    render(<NavBar />);

    // Open user menu
    const avatarButton = screen.getByText("T").closest("button")!;
    await user.click(avatarButton);

    // Click sign out
    await user.click(screen.getByText("Sign out"));
    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });
});
