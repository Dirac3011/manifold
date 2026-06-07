"use client";

import { useState } from "react";

type Props = {
  userId?: string;
  name?: string | null;
  username?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZES = { sm: "h-7 w-7 text-xs", md: "h-9 w-9 text-sm", lg: "h-20 w-20 text-2xl" };

export function UserAvatar({ userId, name, username, size = "md", className = "" }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const initials = (name || username || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const src = userId && !imgFailed ? `/api/users/${userId}/avatar` : null;

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full bg-[var(--surface-hover)] ${SIZES[size]} ${className}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name || username || "User"}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : null}
      {!src && (
        <span className="flex h-full w-full items-center justify-center font-medium text-[var(--accent)]">
          {initials}
        </span>
      )}
    </div>
  );
}
