"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  SearchIcon,
} from "@/components/icons";
import { useListMorph } from "@/hooks/useListMorph";
import type {
  MarkingCourseSegment,
  MarkingSubmissionRow,
  MarkingLessonGroup,
} from "@/lib/marking";
import {
  ADMIN_LIST_SCROLL,
  ADMIN_LIST_THEAD,
} from "@/components/admin/listScroll";
import { cn } from "@/lib/utils";

interface Props {
  queue: MarkingCourseSegment[];
}

type FilteredCourse = MarkingCourseSegment & {
  filteredLessons: FilteredLesson[];
  courseMatch: boolean;
};

type FilteredLesson = MarkingLessonGroup & {
  filteredSubmissions: MarkingSubmissionRow[];
};

function formatRelative(isoString: string | null): string {
  if (!isoString) return "Unknown";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

export function MarkingQueueTable({ queue }: Props) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const morph = useListMorph();

  const q = query.trim().toLowerCase();

  const filtered = useMemo<FilteredCourse[]>(() => {
    if (!q) {
      return queue.map((course) => ({
        ...course,
        courseMatch: true,
        filteredLessons: course.lessons.map((lesson) => ({
          ...lesson,
          filteredSubmissions: lesson.submissions,
        })),
      }));
    }

    const out: FilteredCourse[] = [];
    for (const course of queue) {
      const courseMatch = course.title.toLowerCase().includes(q);
      const filteredLessons: FilteredLesson[] = [];

      for (const lesson of course.lessons) {
        const lessonMatch =
          courseMatch ||
          lesson.lessonTitle.toLowerCase().includes(q) ||
          lesson.moduleTitle.toLowerCase().includes(q);
        const matchedSubs = lesson.submissions.filter(
          (s) =>
            s.studentName.toLowerCase().includes(q) ||
            s.studentEmail.toLowerCase().includes(q),
        );
        if (lessonMatch || matchedSubs.length > 0) {
          filteredLessons.push({
            ...lesson,
            filteredSubmissions: lessonMatch
              ? lesson.submissions
              : matchedSubs,
          });
        }
      }

      if (courseMatch || filteredLessons.length > 0) {
        out.push({
          ...course,
          courseMatch,
          filteredLessons: courseMatch
            ? course.lessons.map((lesson) => ({
                ...lesson,
                filteredSubmissions: lesson.submissions,
              }))
            : filteredLessons,
        });
      }
    }
    return out;
  }, [queue, q]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      {/* Search */}
      <div className="relative mb-4">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-subtle" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            const next = e.target.value;
            morph(() => setQuery(next));
          }}
          placeholder="Search courses, lessons or students…"
          className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-border bg-surface text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface shadow-sm p-6 text-center text-sm text-foreground-muted">
          {q ? "No matches." : "No pending submissions."}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
          <div className={ADMIN_LIST_SCROLL}>
            <table className="w-full min-w-[44rem] text-sm">
              <thead className={ADMIN_LIST_THEAD}>
                <tr className="text-left bg-surface-muted border-b border-border">
                  <th className="px-4 py-2 text-xs font-medium text-foreground-muted w-8" />
                  <th className="px-4 py-2 text-xs font-medium text-foreground-muted">
                    Course
                  </th>
                  <th className="px-4 py-2 text-xs font-medium text-foreground-muted text-right">
                    Pending
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((course) => {
                  const isOpen = q ? true : expanded.has(course.courseId);
                  return (
                    <CourseRow
                      key={course.courseId}
                      course={course}
                      isOpen={isOpen}
                      onToggle={() => toggle(course.courseId)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function CourseRow({
  course,
  isOpen,
  onToggle,
}: {
  course: FilteredCourse;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer hover:bg-surface-muted transition-colors"
      >
        <td className="px-4 py-3 align-middle">
          {isOpen ? (
            <ChevronDownIcon className="w-4 h-4 text-foreground-muted" />
          ) : (
            <ChevronRightIcon className="w-4 h-4 text-foreground-muted" />
          )}
        </td>
        <td className="px-4 py-3 align-middle">
          <p className="text-sm font-medium text-foreground">{course.title}</p>
          <p className="text-xs text-foreground-subtle mt-0.5">
            {course.lessons.length} lesson
            {course.lessons.length === 1 ? "" : "s"}
          </p>
        </td>
        <td className="px-4 py-3 text-right align-middle">
          <span className="inline-flex items-center rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-medium text-warning">
            {course.pendingCount}
          </span>
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-surface-muted/40">
          <td colSpan={3} className="px-4 py-4">
            <LessonGroups lessons={course.filteredLessons} />
          </td>
        </tr>
      )}
    </>
  );
}

function LessonGroups({ lessons }: { lessons: FilteredLesson[] }) {
  if (lessons.length === 0) {
    return (
      <p className="text-sm text-foreground-muted px-1">No pending submissions.</p>
    );
  }

  return (
    <div className="space-y-4">
      {lessons.map((lesson) => (
        <div key={lesson.lessonId}>
          {/* Lesson header */}
          <div className="mb-2 px-1">
            <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wide">
              {lesson.moduleTitle}
            </p>
            <p className="text-sm font-medium text-foreground">
              {lesson.lessonTitle}
            </p>
          </div>

          {/* Submission rows */}
          <div className="rounded-md border border-border bg-surface overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="text-left bg-surface-muted border-b border-border">
                  <th className="px-4 py-2 text-xs font-medium text-foreground-muted">
                    Student
                  </th>
                  <th className="px-4 py-2 text-xs font-medium text-foreground-muted">
                    Submitted
                  </th>
                  <th className="px-4 py-2 text-xs font-medium text-foreground-muted" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lesson.filteredSubmissions.map((sub) => (
                  <SubmissionRow key={sub.submissionId} submission={sub} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function SubmissionRow({ submission }: { submission: MarkingSubmissionRow }) {
  return (
    <tr className="hover:bg-surface-muted transition-colors">
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center gap-3 min-w-0">
          <UserAvatar
            name={submission.studentName}
            image={submission.studentAvatar}
            size="sm"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {submission.studentName}
            </p>
            <p className="text-xs text-foreground-muted truncate">
              {submission.studentEmail}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-foreground-muted">
            {formatRelative(submission.submittedAt)}
          </span>
          {submission.autoSubmitted && (
            <span className="inline-flex items-center rounded-full bg-surface-muted border border-border px-2 py-0.5 text-xs font-medium text-foreground-muted">
              Auto-submitted
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 align-middle text-right">
        <Link
          href={`/admin/marking/${submission.submissionId}`}
          className={cn(
            "inline-flex items-center rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground",
            "hover:bg-surface-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring",
          )}
        >
          Mark
        </Link>
      </td>
    </tr>
  );
}
