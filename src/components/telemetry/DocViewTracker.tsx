"use client";

import { useEffect } from "react";
import { posthog } from "@/lib/posthog-client";

interface DocViewTrackerProps {
  title: string;
  slug: string;
  category: string;
  categoryTitle: string;
  userRole: string;
}

export default function DocViewTracker({
  title,
  slug,
  category,
  categoryTitle,
  userRole,
}: DocViewTrackerProps) {
  useEffect(() => {
    posthog.capture("document_viewed", {
      doc_title: title,
      doc_slug: slug,
      category,
      category_title: categoryTitle,
      user_role: userRole,
    });
  }, [title, slug, category, categoryTitle, userRole]);

  return null;
}
