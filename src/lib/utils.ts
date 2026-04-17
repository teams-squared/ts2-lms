import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class strings safely, with conflicting utilities resolved
 * in favor of the last one passed. Prefer this over template-literal class
 * composition. See design system Section 11.5.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
