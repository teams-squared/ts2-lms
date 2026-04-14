import "@testing-library/jest-dom";

// happy-dom tries to fetch <iframe src="..."> and aborts mid-request during
// environment teardown, producing DOMException noise. Stub the src setter so
// iframes never trigger network activity in the test environment.
Object.defineProperty(HTMLIFrameElement.prototype, "src", {
  configurable: true,
  set(_url) {
    /* no-op: prevent happy-dom from loading iframe content in tests */
  },
  get() {
    return "";
  },
});

// Stub window.matchMedia — required by next-themes / dark mode components
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Global mock: next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));
