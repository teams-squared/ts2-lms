import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next-mdx-remote/rsc so we can test plugin output without a full RSC env
vi.mock("next-mdx-remote/rsc", () => ({
  compileMDX: vi.fn(),
}));

// Mock highlight.js CSS import (not available in test env)
vi.mock("highlight.js/styles/github.css", () => ({}));

import { compileMDX } from "next-mdx-remote/rsc";
import DocRenderer from "@/components/docs/DocRenderer";

const mockCompileMDX = vi.mocked(compileMDX);

describe("DocRenderer", () => {
  it("calls compileMDX with rehype-highlight in the plugin list", async () => {
    mockCompileMDX.mockResolvedValue({
      content: <p>Hello</p>,
      frontmatter: {},
    });

    const result = await DocRenderer({ source: "# Hello" });
    render(result as React.ReactElement);

    expect(mockCompileMDX).toHaveBeenCalledOnce();
    const callArgs = mockCompileMDX.mock.calls[0][0];
    const rehypePlugins = callArgs.options?.mdxOptions?.rehypePlugins ?? [];

    // Verify rehype-highlight is included alongside existing plugins
    expect(rehypePlugins).toHaveLength(3);
    // rehypeSlug, rehypeAutolinkHeadings, rehypeHighlight
    const pluginNames = rehypePlugins.map((p: unknown) =>
      typeof p === "function" ? p.name : String(p)
    );
    expect(pluginNames.some((n: string) => n.toLowerCase().includes("highlight"))).toBe(true);
  });

  it("renders the compiled MDX content", async () => {
    mockCompileMDX.mockResolvedValue({
      content: <code className="language-typescript">const x = 1;</code>,
      frontmatter: {},
    });

    const result = await DocRenderer({ source: "```typescript\nconst x = 1;\n```" });
    render(result as React.ReactElement);

    expect(screen.getByText("const x = 1;")).toBeInTheDocument();
  });
});
