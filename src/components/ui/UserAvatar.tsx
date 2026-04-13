"use client";

interface Props {
  name?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function UserAvatar({ name, size = "sm", className = "" }: Props) {
  const initial = (name || "?")[0].toUpperCase();
  const dim = {
    sm: "w-7 h-7 text-xs",
    md: "w-9 h-9 text-sm",
    lg: "w-14 h-14 text-xl",
  }[size];

  return (
    <div
      className={`${dim} rounded-full bg-brand-200 dark:bg-brand-900 flex items-center justify-center flex-shrink-0 font-semibold text-brand-800 dark:text-brand-200 ${className}`}
    >
      {initial}
    </div>
  );
}
