import { prisma } from "@/lib/prisma";
import { computeDeadline } from "@/lib/deadlines";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [totalEnrollments, totalQuizAttempts, activeUsers7d] = await Promise.all([
    prisma.enrollment.count(),
    prisma.quizAttempt.count(),
    prisma.userStats.count({
      where: { lastActivityDate: { gte: sevenDaysAgo } },
    }),
  ]);

  // Course metrics
  const courses = await prisma.course.findMany({
    where: { status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      modules: { select: { lessons: { select: { id: true, deadlineDays: true } } } },
      _count: { select: { enrollments: true } },
    },
    orderBy: { title: "asc" },
  });

  // Batch fetch all quiz attempts across all published courses in a SINGLE query,
  // then aggregate per-course in JS — replaces an N+1 pattern.
  const lessonToCourseId = new Map<string, string>();
  for (const c of courses) {
    for (const m of c.modules) {
      for (const l of m.lessons) lessonToCourseId.set(l.id, c.id);
    }
  }
  const allLessonIdsFlat = [...lessonToCourseId.keys()];
  const allQuizAttempts =
    allLessonIdsFlat.length > 0
      ? await prisma.quizAttempt.findMany({
          where: { lessonId: { in: allLessonIdsFlat } },
          select: { lessonId: true, score: true, totalQuestions: true },
        })
      : [];
  const perCourseQuizAgg = new Map<string, { sumPct: number; count: number }>();
  for (const a of allQuizAttempts) {
    const courseId = lessonToCourseId.get(a.lessonId);
    if (!courseId) continue;
    const pct = a.totalQuestions > 0 ? (a.score / a.totalQuestions) * 100 : 0;
    const agg = perCourseQuizAgg.get(courseId) ?? { sumPct: 0, count: 0 };
    agg.sumPct += pct;
    agg.count += 1;
    perCourseQuizAgg.set(courseId, agg);
  }

  const courseMetrics = courses.map((course) => {
    const allLessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
    const agg = perCourseQuizAgg.get(course.id);
    const avgQuizScore =
      agg && agg.count > 0 ? Math.round(agg.sumPct / agg.count) : null;
    return {
      id: course.id,
      title: course.title,
      enrolledCount: course._count.enrollments,
      totalLessons: allLessonIds.length,
      avgQuizScore,
      deadlineCompliance: null as number | null,
    };
  });

  // Compute deadline compliance per course
  const allDeadlineLessons = courses.flatMap((c) =>
    c.modules.flatMap((m) => m.lessons.filter((l) => l.deadlineDays != null).map((l) => ({ ...l, courseId: c.id })))
  );
  const hasAnyDeadlines = allDeadlineLessons.length > 0;

  if (hasAnyDeadlines) {
    const dlLessonIds = allDeadlineLessons.map((l) => l.id);
    const dlCourseIds = [...new Set(allDeadlineLessons.map((l) => l.courseId))];

    const [dlEnrollments, dlProgress] = await Promise.all([
      prisma.enrollment.findMany({
        where: { courseId: { in: dlCourseIds } },
        select: { userId: true, courseId: true, enrolledAt: true },
      }),
      prisma.lessonProgress.findMany({
        where: { lessonId: { in: dlLessonIds }, completedAt: { not: null } },
        select: { userId: true, lessonId: true, completedAt: true },
      }),
    ]);

    const progressMap = new Map(dlProgress.map((p) => [`${p.userId}:${p.lessonId}`, p.completedAt!]));

    // Pre-group lessons and enrollments by courseId (avoids O(courses × N) filtering).
    const lessonsByCourse = new Map<string, typeof allDeadlineLessons>();
    for (const l of allDeadlineLessons) {
      const arr = lessonsByCourse.get(l.courseId);
      if (arr) arr.push(l);
      else lessonsByCourse.set(l.courseId, [l]);
    }
    const enrollmentsByCourse = new Map<string, typeof dlEnrollments>();
    for (const e of dlEnrollments) {
      const arr = enrollmentsByCourse.get(e.courseId);
      if (arr) arr.push(e);
      else enrollmentsByCourse.set(e.courseId, [e]);
    }

    // Per-course compliance: completed on time / total deadline-lesson-enrollments
    for (const metric of courseMetrics) {
      const courseDlLessons = lessonsByCourse.get(metric.id) ?? [];
      if (courseDlLessons.length === 0) continue;
      const courseEnrollments = enrollmentsByCourse.get(metric.id) ?? [];
      let totalPairs = 0;
      let onTime = 0;
      for (const lesson of courseDlLessons) {
        for (const enrollment of courseEnrollments) {
          totalPairs++;
          const completedAt = progressMap.get(`${enrollment.userId}:${lesson.id}`);
          if (completedAt) {
            const deadline = computeDeadline(enrollment.enrolledAt, lesson.deadlineDays!);
            if (completedAt <= deadline) onTime++;
          }
        }
      }
      metric.deadlineCompliance = totalPairs > 0 ? Math.round((onTime / totalPairs) * 100) : null;
    }
  }

  // User leaderboard (top 20 by XP)
  const topUsers = await prisma.userStats.findMany({
    orderBy: { xp: "desc" },
    take: 20,
    include: {
      user: {
        select: {
          name: true,
          email: true,
          _count: { select: { enrollments: true, lessonProgress: true } },
        },
      },
    },
  });

  // PostHog embed URL
  const dashboardEmbedUrl = process.env.POSTHOG_DASHBOARD_EMBED_URL;

  const overviewStats = [
    { label: "Total Enrollments", value: totalEnrollments },
    { label: "Active Users (7d)", value: activeUsers7d },
    { label: "Quiz Attempts", value: totalQuizAttempts },
    { label: "Published Courses", value: courses.length },
  ];

  return (
    <div>
      {/* Overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {overviewStats.map(({ label, value }) => (
          <div
            key={label}
            className="p-5 rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card"
          >
            <div className="text-2xl font-bold text-brand-600 dark:text-brand-400 tabular-nums mb-1">
              {value}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500 font-medium">
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Course activity table */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Course Activity
        </h2>
        <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-[#2e2e3a] text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                  Course
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 text-right">
                  Enrolled
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 text-right">
                  Lessons
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 text-right">
                  Avg Quiz Score
                </th>
                {hasAnyDeadlines && (
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 text-right">
                    On-Time
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#2e2e3a]">
              {courseMetrics.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">
                    {c.title}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {c.enrolledCount}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {c.totalLessons}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {c.avgQuizScore !== null ? `${c.avgQuizScore}%` : "—"}
                  </td>
                  {hasAnyDeadlines && (
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {c.deadlineCompliance !== null ? `${c.deadlineCompliance}%` : "—"}
                    </td>
                  )}
                </tr>
              ))}
              {courseMetrics.length === 0 && (
                <tr>
                  <td colSpan={hasAnyDeadlines ? 5 : 4} className="px-4 py-6 text-center text-gray-400 dark:text-gray-500">
                    No published courses yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User leaderboard */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Top Learners
        </h2>
        <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-[#2e2e3a] text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                  User
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 text-right">
                  XP
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 text-right">
                  Streak
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 text-right">
                  Courses
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 text-right">
                  Lessons
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#2e2e3a]">
              {topUsers.map((stat, i) => (
                <tr key={stat.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums w-5">
                        {i + 1}.
                      </span>
                      <div>
                        <p className="text-gray-900 dark:text-gray-100 font-medium">
                          {stat.user.name || "Unnamed"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {stat.user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-brand-600 dark:text-brand-400">
                    {stat.xp.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {stat.streak > 0 ? `🔥 ${stat.streak}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {stat.user._count.enrollments}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {stat.user._count.lessonProgress}
                  </td>
                </tr>
              ))}
              {topUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400 dark:text-gray-500">
                    No user activity yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PostHog embed */}
      {dashboardEmbedUrl && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            PostHog Dashboard
          </h2>
          <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card overflow-hidden">
            <iframe
              src={dashboardEmbedUrl}
              title="PostHog Analytics Dashboard"
              className="w-full h-[600px] border-0"
              allow="fullscreen"
            />
          </div>
        </div>
      )}
    </div>
  );
}
