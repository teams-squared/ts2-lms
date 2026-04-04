import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clearCache } from "@/lib/sharepoint";

export async function POST() {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  clearCache();

  console.log(
    `[cache] flushed by ${session.user?.email} at ${new Date().toISOString()}`
  );

  return NextResponse.json({
    success: true,
    message: "Cache cleared. Next requests will fetch fresh data from SharePoint.",
    clearedAt: new Date().toISOString(),
  });
}
