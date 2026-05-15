/**
 * Smoke + behavior tests for the small "chrome" components: Logo,
 * Breadcrumbs, Toast, ToastProvider, ThemeProvider. These don't require
 * heavy mocking — no DB, no auth, just DOM-level behavior.
 *
 * setup.ts globally mocks ToastProvider with a no-op stub so unrelated tests
 * don't need to render a real provider. We undo that mock here so we can
 * actually exercise the real provider.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.unmock("@/components/ui/ToastProvider");

import { render, screen, fireEvent, act } from "@testing-library/react";

import Logo from "@/components/Logo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Toast } from "@/components/ui/Toast";
import {
  ToastProvider,
  useToast,
} from "@/components/ui/ToastProvider";
import {
  ThemeProvider,
  useTheme,
} from "@/components/theme/ThemeProvider";

describe("Logo", () => {
  it("renders the icon-only logo by default", () => {
    const { container } = render(<Logo />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toContain("/logo.png");
    // height attribute equals the default size (40).
    expect(img?.getAttribute("height")).toBe("40");
  });

  it("uses the wordmark variant when showText is true", () => {
    const { container } = render(<Logo showText size={32} />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toContain("/logo_w_text.png");
    // Wordmark variant has 3:1 aspect → width = 3*size.
    expect(img?.getAttribute("width")).toBe("96");
  });

  it("forwards extra className on the wrapper", () => {
    const { container } = render(<Logo className="mr-2" />);
    expect((container.firstChild as HTMLElement).className).toContain("mr-2");
  });
});

describe("Breadcrumbs", () => {
  it("renders each item separated by a chevron", () => {
    const { container } = render(
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Courses", href: "/courses" },
          { label: "Intro to Auth" },
        ]}
      />,
    );
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Courses")).toBeInTheDocument();
    expect(screen.getByText("Intro to Auth")).toBeInTheDocument();
    // 3 items → 2 chevrons.
    const chevrons = container.querySelectorAll("svg");
    expect(chevrons).toHaveLength(2);
  });

  it("renders the last item without href and with aria-current=page", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Active page" },
        ]}
      />,
    );
    const active = screen.getByText("Active page");
    expect(active.getAttribute("aria-current")).toBe("page");
    expect(active.tagName).toBe("SPAN");
  });

  it("renders intermediate items as anchor tags", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Courses", href: "/courses" },
          { label: "Active" },
        ]}
      />,
    );
    const home = screen.getByText("Home");
    expect(home.tagName).toBe("A");
    expect(home.getAttribute("href")).toBe("/");
  });
});

describe("Toast", () => {
  it("renders the message and an aria-live=polite role=status container", () => {
    const onDismiss = vi.fn();
    render(<Toast message="Saved" variant="success" onDismiss={onDismiss} />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toContain("Saved");
  });

  it("calls onDismiss when the dismiss button is clicked", () => {
    const onDismiss = vi.fn();
    render(<Toast message="x" variant="info" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("uses success-subtle, danger-subtle, primary-subtle bg per variant", () => {
    const { rerender, container } = render(
      <Toast message="x" variant="success" onDismiss={vi.fn()} />,
    );
    expect((container.firstChild as HTMLElement).className).toContain(
      "bg-success-subtle",
    );
    rerender(<Toast message="x" variant="error" onDismiss={vi.fn()} />);
    expect((container.firstChild as HTMLElement).className).toContain(
      "bg-danger-subtle",
    );
    rerender(<Toast message="x" variant="info" onDismiss={vi.fn()} />);
    expect((container.firstChild as HTMLElement).className).toContain(
      "bg-primary-subtle",
    );
  });
});

describe("ToastProvider + useToast", () => {
  // Real timers throughout — React 18/19's scheduler depends on timers and
  // breaks under vi.useFakeTimers in this setup.

  function Trigger() {
    const { toast } = useToast();
    return (
      <button onClick={() => toast("Hello", "info")}>fire</button>
    );
  }

  it("renders nothing in the toast region until a toast is fired", () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("appends a toast on fire", () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText("fire"));
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("caps the visible toast queue to the most recent 3", () => {
    function MultiTrigger() {
      const { toast } = useToast();
      return (
        <button
          onClick={() => {
            toast("A");
            toast("B");
            toast("C");
            toast("D");
          }}
        >
          fire-many
        </button>
      );
    }
    render(
      <ToastProvider>
        <MultiTrigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText("fire-many"));
    // "A" should have been evicted (MAX_TOASTS=3). B/C/D visible.
    expect(screen.queryByText("A")).toBeNull();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
    expect(screen.getByText("D")).toBeInTheDocument();
  });

  it("dismisses an individual toast when its close button is clicked", () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText("fire"));
    expect(screen.getByText("Hello")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(screen.queryByText("Hello")).toBeNull();
  });
});

describe("ThemeProvider + useTheme", () => {
  beforeEach(() => {
    // Default matchMedia: prefers light. Individual tests can override.
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    document.documentElement.classList.remove("dark");
    try {
      localStorage.removeItem("theme");
    } catch {
      // ignore
    }
  });

  function ThemeReader() {
    const { theme, resolvedTheme, setTheme } = useTheme();
    return (
      <div>
        <span data-testid="theme">{theme}</span>
        <span data-testid="resolved">{resolvedTheme}</span>
        <button onClick={() => setTheme("dark")}>go-dark</button>
        <button onClick={() => setTheme("light")}>go-light</button>
      </div>
    );
  }

  it("defaults to system theme + resolves to light when system prefers light", () => {
    render(
      <ThemeProvider>
        <ThemeReader />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme").textContent).toBe("system");
    expect(screen.getByTestId("resolved").textContent).toBe("light");
  });

  it("setTheme(dark) toggles the html.dark class and persists to localStorage", () => {
    render(
      <ThemeProvider>
        <ThemeReader />
      </ThemeProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByText("go-dark"));
    });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(screen.getByTestId("resolved").textContent).toBe("dark");
  });

  it("setTheme(light) removes the html.dark class", () => {
    document.documentElement.classList.add("dark");
    render(
      <ThemeProvider>
        <ThemeReader />
      </ThemeProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByText("go-light"));
    });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("default useTheme outside a provider returns light/system safe defaults", () => {
    // Hooks consumed outside the provider read the context's default value
    // (not throw). Verify the documented defaults.
    function Reader() {
      const t = useTheme();
      return <span>{t.resolvedTheme}</span>;
    }
    const { container } = render(<Reader />);
    expect(container.textContent).toBe("light");
  });
});
