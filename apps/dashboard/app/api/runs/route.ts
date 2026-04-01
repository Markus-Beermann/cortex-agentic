import { NextResponse } from "next/server";

import { getResponseError, listRuns } from "@/lib/state-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const runs = await listRuns();
    return NextResponse.json(runs);
  } catch (error) {
    const { message, status } = getResponseError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
