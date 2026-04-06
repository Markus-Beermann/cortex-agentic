import { NextResponse } from "next/server";

import { getResponseError, releaseDeferredTask } from "@/lib/state-server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await releaseDeferredTask(id);
    return NextResponse.json(task);
  } catch (error) {
    const { message, status } = getResponseError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
