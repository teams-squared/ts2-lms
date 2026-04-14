import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockSetTheme = vi.fn();
const mockUseTheme = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: (...args: unknown[]) => mockUseTheme(...args),
}));

vi.mock("@/components/icons", () => ({
  SunIcon: (props: Record<string, unknown>) => <svg data-testid="sun-icon" {...props} />,
  MoonIcon: (props: Record<string, unknown>) => <svg data-testid="moon-icon" {...props} />,
}));

import { ThemeToggle } from "@/components/theme/ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Switch to dark mode" aria-label in light mode', () => {
    mockUseTheme.mockReturnValue({ resolvedTheme: "light", setTheme: mockSetTheme });
    render(<ThemeToggle />);

    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
  });

  it('renders "Switch to light mode" aria-label in dark mode', () => {
    mockUseTheme.mockReturnValue({ resolvedTheme: "dark", setTheme: mockSetTheme });
    render(<ThemeToggle />);

    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
  });

  it('calls setTheme("dark") when clicked in light mode', async () => {
    mockUseTheme.mockReturnValue({ resolvedTheme: "light", setTheme: mockSetTheme });
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: "Switch to dark mode" }));

    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it('calls setTheme("light") when clicked in dark mode', async () => {
    mockUseTheme.mockReturnValue({ resolvedTheme: "dark", setTheme: mockSetTheme });
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: "Switch to light mode" }));

    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("renders sun icon in dark mode and moon icon in light mode", () => {
    mockUseTheme.mockReturnValue({ resolvedTheme: "dark", setTheme: mockSetTheme });
    const { unmount } = render(<ThemeToggle />);

    expect(screen.getByTestId("sun-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("moon-icon")).not.toBeInTheDocument();

    unmount();

    mockUseTheme.mockReturnValue({ resolvedTheme: "light", setTheme: mockSetTheme });
    render(<ThemeToggle />);

    expect(screen.getByTestId("moon-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("sun-icon")).not.toBeInTheDocument();
  });
});
