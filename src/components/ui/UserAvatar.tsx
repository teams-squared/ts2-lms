"use client";

import { useState } from "react";

interface Props {
  name?: string | null;
  image?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function UserAvatar({ name, image, size = "sm", className = "" }: Props) {
  const [imgError, setImgError] = useState(false);
  const initial = (name || "?")[0].toUpperCase();
  const dim = {
    sm: "w-7 h-7 text-xs",
    md: "w-9 h-9 text-sm",
    lg: "w-14 h-14 text-xl",
  }[size];

  if (image && !imgError) {
    return (
      <img
        src={image}
        alt={name ?? "User avatar"}
        onError={() => setImgError(true)}
        className={`${dim} rounded-full object-cover flex-shrink-0 ${className}`}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={`${dim} rounded-full bg-brand-200 dark:bg-brand-900 flex items-center justify-center flex-shrink-0 font-semibold text-brand-800 dark:text-brand-200 ${className}`}
    >
      {initial}
    </div>
  );
}
