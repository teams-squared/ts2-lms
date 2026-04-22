/**
 * Normalize common "share" video URLs to the form their providers actually
 * accept inside an <iframe src>. Returns the original URL unchanged when no
 * pattern matches — providers like Wistia, MS Stream embed URLs, or generic
 * .mp4 links continue to work.
 *
 * Supported:
 *   - Loom    /share/<id>            → /embed/<id>
 *   - YouTube /watch?v=<id>          → /embed/<id>
 *             youtu.be/<id>          → youtube.com/embed/<id>
 *             /shorts/<id>           → /embed/<id>
 *   - Vimeo   vimeo.com/<id>         → player.vimeo.com/video/<id>
 */
export function toEmbedUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return raw;

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return raw;
  }

  const host = u.hostname.toLowerCase().replace(/^www\./, "");

  // ── Loom ────────────────────────────────────────────────────────────────
  if (host === "loom.com") {
    const m = u.pathname.match(/^\/(?:share|embed)\/([a-zA-Z0-9]+)/);
    if (m) {
      return `https://www.loom.com/embed/${m[1]}`;
    }
  }

  // ── YouTube ─────────────────────────────────────────────────────────────
  if (host === "youtube.com" || host === "m.youtube.com") {
    if (u.pathname === "/watch") {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    const shorts = u.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]+)/);
    if (shorts) return `https://www.youtube.com/embed/${shorts[1]}`;
    // Already /embed/<id> — leave it alone.
  }
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    if (id) return `https://www.youtube.com/embed/${id}`;
  }

  // ── Vimeo ───────────────────────────────────────────────────────────────
  if (host === "vimeo.com") {
    const id = u.pathname.split("/").filter(Boolean)[0];
    if (id && /^\d+$/.test(id)) {
      return `https://player.vimeo.com/video/${id}`;
    }
  }

  return raw;
}
