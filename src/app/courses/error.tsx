"use client";

import { useEffect } from "react";

export default function CoursesError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center animate-fade-in">
      <h2 className="mb-2 font-display text-xl font-semibold text-foreground">
        Couldn&apos;t load courses
      </h2>
      <p className="mb-6 text-sm text-foreground-muted">
        Check your connection and try again. If it keeps happening, contact
        support.
      </p>
      <button
        onClick={() => unstable_retry()}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        Try again
      </button>
    </div>
  );
}
