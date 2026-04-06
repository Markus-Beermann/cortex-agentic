import { NextResponse } from "next/server";

import { getResponseError, sendChatMessage } from "@/lib/state-server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      message?: unknown;
      agentId?: unknown;
      repoId?: unknown;
      llmId?: unknown;
      sessionId?: unknown;
    };

    if (typeof body.message !== "string" || body.message.trim().length === 0) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    if (typeof body.agentId !== "string" || body.agentId.trim().length === 0) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    if (typeof body.llmId !== "string" || body.llmId.trim().length === 0) {
      return NextResponse.json({ error: "llmId is required" }, { status: 400 });
    }

    if (typeof body.sessionId !== "string" || body.sessionId.trim().length === 0) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const response = await sendChatMessage({
      message: body.message.trim(),
      agentId: body.agentId.trim(),
      repoId: typeof body.repoId === "string" && body.repoId.trim().length > 0
        ? body.repoId.trim()
        : undefined,
      llmId: body.llmId.trim(),
      sessionId: body.sessionId.trim()
    });

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const { message, status } = getResponseError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
