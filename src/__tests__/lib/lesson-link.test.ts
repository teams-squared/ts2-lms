import { describe, it, expect } from "vitest";
import { parseLinkContent, serializeLinkContent } from "@/lib/lesson-link";

describe("parseLinkContent", () => {
  it("parses a minimal valid payload", () => {
    expect(parseLinkContent('{"url":"https://example.com/article"}')).toEqual({
      url: "https://example.com/article",
      blurb: undefined,
    });
  });

  it("parses a payload with a blurb", () => {
    expect(
      parseLinkContent(
        '{"url":"https://example.com/article","blurb":"Worth a read."}',
      ),
    ).toEqual({ url: "https://example.com/article", blurb: "Worth a read." });
  });

  it("returns null on missing url", () => {
    expect(parseLinkContent("{}")).toBeNull();
  });

  it("returns null on non-string url", () => {
    expect(parseLinkContent('{"url":123}')).toBeNull();
  });

  it("rejects javascript: URLs", () => {
    expect(parseLinkContent('{"url":"javascript:alert(1)"}')).toBeNull();
  });

  it("rejects data: URLs", () => {
    expect(parseLinkContent('{"url":"data:text/html,<script>"}')).toBeNull();
  });

  it("returns null on malformed JSON", () => {
    expect(parseLinkContent("not json")).toBeNull();
  });

  it("returns null on null/empty input", () => {
    expect(parseLinkContent(null)).toBeNull();
    expect(parseLinkContent("")).toBeNull();
    expect(parseLinkContent(undefined)).toBeNull();
  });

  it("returns null on plain string (legacy markdown content)", () => {
    expect(parseLinkContent("https://example.com")).toBeNull();
  });

  it("drops empty-string blurb", () => {
    expect(
      parseLinkContent('{"url":"https://example.com","blurb":""}'),
    ).toEqual({ url: "https://example.com", blurb: undefined });
  });
});

describe("serializeLinkContent", () => {
  it("omits blurb when empty", () => {
    expect(serializeLinkContent({ url: "https://example.com" })).toBe(
      '{"url":"https://example.com"}',
    );
  });

  it("includes blurb when present", () => {
    expect(
      serializeLinkContent({ url: "https://example.com", blurb: "Hello" }),
    ).toBe('{"url":"https://example.com","blurb":"Hello"}');
  });

  it("trims and drops whitespace-only blurbs", () => {
    expect(
      serializeLinkContent({ url: "https://example.com", blurb: "   " }),
    ).toBe('{"url":"https://example.com"}');
  });

  it("roundtrips through parse", () => {
    const input = { url: "https://example.com", blurb: "Required reading." };
    const parsed = parseLinkContent(serializeLinkContent(input));
    expect(parsed).toEqual(input);
  });
});
