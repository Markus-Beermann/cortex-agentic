import { NextResponse } from "next/server";

import { getResponseError, listOutputs } from "@/lib/state-server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const outputs = await listOutputs(id);
    return NextResponse.json(outputs);
  } catch (error) {
    const { message, status } = getResponseError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
