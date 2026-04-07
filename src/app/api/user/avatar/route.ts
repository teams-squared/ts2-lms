import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ClientSecretCredential } from "@azure/identity";

// Module-level credential so its internal token cache is reused across requests.
let _credential: ClientSecretCredential | null = null;

function getCredential(): ClientSecretCredential | null {
  const tenantId  = process.env.SHAREPOINT_TENANT_ID;
  const clientId  = process.env.SHAREPOINT_CLIENT_ID;
  const secret    = process.env.SHAREPOINT_CLIENT_SECRET;
  if (!tenantId || !clientId || !secret) return null;
  if (!_credential) {
    _credential = new ClientSecretCredential(tenantId, clientId, secret);
  }
  return _credential;
}

export async function GET(req: NextRequest) {
  // Any authenticated user may request avatars (their own or others' in admin tables).
  const session = await auth();
  if (!session?.user) {
    return new NextResponse(null, { status: 401 });
  }

  const email = req.nextUrl.searchParams.get("email");
  if (!email) {
    return new NextResponse(null, { status: 400 });
  }

  const credential = getCredential();
  if (!credential) {
    // Graph credentials not configured — fall through to initials in the UI.
    return new NextResponse(null, { status: 404 });
  }

  try {
    const tokenResponse = await credential.getToken(
      "https://graph.microsoft.com/.default"
    );

    const photoRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/photo/$value`,
      {
        headers: { Authorization: `Bearer ${tokenResponse.token}` },
        // Don't let Next.js cache the upstream fetch — caching is handled by
        // our own Cache-Control response header below.
        cache: "no-store",
      }
    );

    if (!photoRes.ok) {
      // 404 = no photo set; 403 = missing ProfilePhoto.Read.All permission.
      // Either way return 404 so <img> onError fires and initials are shown.
      return new NextResponse(null, { status: 404 });
    }

    const arrayBuffer = await photoRes.arrayBuffer();
    const contentType = photoRes.headers.get("content-type") ?? "image/jpeg";

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
