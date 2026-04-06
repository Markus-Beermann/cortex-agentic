import { NextResponse } from "next/server";

import { getResponseError, listRepos } from "@/lib/state-server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const repos = await listRepos();
    return NextResponse.json(repos);
  } catch (error) {
    const { message, status } = getResponseError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
