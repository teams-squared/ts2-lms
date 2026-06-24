"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { Spinner } from "@/components/ui/Spinner";
import type { ModuleManager } from "./ModuleManager";
import type { QuizBuilder } from "./QuizBuilder";
import type { AssessmentBuilder } from "./AssessmentBuilder";

/**
 * Client-side lazy wrappers for the course-authoring editors. Each pulls in
 * `@dnd-kit/*` (~40KB) via the shared `Sortable` primitive. These editors are
 * privileged-only and never needed on first paint, so we code-split them out
 * of the initial bundle with `ssr: false`.
 *
 * The wrappers live in a Client Component because `next/dynamic({ ssr: false })`
 * is not allowed in Server Components (Next throws) — and the two render sites
 * (admin modules page, lesson detail page) are Server Components.
 */

const loading = () => (
  <div className="flex justify-center py-8">
    <Spinner />
  </div>
);

const ModuleManagerDynamic = dynamic(
  () => import("./ModuleManager").then((m) => m.ModuleManager),
  { ssr: false, loading },
);
const QuizBuilderDynamic = dynamic(
  () => import("./QuizBuilder").then((m) => m.QuizBuilder),
  { ssr: false, loading },
);
const AssessmentBuilderDynamic = dynamic(
  () => import("./AssessmentBuilder").then((m) => m.AssessmentBuilder),
  { ssr: false, loading },
);

export function ModuleManagerLazy(props: ComponentProps<typeof ModuleManager>) {
  return <ModuleManagerDynamic {...props} />;
}
export function QuizBuilderLazy(props: ComponentProps<typeof QuizBuilder>) {
  return <QuizBuilderDynamic {...props} />;
}
export function AssessmentBuilderLazy(props: ComponentProps<typeof AssessmentBuilder>) {
  return <AssessmentBuilderDynamic {...props} />;
}
