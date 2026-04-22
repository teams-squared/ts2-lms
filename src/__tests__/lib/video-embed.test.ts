import { describe, it, expect } from "vitest";
import { toEmbedUrl } from "@/lib/video-embed";

describe("toEmbedUrl", () => {
  it("rewrites Loom share links to embed", () => {
    expect(toEmbedUrl("https://www.loom.com/share/abc123XYZ")).toBe(
      "https://www.loom.com/embed/abc123XYZ",
    );
    expect(toEmbedUrl("https://loom.com/share/abc123?sid=foo")).toBe(
      "https://www.loom.com/embed/abc123",
    );
  });

  it("leaves Loom embed links untouched (idempotent)", () => {
    expect(toEmbedUrl("https://www.loom.com/embed/abc123")).toBe(
      "https://www.loom.com/embed/abc123",
    );
  });

  it("rewrites YouTube watch + youtu.be + shorts", () => {
    expect(toEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
    expect(toEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
    expect(toEmbedUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
  });

  it("rewrites Vimeo share links to player URL", () => {
    expect(toEmbedUrl("https://vimeo.com/123456789")).toBe(
      "https://player.vimeo.com/video/123456789",
    );
  });

  it("returns unknown providers and direct mp4 URLs unchanged", () => {
    expect(toEmbedUrl("https://example.com/clip.mp4")).toBe(
      "https://example.com/clip.mp4",
    );
    expect(toEmbedUrl("https://fast.wistia.net/embed/iframe/xyz")).toBe(
      "https://fast.wistia.net/embed/iframe/xyz",
    );
  });

  it("handles malformed URLs gracefully", () => {
    expect(toEmbedUrl("not a url")).toBe("not a url");
    expect(toEmbedUrl("")).toBe("");
  });
});
