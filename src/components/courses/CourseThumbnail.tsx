import Image from "next/image";
import { GraduationCap } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * CourseThumbnail — design-system Section 8.2.1.
 *
 * Uniform 16:9 thumbnail used across dashboard, course catalog, and course
 * detail pages. If a real image is supplied it renders with `object-cover`;
 * otherwise we show a tinted empty state with the GraduationCap icon and the
 * course title as a small caption.
 *
 * Usage:
 *   <CourseThumbnail title={course.title} src={course.thumbnail} />
 *
 * No page-specific variations. No SVG illustrations. Empty state is the
 * single canonical fallback.
 */

interface CourseThumbnailProps {
  title: string;
  /** Absolute or relative URL to a real thumbnail image. */
  src?: string | null;
  /** Visually desaturates the thumbnail to indicate a locked course. */
  locked?: boolean;
  /** Pass-through className for outer wrapper. */
  className?: string;
  /** next/image `sizes` attribute, defaults to the card grid responsive value. */
  sizes?: string;
}

export function CourseThumbnail({
  title,
  src,
  locked = false,
  className,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
}: CourseThumbnailProps) {
  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden bg-primary-subtle",
        className,
      )}
    >
      {src ? (
        // object-contain + padding keeps SVG illustrations (and any image with
        // a transparent/white background) inside the tinted frame rather than
        // filling edge-to-edge and washing out the bg-primary-subtle container.
        <Image
          src={src}
          alt=""
          fill
          sizes={sizes}
          className={cn("object-contain p-6", locked && "grayscale")}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <GraduationCap
            className="h-10 w-10 text-primary-subtle-foreground"
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
}
