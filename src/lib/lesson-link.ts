/**
 * Helpers for `LessonType.LINK` lessons. The `Lesson.content` column for
 * a LINK lesson holds a JSON string of `{ url, blurb? }` — same storage
 * convention as VIDEO / DOCUMENT / HTML lessons. This module is the
 * single source of truth for parsing + validating that payload.
 */

export interface LinkLessonContent {
  url: string;
  blurb?: string;
}

/**
 * Parse `Lesson.content` as a `LinkLessonContent`. Returns `null` on
 * invalid / missing content. Rejects non-`http(s)` URLs as defence in
 * depth (parity with the markdown link sanitization in `LessonViewer`).
 */
export function parseLinkContent(raw: string | null | undefined): LinkLessonContent | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LinkLessonContent>;
    if (typeof parsed?.url !== "string" || parsed.url.length === 0) return null;
    const u = new URL(parsed.url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return {
      url: parsed.url,
      blurb: typeof parsed.blurb === "string" && parsed.blurb.length > 0
        ? parsed.blurb
        : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Stringify a `LinkLessonContent` for storage in `Lesson.content`. Drops
 * empty blurbs so the JSON stays compact.
 */
export function serializeLinkContent(input: LinkLessonContent): string {
  const blurb = input.blurb?.trim();
  return JSON.stringify(blurb ? { url: input.url, blurb } : { url: input.url });
}
