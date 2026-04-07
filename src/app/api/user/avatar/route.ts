import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGraphClient } from "@/lib/graph-client";

// 1×1 transparent PNG — returned when the user has no Entra photo or Graph returns an error.
// The <img> onError handler will fire and the client falls back to initials.
const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = req.nextUrl.searchParams.get("email");
  if (!email) {
    return new NextResponse(TRANSPARENT_PNG, {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" },
    });
  }

  try {
    const client = getGraphClient();
    // getStream() returns a Node.js Readable — cast to BodyInit for NextResponse
    const stream = await client
      .api(`/users/${encodeURIComponent(email)}/photo/$value`)
      .getStream();

    return new NextResponse(stream as BodyInit, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    // No Entra photo, user not found, or missing Graph permission (ProfilePhoto.Read.All)
    return new NextResponse(TRANSPARENT_PNG, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300",
      },
    });
  }
}
