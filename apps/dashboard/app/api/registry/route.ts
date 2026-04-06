import { NextResponse } from "next/server";

import { getResponseError, listRegistryEntries } from "@/lib/state-server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const entries = await listRegistryEntries();
    return NextResponse.json(entries);
  } catch (error) {
    const { message, status } = getResponseError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
