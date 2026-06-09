import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import type { Components } from "react-markdown";
import { MarkdownContent } from "@/components/courses/MarkdownContent";

/**
 * Regression guard: GFM tables must render as real <table> markup. react-markdown
 * core does NOT parse pipe tables — they only work because MarkdownContent wires
 * remark-gfm. Drop the plugin and these pipes render as a raw paragraph instead.
 * Deliberately does NOT mock react-markdown (unlike LessonViewer.test) so the
 * real parser + plugin run.
 */
const passthroughComponents: Components = {};

describe("MarkdownContent", () => {
  it("renders GFM pipe tables as real table markup", () => {
    const md = ["| Name | Role |", "|---|---|", "| Amresh | Director |"].join("\n");
    const { container } = render(
      <MarkdownContent components={passthroughComponents}>{md}</MarkdownContent>,
    );

    expect(container.querySelector("table")).not.toBeNull();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Amresh")).toBeInTheDocument();
    // No literal pipes left in the rendered output.
    expect(container.textContent).not.toContain("|---|");
  });

  it("renders headings and paragraphs", () => {
    const { container } = render(
      <MarkdownContent components={passthroughComponents}>{"# Title\n\nBody text."}</MarkdownContent>,
    );
    expect(container.querySelector("h1")?.textContent).toBe("Title");
    expect(screen.getByText("Body text.")).toBeInTheDocument();
  });
});
