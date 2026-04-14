import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";

import { SearchBar } from "@/components/courses/SearchBar";

describe("SearchBar", () => {
  const mockPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    } as any);
  });

  it("renders input with placeholder 'Search courses…'", () => {
    render(<SearchBar />);
    expect(screen.getByPlaceholderText("Search courses…")).toBeInTheDocument();
  });

  it("has aria-label 'Search courses'", () => {
    render(<SearchBar />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-label", "Search courses");
  });

  it("shows initial query value in input", () => {
    render(<SearchBar initialQuery="typescript" />);
    expect(screen.getByRole("textbox")).toHaveValue("typescript");
  });

  it("calls router.push with q param on Enter key", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);

    const input = screen.getByRole("textbox");
    await user.type(input, "react");
    await user.keyboard("{Enter}");

    expect(mockPush).toHaveBeenCalledWith("/courses?q=react");
  });

  it("calls router.push on blur when value changed", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);

    const input = screen.getByRole("textbox");
    await user.type(input, "nextjs");
    await user.tab(); // triggers blur

    expect(mockPush).toHaveBeenCalledWith("/courses?q=nextjs");
  });

  it("does NOT call router.push on blur when value unchanged", async () => {
    const user = userEvent.setup();
    render(<SearchBar initialQuery="same" />);

    const input = screen.getByRole("textbox");
    // Focus then blur without changing the value
    await user.click(input);
    await user.tab();

    expect(mockPush).not.toHaveBeenCalled();
  });
});
