import { NextRequest, NextResponse } from "next/server";

import { getResponseError, listDeferredTasks } from "@/lib/state-server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const addressee = request.nextUrl.searchParams.get("addressee") ?? undefined;
    const statusParam = request.nextUrl.searchParams.get("status");
    const status = statusParam === "pending" || statusParam === "released"
      ? statusParam
      : undefined;

    const tasks = await listDeferredTasks(addressee, status);
    return NextResponse.json(tasks);
  } catch (error) {
    const { message, status } = getResponseError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
