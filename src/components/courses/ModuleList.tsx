"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDownIcon, ChevronRightIcon } from "@/components/icons";
import type { LessonType } from "@/lib/types";

interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  order: number;
}

interface Module {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

const LESSON_TYPE_ICON: Record<LessonType, string> = {
  text: "📄",
  video: "🎬",
  quiz: "❓",
};

export function ModuleList({
  modules,
  courseId,
}: {
  modules: Module[];
  courseId: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(modules.map((m) => m.id))
  );

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (modules.length === 0) {
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400 py-4 text-center">
        No modules yet.
      </p>
    );
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-[#26262e]">
      {modules.map((mod) => (
        <div key={mod.id}>
          <button
            onClick={() => toggle(mod.id)}
            className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[#1e1e28] transition-colors"
          >
            {expanded.has(mod.id) ? (
              <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
            ) : (
              <ChevronRightIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {mod.title}
            </span>
            <span className="ml-auto text-xs text-gray-400">
              {mod.lessons.length} lesson{mod.lessons.length !== 1 ? "s" : ""}
            </span>
          </button>

          {expanded.has(mod.id) && mod.lessons.length > 0 && (
            <div className="pl-10 pr-4 pb-2 space-y-0.5">
              {mod.lessons.map((lesson) => (
                <Link
                  key={lesson.id}
                  href={`/courses/${courseId}/lessons/${lesson.id}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1e1e28] transition-colors"
                >
                  <span className="text-xs">{LESSON_TYPE_ICON[lesson.type]}</span>
                  <span>{lesson.title}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
