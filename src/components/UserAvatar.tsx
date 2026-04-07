"use client";

import { useState } from "react";

interface Props {
  name?: string | null;
  email?: string | null;
  size?: "sm" | "md";
  className?: string;
}

export function UserAvatar({ name, email, size = "sm", className = "" }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = (name || email || "?")[0].toUpperCase();
  const dim = size === "sm" ? "w-6 h-6 text-xs" : "w-8 h-8 text-sm";

  if (email && !imgFailed) {
    return (
      <img
        src={`/api/user/avatar?email=${encodeURIComponent(email)}`}
        alt={name ?? email}
        onError={() => setImgFailed(true)}
        className={`${dim} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${dim} rounded-full bg-brand-200 flex items-center justify-center flex-shrink-0 font-semibold text-brand-800 ${className}`}
    >
      {initial}
    </div>
  );
}
