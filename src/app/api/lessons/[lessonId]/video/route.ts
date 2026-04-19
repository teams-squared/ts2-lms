import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { getDriveItemContent } from "@/lib/sharepoint/graph-client";
import type { SharePointDocumentRef } from "@/lib/sharepoint/types";

type Params = { params: Promise<{ lessonId: string }> };

export async function GET(request: Request, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId, role } = authResult;

  const { lessonId } = await params;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });

  if (!lesson || lesson.type !== "VIDEO") {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  let docRef: SharePointDocumentRef | null = null;
  if (lesson.content) {
    try {
      docRef = JSON.parse(lesson.content) as SharePointDocumentRef;
    } catch {
      docRef = null;
    }
  }
  if (!docRef?.driveId || !docRef?.itemId) {
    return NextResponse.json({ error: "Lesson has no SharePoint video attached" }, { status: 404 });
  }
  if (!docRef.mimeType?.startsWith("video/")) {
    return NextResponse.json({ error: "Attached file is not a video" }, { status: 415 });
  }

  // Access: admin/course_manager always; employee must be enrolled.
  if (role !== "admin" && role !== "course_manager") {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: lesson.module.courseId } },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const range = request.headers.get("range");

  let upstream: Response;
  try {
    upstream = await getDriveItemContent(docRef.driveId, docRef.itemId, { range });
  } catch {
    return NextResponse.json({ error: "Failed to fetch video" }, { status: 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", docRef.mimeType);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, max-age=900");
  const cl = upstream.headers.get("content-length");
  if (cl) headers.set("Content-Length", cl);
  const cr = upstream.headers.get("content-range");
  if (cr) headers.set("Content-Range", cr);

  return new Response(upstream.body, {
    status: upstream.status === 206 ? 206 : 200,
    headers,
  });
}
