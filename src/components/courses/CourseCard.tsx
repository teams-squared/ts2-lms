import Image from "next/image";
import Link from "next/link";
import { CourseStatusBadge } from "./CourseStatusBadge";
import { LockIcon } from "@/components/icons";
import type { CourseStatus } from "@/lib/types";

interface CourseCardProps {
  id: string;
  title: string;
  description: string | null;
  status: CourseStatus;
  thumbnail: string | null;
  createdBy: { name: string | null; email: string };
  locked?: boolean;
  lockReason?: string;
}

export function CourseCard({
  id,
  title,
  description,
  status,
  thumbnail,
  createdBy,
  locked,
  lockReason,
}: CourseCardProps) {
  return (
    <Link
      href={`/courses/${id}`}
      className={`group block rounded-xl border bg-white dark:bg-[#1c1c24] shadow-card hover:shadow-elevated hover-lift overflow-hidden ${
        locked
          ? "border-gray-300/60 dark:border-[#3a3a48] opacity-75"
          : "border-gray-200/80 dark:border-[#2e2e3a]"
      }`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-100 dark:bg-[#18181f] overflow-hidden">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt={title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className={`object-cover ${locked ? "grayscale" : ""}`}
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-3xl text-gray-300 dark:text-gray-600">
            {title[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        {locked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 dark:bg-black/40">
            <LockIcon className="w-8 h-8 text-white/80" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <CourseStatusBadge status={status} />
          {locked && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
              Locked
            </span>
          )}
        </div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-2">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2 mb-2">
            {description}
          </p>
        )}
        {locked && lockReason && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 mb-1 line-clamp-2">
            {lockReason}
          </p>
        )}
        <p className="text-xs text-gray-400 dark:text-gray-500">
          by {createdBy.name || createdBy.email}
        </p>
      </div>
    </Link>
  );
}
