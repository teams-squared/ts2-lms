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
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <div
      className={`${dim} rounded-full bg-primary-subtle text-primary-subtle-foreground flex items-center justify-center flex-shrink-0 font-semibold ${className}`}
    >
      {initial}
    </div>
  );
}
