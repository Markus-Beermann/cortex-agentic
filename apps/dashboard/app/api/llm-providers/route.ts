import { NextResponse } from "next/server";

import { getResponseError, listLLMProviderOptions } from "@/lib/state-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const providers = await listLLMProviderOptions();
    return NextResponse.json(providers);
  } catch (error) {
    const { message, status } = getResponseError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
