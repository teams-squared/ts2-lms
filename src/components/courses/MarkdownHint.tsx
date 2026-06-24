"use client";

/**
 * Clickable formatting cheatsheet for authors writing markdown question/option
 * text. A native <details> disclosure — zero dependencies, keyboard-accessible,
 * collapsed by default so it stays out of the way for users who know markdown.
 */

const ROWS: { label: string; syntax: string }[] = [
  { label: "Bold", syntax: "**bold**" },
  { label: "Italic", syntax: "*italic*" },
  { label: "Bullet list", syntax: "- item  (one per line)" },
  { label: "Nested bullet", syntax: "  - indent 2 spaces" },
  { label: "Numbered list", syntax: "1. item" },
  { label: "Inline code", syntax: "`code`" },
  { label: "Link", syntax: "[text](https://…)" },
];

export function MarkdownHint() {
  return (
    <details className="mt-1 text-xs text-foreground-muted">
      <summary className="cursor-pointer select-none text-primary hover:underline">
        Formatting help
      </summary>
      <div className="mt-2 rounded-md border border-border bg-surface-muted/40 p-3">
        <p className="mb-2 text-foreground-subtle">
          Use markdown for formatting. New lines and a blank line before a list keep things tidy.
        </p>
        <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1">
          {ROWS.map((r) => (
            <div key={r.label} className="contents">
              <dt className="text-foreground">{r.label}</dt>
              <dd className="font-mono text-foreground-subtle">{r.syntax}</dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}
