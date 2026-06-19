import { NextResponse } from "next/server";
import { requireRole } from "@/lib/roles";
import { searchTenantUsers } from "@/lib/entra/graph";

/**
 * GET /api/admin/users/search?q=...
 *
 * Prefix-searches the Entra tenant for invite suggestions. The operator types
 * a name fragment (`akil`) and gets back matching directory users so they can
 * pick the right address (`akil.fernando@…` vs `akil.pereira@…`). Advisory
 * only — returns `[]` whenever Graph is unconfigured/unreachable so the form
 * falls back to manual entry. Same gate as the invite endpoint (course_manager+).
 */
export async function GET(request: Request) {
  const authResult = await requireRole("course_manager");
  if (authResult instanceof NextResponse) return authResult;

  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json([]);

  const matches = await searchTenantUsers(q);
  return NextResponse.json(matches);
}
