import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getUserProgress,
  updateDocProgress,
  saveUserProgress,
} from "@/lib/progress-store";
import { evaluateBadges } from "@/lib/badges";
import { getAllDocs, getCategories } from "@/lib/docs";
import type { DocProgress, Role } from "@/lib/types";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const progress = getUserProgress(session.user.email);
  return NextResponse.json(progress);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { docKey?: string; update?: Partial<DocProgress> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { docKey, update } = body;
  if (!docKey || !update) {
    return NextResponse.json(
      { error: "docKey and update are required" },
      { status: 400 }
    );
  }

  try {
    const progress = updateDocProgress(session.user.email, docKey, update);

    // Evaluate badges
    const userRole = (session.user?.role as Role) || "employee";
    const [allDocs, categories] = await Promise.all([
      getAllDocs(userRole),
      getCategories(),
    ]);
    const { allBadges, newBadges } = evaluateBadges(
      progress,
      allDocs,
      categories
    );
    if (newBadges.length > 0) {
      progress.badges = allBadges;
      saveUserProgress(session.user.email, progress);
    }

    return NextResponse.json({ progress, newBadges });
  } catch (err) {
    console.error("[progress] updateDocProgress failed:", err);
    return NextResponse.json(
      { error: "Failed to save progress" },
      { status: 500 }
    );
  }
}
