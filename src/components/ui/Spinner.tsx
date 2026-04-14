"use client";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-4 h-4 border-[1.5px]",
  md: "w-6 h-6 border-2",
  lg: "w-8 h-8 border-2",
};

export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  return (
    <div
      className={`${sizeClasses[size]} border-brand-600 dark:border-brand-400 border-t-transparent rounded-full animate-spin ${className}`}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading…</span>
    </div>
  );
}
