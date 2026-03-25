import { getAllDocs } from "@/lib/docs";
import { NextResponse } from "next/server";

export async function GET() {
  const docs = getAllDocs();
  return NextResponse.json(docs);
}
