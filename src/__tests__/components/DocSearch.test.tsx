import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DocSearch from "@/components/docs/DocSearch";

const CONTENT = "The quick brown fox jumps over the lazy dog";
const REPEATED = "apple banana apple cherry apple";

function setupContent(text: string) {
  const div = document.createElement("div");
  div.id = "doc-content";
  div.textContent = text;
  document.body.appendChild(div);
}

beforeEach(() => setupContent(CONTENT));
afterEach(() => {
  document.getElementById("doc-content")?.remove();
});

describe("DocSearch — initial render", () => {
  it("renders the search input", () => {
    render(<DocSearch />);
    expect(screen.getByPlaceholderText("Search in document…")).toBeInTheDocument();
  });

  it("shows no match counter when query is empty", () => {
    render(<DocSearch />);
    expect(screen.queryByText(/\//)).not.toBeInTheDocument();
  });
});

describe("DocSearch — matching", () => {
  it("shows match count after typing a found term", async () => {
    const user = userEvent.setup();
    render(<DocSearch />);
    await user.type(screen.getByPlaceholderText("Search in document…"), "fox");
    await waitFor(() => expect(screen.getByText("1 / 1")).toBeInTheDocument());
  });

  it("injects <mark> elements into #doc-content for matches", async () => {
    const user = userEvent.setup();
    render(<DocSearch />);
    await user.type(screen.getByPlaceholderText("Search in document…"), "fox");
    await waitFor(() => {
      const marks = document.querySelectorAll("mark.search-highlight");
      expect(marks.length).toBeGreaterThan(0);
    });
  });

  it("shows multiple matches in counter", async () => {
    document.getElementById("doc-content")!.remove();
    setupContent(REPEATED);
    const user = userEvent.setup();
    render(<DocSearch />);
    await user.type(screen.getByPlaceholderText("Search in document…"), "apple");
    await waitFor(() => expect(screen.getByText("1 / 3")).toBeInTheDocument());
  });

  it("shows 'No matches' when term not found", async () => {
    const user = userEvent.setup();
    render(<DocSearch />);
    await user.type(screen.getByPlaceholderText("Search in document…"), "zzz");
    await waitFor(() => expect(screen.getByText("No matches")).toBeInTheDocument());
  });

  it("input has red border class when no matches", async () => {
    const user = userEvent.setup();
    render(<DocSearch />);
    await user.type(screen.getByPlaceholderText("Search in document…"), "zzz");
    await waitFor(() => {
      const input = screen.getByPlaceholderText("Search in document…");
      expect(input.className).toContain("red");
    });
  });
});

describe("DocSearch — navigation", () => {
  beforeEach(() => {
    document.getElementById("doc-content")!.remove();
    setupContent(REPEATED); // 3 × "apple"
  });

  it("advances to next match on Enter", async () => {
    const user = userEvent.setup();
    render(<DocSearch />);
    await user.type(screen.getByPlaceholderText("Search in document…"), "apple");
    await waitFor(() => screen.getByText("1 / 3"));
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByText("2 / 3")).toBeInTheDocument());
  });

  it("wraps from last to first match on Enter", async () => {
    const user = userEvent.setup();
    render(<DocSearch />);
    const input = screen.getByPlaceholderText("Search in document…");
    await user.type(input, "apple");
    await waitFor(() => screen.getByText("1 / 3"));
    await user.keyboard("{Enter}"); // 2
    await user.keyboard("{Enter}"); // 3
    await user.keyboard("{Enter}"); // wraps to 1
    await waitFor(() => expect(screen.getByText("1 / 3")).toBeInTheDocument());
  });

  it("goes to previous match on Shift+Enter", async () => {
    const user = userEvent.setup();
    render(<DocSearch />);
    const input = screen.getByPlaceholderText("Search in document…");
    await user.type(input, "apple");
    await waitFor(() => screen.getByText("1 / 3"));
    await user.keyboard("{Shift>}{Enter}{/Shift}"); // wraps to last
    await waitFor(() => expect(screen.getByText("3 / 3")).toBeInTheDocument());
  });
});

describe("DocSearch — clearing", () => {
  it("clears query on Escape", async () => {
    const user = userEvent.setup();
    render(<DocSearch />);
    const input = screen.getByPlaceholderText("Search in document…");
    await user.type(input, "fox");
    await waitFor(() => screen.getByText("1 / 1"));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("removes <mark> elements from DOM after clearing", async () => {
    const user = userEvent.setup();
    render(<DocSearch />);
    const input = screen.getByPlaceholderText("Search in document…");
    await user.type(input, "fox");
    await waitFor(() => document.querySelectorAll("mark.search-highlight").length > 0);
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(document.querySelectorAll("mark.search-highlight").length).toBe(0);
    });
  });
});
