function parseJson(value: string): unknown {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function extractError(payload: unknown): string | null {
  if (typeof payload === "string" && payload.length > 0) {
    return payload;
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return null;
  }

  if ("error" in payload && typeof payload.error === "string" && payload.error.length > 0) {
    return payload.error;
  }

  return null;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  return "Unknown error";
}

export async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store",
    headers: {
      accept: "application/json"
    }
  });

  const payload = parseJson(await response.text());

  if (!response.ok) {
    throw new Error(extractError(payload) ?? response.statusText ?? "Request failed");
  }

  return payload as T;
}
