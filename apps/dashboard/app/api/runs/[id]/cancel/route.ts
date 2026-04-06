import { NextResponse } from "next/server";

import { cancelRun, getResponseError } from "@/lib/state-server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const run = await cancelRun(id);
    return NextResponse.json(run);
  } catch (error) {
    const { message, status } = getResponseError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
