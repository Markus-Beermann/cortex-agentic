import { NextResponse } from "next/server";

import { createRun, getResponseError, listRuns } from "@/lib/state-server";

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

export async function POST(request: Request) {
  try {
    const body = await request.json() as { goal?: unknown; projectId?: unknown };
    if (typeof body.goal !== "string" || body.goal.trim().length === 0) {
      return NextResponse.json({ error: "goal is required" }, { status: 400 });
    }
    const projectId = typeof body.projectId === "string" ? body.projectId : "remote";
    const run = await createRun(body.goal.trim(), projectId);
    return NextResponse.json(run, { status: 201 });
  } catch (error) {
    const { message, status } = getResponseError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
