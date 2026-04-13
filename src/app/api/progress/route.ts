import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getUserProgress,
  updateDocProgress,
} from "@/lib/progress-store";
import type { DocProgress } from "@/lib/types";

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
    return NextResponse.json({ progress });
  } catch (err) {
    console.error("[progress] updateDocProgress failed:", err);
    return NextResponse.json(
      { error: "Failed to save progress" },
      { status: 500 }
    );
  }
}
