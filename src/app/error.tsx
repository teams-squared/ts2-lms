"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] px-4 text-center animate-fade-in">
      <p className="text-6xl font-bold text-danger mb-4">!</p>
      <h1 className="mb-2 font-display text-2xl font-semibold text-foreground">
        Something went wrong
      </h1>
      <p className="mb-8 max-w-sm text-sm text-foreground-muted">
        An unexpected error occurred while loading this page. You can try again,
        or go back home.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => unstable_retry()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
        >
          Go home
        </Link>
      </div>
      {error.digest && (
        <p className="mt-6 text-xs text-foreground-subtle">
          Reference: {error.digest}
        </p>
      )}
    </div>
  );
}
