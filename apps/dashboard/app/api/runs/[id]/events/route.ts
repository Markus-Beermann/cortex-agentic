import { NextResponse } from "next/server";

import { getResponseError, readRunEvents } from "@/lib/state-server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const events = await readRunEvents(id);

    return NextResponse.json(events);
  } catch (error) {
    const { message, status } = getResponseError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
